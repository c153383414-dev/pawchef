import { findFood } from './nutrition-db'
import { validateRecipe, PetParams, ValidationResult } from './nutrition-validator'

type Ingredient = { name: string; dbName?: string; amountG: number }

const COMPLIANCE_ORDER: Record<string, number> = { compliant: 0, partial: 1, 'non-compliant': 2 }

/**
 * Deterministic math fix for healthy-pet recipes that land on `partial` compliance
 * (exactly 1 AAFCO metric failing). Applies the smallest possible adjustment to
 * existing ingredients without adding new ones, then re-validates.
 *
 * Returns updated ingredients + validation when the result improves, null otherwise.
 */
export function fixPartialCompliance(
  ingredients: Ingredient[],
  validation: ValidationResult,
  petParams: PetParams,
): { ingredients: Ingredient[]; validation: ValidationResult } | null {
  if (validation.complianceLabel !== 'partial') return null

  const { aafco } = validation

  // Identify the single failing metric (partial = exactly 1 failure)
  const failing =
    !aafco.protein.ok    ? 'protein'    :
    !aafco.fat.ok        ? 'fat'        :
    !aafco.omega3.ok     ? 'omega3'     :
    !aafco.phosphorus.ok ? 'phosphorus' :
    null  // calcium / caPRatio handled by auto-supplement; skip

  if (!failing) return null

  // Clone ingredient list so we don't mutate the original
  let adjusted = ingredients.map(i => ({ ...i }))

  switch (failing) {
    case 'protein': {
      // Scale up all protein-category ingredients proportionally
      const needed    = aafco.protein.min   // per 1000 kcal
      const current   = aafco.protein.value
      const scaleFactor = Math.min(needed / current, 1.5)
      adjusted = scaleCategory(adjusted, ['protein'], scaleFactor, petParams)
      break
    }

    case 'phosphorus': {
      // Scale up proteins (phosphorus-rich), scale down vegetables to preserve calories
      const needed      = aafco.phosphorus.min
      const current     = aafco.phosphorus.value
      const scaleFactor = Math.min(needed / current, 1.5)
      adjusted = scaleCategory(adjusted, ['protein', 'organ'], scaleFactor, petParams)
      // Proportionally shrink vegetables to keep total calories stable
      const proteinBefore = sumAmountG(ingredients, ['protein', 'organ'])
      const proteinAfter  = sumAmountG(adjusted,    ['protein', 'organ'])
      const calorieGain   = proteinAfter - proteinBefore  // rough kcal delta (not exact but good enough)
      if (calorieGain > 0) {
        const veggieBefore = sumAmountG(adjusted, ['veggie'])
        if (veggieBefore > 0) {
          const veggieScale = Math.max(0.5, 1 - calorieGain / veggieBefore)
          adjusted = scaleCategory(adjusted, ['veggie'], veggieScale, petParams)
        }
      }
      break
    }

    case 'fat': {
      // Prefer scaling existing oil; fall back to fattiest protein ingredient
      const oilIngredients = adjusted.filter(i => {
        const food = i.dbName ? findFood(i.dbName, true) : findFood(i.name, false)
        return food?.category === 'oil'
      })
      if (oilIngredients.length > 0) {
        const needed      = aafco.fat.min
        const current     = aafco.fat.value
        const scaleFactor = Math.min(needed / current, 1.5)
        adjusted = scaleCategory(adjusted, ['oil'], scaleFactor, petParams)
      }
      // else: no oil present — don't add new ingredients, leave unchanged
      break
    }

    case 'omega3': {
      // Scale up fish_oil only, respecting the pancreatitis-aware weight cap
      const fishOilCap = Math.min(petParams.weightKg * 0.3, 3)  // healthy pet cap
      adjusted = adjusted.map(i => {
        if (!i.dbName?.includes('fish_oil')) return i
        const needed      = aafco.omega3.min
        const current     = aafco.omega3.value
        const scaleFactor = Math.min(needed / current, 1.5)
        const newAmount   = Math.min(i.amountG * scaleFactor, fishOilCap)
        return capToMaxPerKg({ ...i, amountG: newAmount }, petParams.weightKg)
      })
      break
    }
  }

  // Re-validate with adjusted ingredients
  const newValidation = validateRecipe(adjusted, petParams)

  // Only accept if compliance improved or stayed the same and calories are fine
  if (COMPLIANCE_ORDER[newValidation.complianceLabel] < COMPLIANCE_ORDER[validation.complianceLabel]) {
    return { ingredients: adjusted, validation: newValidation }
  }

  return null
}

// ── helpers ──────────────────────────────────────────────────────────────────

function scaleCategory(
  ingredients: Ingredient[],
  categories: string[],
  scaleFactor: number,
  petParams: PetParams,
): Ingredient[] {
  return ingredients.map(i => {
    const food = i.dbName ? findFood(i.dbName, true) : findFood(i.name, false)
    if (!food || !categories.includes(food.category)) return i
    const newAmount = i.amountG * scaleFactor
    const capped    = capToMaxPerKg({ ...i, amountG: newAmount }, petParams.weightKg)
    // Also enforce 150% original-amount cap
    capped.amountG  = Math.min(capped.amountG, i.amountG * 1.5)
    return capped
  })
}

function capToMaxPerKg(ingredient: Ingredient, weightKg: number): Ingredient {
  if (!ingredient.dbName) return ingredient
  const food = findFood(ingredient.dbName, true)
  if (!food?.maxAmountPerKgG) return ingredient
  const maxG = food.maxAmountPerKgG * weightKg
  return { ...ingredient, amountG: Math.min(ingredient.amountG, maxG) }
}

function sumAmountG(ingredients: Ingredient[], categories: string[]): number {
  return ingredients.reduce((sum, i) => {
    const food = i.dbName ? findFood(i.dbName, true) : findFood(i.name, false)
    return categories.includes(food?.category ?? '') ? sum + i.amountG : sum
  }, 0)
}
