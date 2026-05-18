import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { validateRecipe, validateIngredients, scaleToTargetCalories, PetParams, ValidationResult } from '@/lib/nutrition-validator'
import { validateConditionRecipe } from '@/lib/condition-standards'
import { getAllowedFoodsByCategory, findFood, OILY_FISH_DBNAMES } from '@/lib/nutrition-db'
import { DeductSource } from '@/types'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey:  process.env.OPENROUTER_API_KEY,
  defaultHeaders: { 'X-Title': 'PawChef' },
})

const LANGUAGE_MAP: Record<string, string> = {
  en: 'English', zh: 'Chinese (Simplified)', es: 'Spanish',
  fr: 'French',  ja: 'Japanese',             ko: 'Korean',
}

// Gemini requires these to suppress thinking-chain leakage and enforce JSON mode
const GEMINI_EXTRAS = {
  response_format: { type: 'json_object' },
  thinking_config:  { include_thoughts: false },
}

// Category emoji defaults (FoodItem has no emoji field)
const CATEGORY_EMOJI: Record<string, string> = {
  protein:    '🥩',
  organ:      '🫀',
  veggie:     '🥦',
  carb:       '🍚',
  supplement: '💊',
  oil:        '🫒',
}

// Robust JSON parser: handles Gemini markdown code-blocks and thinking preamble
function parseJson(text: string, requiredKey: string): any {
  // Strategy 1: extract ```json ... ``` block
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlock) {
    try { const p = JSON.parse(codeBlock[1]); if (p[requiredKey] !== undefined) return p } catch {}
  }
  // Strategy 2: bracket-depth scan — find first complete {...} containing requiredKey
  {
    let depth = 0, start = -1
    let inString = false, escape = false
    for (let i = 0; i < text.length; i++) {
      const c = text[i]
      if (escape)                   { escape = false; continue }
      if (c === '\\' && inString)   { escape = true;  continue }
      if (c === '"')                { inString = !inString; continue }
      if (inString) continue
      if (c === '{')                { if (depth === 0) start = i; depth++ }
      else if (c === '}') {
        depth--
        if (depth === 0 && start !== -1) {
          try { const p = JSON.parse(text.slice(start, i + 1)); if (p[requiredKey] !== undefined) return p } catch {}
          start = -1
        }
      }
    }
  }
  // Strategy 3: direct parse
  try { return JSON.parse(text.trim()) } catch {}
  throw new Error('AI response format error')
}

// ── Shared validation chain ────────────────────────────────────────────────────
// validateIngredients → validateRecipe → scaleToTargetCalories → validateConditionRecipe
function runValidationChain(
  ingredients: any[],
  petParams:   PetParams,
  conditions:  string[],
  species:     string,
): { validation: ValidationResult; cappedIngredients: any[]; conditionOk: boolean } {
  const { ingredients: capped } = validateIngredients(ingredients as any, petParams)
  let validation = validateRecipe(capped, petParams)
  let finalIngredients: any[] = capped

  if (!validation.caloriesOk && validation.actualCalories > 0) {
    const mid  = (validation.targetCalories.min + validation.targetCalories.max) / 2
    const diff = Math.abs(validation.actualCalories - mid)
    if (diff / validation.actualCalories <= 0.5) {
      const withSupplements = [
        ...capped,
        ...validation.supplements.map(s => ({ name: s.ingredient, dbName: s.dbName, amountG: s.amountG })),
      ]
      const scaled = scaleToTargetCalories(withSupplements, petParams, validation.actualCalories)
      validation        = scaled.revalidation
      finalIngredients  = scaled.scaledIngredients
    }
  }

  let conditionOk = true
  if (conditions.length > 0 && validation.actualCalories > 0) {
    const k = 1000 / validation.actualCalories
    const n = {
      protein:    Math.round(validation.nutrients.protein    * k * 10) / 10,
      fat:        Math.round(validation.nutrients.fat        * k * 10) / 10,
      phosphorus: Math.round(validation.nutrients.phosphorus * k),
      carbs:      Math.round(validation.nutrients.carbs      * k * 10) / 10,
    }
    for (const cond of conditions) {
      try {
        if (validateConditionRecipe(n, species as 'dog' | 'cat', cond as any)?.label === 'attention_needed') {
          conditionOk = false
          break
        }
      } catch {}
    }
  }

  return { validation, cappedIngredients: finalIngredients, conditionOk }
}

async function refundCredit(supabase: any, userId: string, source: string) {
  try {
    await supabase.rpc('refund_ai_credit', { p_user_id: userId, p_source: source, p_cost: 1 })
  } catch {}
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const body = await req.json()
    const {
      action           = 'pool',   // 'pool' | 'apply'
      targetIngredient,
      targetDbName,
      currentRecipe,
      pet,
      allergens        = [],
      excludeExtra     = [],        // previously replaced/suggested dbNames to exclude
      poolIndex        = 0,         // which pool batch (0,1,2) — pool action only
      chosenCandidate,              // { dbName, name, amountG, emoji } — apply action only
    } = body

    const targetCategory: string | undefined = body.targetCategory

    if (!targetIngredient || !pet?.species) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const locale   = req.headers.get('x-locale') || 'zh'
    const language = LANGUAGE_MAP[locale] || 'Chinese (Simplified)'

    // ── Credit availability check (both actions — no deduction yet) ────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('gift_ai_points, paid_points, is_pro, monthly_ai_count, pro_expires_at')
      .eq('id', user.id)
      .single()

    const isPro = !!(
      profile?.is_pro &&
      profile.pro_expires_at &&
      new Date(profile.pro_expires_at) > new Date()
    )
    const hasCredits =
      (profile?.gift_ai_points ?? 0) > 0 ||
      (profile?.paid_points    ?? 0) > 0 ||
      (isPro && (profile?.monthly_ai_count ?? 0) < 20)

    if (!hasCredits) {
      return NextResponse.json(
        { error: 'NO_CREDITS', detail: 'Substitute requires AI credits (gift/paid/pro)' },
        { status: 402 },
      )
    }

    // ── Shared setup ───────────────────────────────────────────────────────────
    const conditions = (pet.healthConditions || []).filter((c: string) => c !== 'healthy')
    const species    = pet.species as 'dog' | 'cat'
    const petParams: PetParams = {
      weightKg:         pet.weightKg  || 5,
      ageMonths:        pet.ageMonths || 36,
      species,
      healthConditions: pet.healthConditions || ['healthy'],
    }

    // Determine ingredient category
    const targetFood = findFood(targetDbName || targetIngredient, !!targetDbName)
                    || findFood(targetIngredient, false)
    const VALID_CATEGORIES = ['protein', 'organ', 'veggie', 'carb', 'supplement', 'oil'] as const
    type FoodCategory = typeof VALID_CATEGORIES[number]
    const rawCategory = targetFood?.category || targetCategory || 'protein'
    const category    = (VALID_CATEGORIES.includes(rawCategory as FoodCategory) ? rawCategory : 'protein') as FoodCategory

    // dbNames to exclude from suggestions
    const existingDbNames = new Set<string>([
      ...(currentRecipe?.ingredients || [])
        .filter((ing: any) => ing.dbName && ing.dbName !== targetDbName)
        .map((ing: any) => ing.dbName as string),
      ...excludeExtra.filter((d: any) => typeof d === 'string'),
    ])

    const allowedFoods = getAllowedFoodsByCategory(category, conditions, species)
    if (allowedFoods.length === 0) {
      return NextResponse.json(
        { error: 'NO_SUBSTITUTE', messageKey: 'substitute.no_options' },
        { status: 422 },
      )
    }

    // Oily fish dedup: exclude all oily fish if recipe already contains one
    const recipeHasOilyFish = (currentRecipe?.ingredients || []).some(
      (ing: any) =>
        ing.dbName !== targetDbName &&
        (OILY_FISH_DBNAMES as readonly string[]).includes(ing.dbName),
    )

    // Original ingredient fat check (exclude near-zero-fat options if replacing a fatty food)
    const origFood         = findFood(targetDbName || targetIngredient, !!targetDbName)
    const isOriginalFatty  = (origFood?.nutrients?.fat ?? 0) > 5

    const safeAllowed = allowedFoods.filter(f =>
      !existingDbNames.has(f.dbName) &&
      !allergens.some((a: string) => f.names.some(n => n.toLowerCase().includes(a.toLowerCase()))) &&
      !conditions.some((c: string) => f.forbiddenFor.includes(c as any)) &&
      !(isOriginalFatty && (f.nutrients?.fat ?? 0) < 1) &&
      !(recipeHasOilyFish && (OILY_FISH_DBNAMES as readonly string[]).includes(f.dbName)),
    )

    const candidateFoods = safeAllowed.length > 0
      ? safeAllowed
      : allowedFoods.filter(f =>
          !allergens.some((a: string) => f.names.some(n => n.toLowerCase().includes(a.toLowerCase()))) &&
          !conditions.some((c: string) => f.forbiddenFor.includes(c as any)),
        )

    const shuffled       = [...candidateFoods].sort(() => Math.random() - 0.5)
    const allowedDbNames = shuffled.map(f => f.dbName).join(', ')
    const allowedSet     = new Set(shuffled.map(f => f.dbName))

    // Original ingredient amount
    const originalIngredient = (currentRecipe?.ingredients || []).find(
      (ing: any) =>
        (targetDbName && ing.dbName === targetDbName) || ing.name === targetIngredient,
    )
    const originalAmountG: number =
      originalIngredient?.amountG ||
      (originalIngredient?.amount ? parseInt(String(originalIngredient.amount)) : 0) ||
      50

    // ── Compute "before" baseline nutrition ────────────────────────────────────
    // Use runValidationChain (same as "after") so before/after use consistent scaling
    const { validation: beforeValidation } = runValidationChain(
      currentRecipe?.ingredients || [], petParams, conditions, species,
    )
    const beforeCalories    = Math.round(beforeValidation.actualCalories)
    const beforeProtein     = beforeValidation.actualCalories > 0
      ? Math.round(beforeValidation.nutrients.protein * 1000 / beforeValidation.actualCalories * 10) / 10
      : 0
    const beforeFat         = beforeValidation.actualCalories > 0
      ? Math.round(beforeValidation.nutrients.fat * 1000 / beforeValidation.actualCalories * 10) / 10
      : 0
    const beforeSupplements: Record<string, number> = {}
    const beforeSupplementNames: Record<string, string> = {}
    beforeValidation.supplements.forEach(s => {
      beforeSupplements[s.dbName]     = s.amountG
      beforeSupplementNames[s.dbName] = s.ingredient
    })
    // dbNames that are already explicit ingredients in the original recipe
    const recipeIngDbNames = new Set<string>(
      (currentRecipe?.ingredients || []).map((ing: any) => ing.dbName).filter(Boolean),
    )

    // ═══════════════════════════════════════════════════════════════════════════
    // POOL ACTION — generate candidate pool, no credit deduction
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === 'pool') {
      // Rate limit: max 3 AI pool calls per ingredient slot
      if (poolIndex >= 3) {
        return NextResponse.json({ error: 'POOL_LIMIT_REACHED' }, { status: 429 })
      }

      const excludeNote = existingDbNames.size > 0
        ? `Do NOT suggest these (already in recipe or previously used): ${Array.from(existingDbNames).join(', ')}`
        : ''
      const oilyFishNote = recipeHasOilyFish
        ? `Recipe already contains oily fish — do NOT suggest: ${OILY_FISH_DBNAMES.join(', ')}`
        : ''
      const conditionNote = conditions.length > 0
        ? `Health conditions: ${conditions.join(', ')} — prioritize ingredients suitable for these conditions`
        : ''

      const poolPrompt = `You are a pet nutritionist. Suggest 8-10 diverse substitute ingredients for "${targetIngredient}" (category: ${category}).
Pet: ${species}, ${pet.weightKg || 5}kg${conditions.length ? ', health: ' + conditions.join(', ') : ''}
${species === 'cat' ? 'Cat is an obligate carnivore — prioritize protein-rich substitutes.' : ''}
Allowed dbNames (pick ONLY from this exact list): ${allowedDbNames}
${excludeNote}
${oilyFishNote}
${conditionNote}

Be diverse — pick ingredients with varied nutrient profiles. Avoid always defaulting to the most common options.
Output raw JSON only. No markdown, no explanation:
{"candidates": ["dbName1", "dbName2", ...]}`

      let candidateDbNames: string[] = []
      try {
        const completion = await openai.chat.completions.create({
          model:       'google/gemini-3.1-flash-lite',
          messages:    [{ role: 'user', content: poolPrompt }],
          max_tokens:  300,
          temperature: 1.0,
          ...GEMINI_EXTRAS,
        } as any)
        const text   = completion.choices[0]?.message?.content || ''
        const parsed = parseJson(text, 'candidates')
        candidateDbNames = (parsed.candidates || [])
          .filter((d: any) => typeof d === 'string' && allowedSet.has(d))
        console.log(`[pool] target=${targetDbName||targetIngredient} category=${category} allowedCount=${shuffled.length} aiRaw=${parsed.candidates?.length??0} aiFiltered=${candidateDbNames.length}`)
      } catch (e) {
        console.error('[substitute/pool] AI call failed:', e)
        return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
      }

      // Fallback: supplement with shuffled candidates if AI returned too few
      if (candidateDbNames.length < 3) {
        const extras = shuffled
          .map(f => f.dbName)
          .filter(d => !candidateDbNames.includes(d))
          .slice(0, 8 - candidateDbNames.length)
        candidateDbNames = [...candidateDbNames, ...extras]
        console.log(`[pool] fallback applied → total candidateDbNames=${candidateDbNames.length}`)
      }
      // Deduplicate and cap at 10
      candidateDbNames = Array.from(new Set(candidateDbNames)).slice(0, 10)

      // ── Validate each candidate mathematically (pure math, no AI) ────────────
      const pool: any[] = []

      for (const dbName of candidateDbNames) {
        const food = findFood(dbName, true)
        if (!food) continue

        // Iso-caloric amount scaling
        let amountG = originalAmountG
        if (origFood && food.nutrients.calories > 0 && origFood.nutrients.calories > 0) {
          const origCal = originalAmountG * (origFood.nutrients.calories / 100)
          const iso     = Math.round(origCal / (food.nutrients.calories / 100))
          amountG       = Math.min(originalAmountG * 2, Math.max(originalAmountG * 0.5, iso))
        }

        // Build new ingredient list with this candidate
        const newIngredients = (currentRecipe?.ingredients || []).map((ing: any) =>
          (targetDbName ? ing.dbName === targetDbName : ing.name === targetIngredient)
            ? { name: food.names[0], dbName: food.dbName, amountG }
            : ing,
        )

        // Full validation chain
        const { validation, conditionOk } = runValidationChain(newIngredients, petParams, conditions, species)

        // After nutrition (per 1000 kcal)
        const afterCalories = Math.round(validation.actualCalories)
        const afterProtein  = validation.actualCalories > 0
          ? Math.round(validation.nutrients.protein * 1000 / validation.actualCalories * 10) / 10
          : 0
        const afterFat      = validation.actualCalories > 0
          ? Math.round(validation.nutrients.fat * 1000 / validation.actualCalories * 10) / 10
          : 0

        // Supplement changes (before vs after)
        const afterSupplements: Record<string, { name: string; amountG: number }> = {}
        validation.supplements.forEach(s => {
          afterSupplements[s.dbName] = { name: s.ingredient, amountG: s.amountG }
        })
        const allSupDbNames = Array.from(new Set([
          ...Object.keys(beforeSupplements),
          ...Object.keys(afterSupplements),
        ]))
        const supplementChanges: any[] = []
        for (const sDbName of allSupDbNames) {
          // Skip if already an explicit ingredient — auto-supplement tracking would be misleading
          if (recipeIngDbNames.has(sDbName)) continue
          const before = beforeSupplements[sDbName] || 0
          const after  = afterSupplements[sDbName]?.amountG || 0
          if (before !== after) {
            supplementChanges.push({
              dbName: sDbName,
              name:   findFood(sDbName, true)?.names[0] || afterSupplements[sDbName]?.name || sDbName,
              before,
              after,
            })
          }
        }

        // Validation score: count passing AAFCO metrics + condition
        const aafco = validation.aafco
        const validationScore =
          [aafco.protein.ok, aafco.fat.ok, aafco.calcium.ok, aafco.phosphorus.ok,
           aafco.caPRatio.ok, aafco.omega3.ok, aafco.taurine.ok].filter(Boolean).length +
          (conditionOk ? 1 : 0)

        pool.push({
          dbName:      food.dbName,
          name:        food.names[0],
          emoji:       CATEGORY_EMOJI[food.category] || '🍽️',
          amountG,
          nutritionDelta: {
            calories: { before: beforeCalories,  after: afterCalories },
            protein:  { before: beforeProtein,   after: afterProtein  },
            fat:      { before: beforeFat,        after: afterFat      },
          },
          supplementChanges,
          validationScore,
          conditionOk,
        })
      }

      // Sort best candidates first
      console.log(`[pool] final pool size=${pool.length} for target=${targetDbName||targetIngredient}`)
      pool.sort((a, b) => b.validationScore - a.validationScore)

      return NextResponse.json({ pool, poolIndex })
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // APPLY ACTION — deduct credit, update steps, return final recipe
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === 'apply') {
      if (!chosenCandidate?.dbName) {
        return NextResponse.json({ error: 'Missing chosenCandidate' }, { status: 400 })
      }

      // Deduct credit NOW (user confirmed their choice)
      const { data: deductResult, error: deductErr } = await supabase
        .rpc('deduct_ai_credits', { p_user_id: user.id, p_cost: 1 })
      if (deductErr || !deductResult?.ok) {
        return NextResponse.json({ error: 'NO_CREDITS' }, { status: 402 })
      }
      const creditSource: string  = deductResult?.source ?? 'paid'
      const deductSource: DeductSource =
        creditSource === 'gift' ? 'gift_ai_points' :
        creditSource === 'pro'  ? 'pro_monthly'    : 'paid_points'

      // Server-side revalidation (don't trust frontend data)
      const chosenFood = findFood(chosenCandidate.dbName, true)
      let applyAmountG = chosenCandidate.amountG || originalAmountG
      if (chosenFood && origFood && chosenFood.nutrients.calories > 0 && origFood.nutrients.calories > 0) {
        const origCal = originalAmountG * (origFood.nutrients.calories / 100)
        const iso     = Math.round(origCal / (chosenFood.nutrients.calories / 100))
        applyAmountG  = Math.min(originalAmountG * 2, Math.max(originalAmountG * 0.5, iso))
      }

      const newIngredients = (currentRecipe?.ingredients || []).map((ing: any) =>
        (targetDbName ? ing.dbName === targetDbName : ing.name === targetIngredient)
          ? { name: chosenCandidate.name, dbName: chosenCandidate.dbName, amountG: applyAmountG }
          : ing,
      )

      const { validation, cappedIngredients, conditionOk } = runValidationChain(
        newIngredients, petParams, conditions, species,
      )

      // Sync final amount after capping/scaling
      const finalSub    = cappedIngredients.find((i: any) => i.dbName === chosenCandidate.dbName)
      const finalAmountG = finalSub?.amountG || applyAmountG

      // Update cooking steps via lightweight AI call
      let newSteps: string[] | null = null
      try {
        const existingSteps: string[] =
          currentRecipe?.steps ||
          currentRecipe?.content?.steps ||
          []
        if (existingSteps.length > 0) {
          const stepsPrompt = `Update these pet meal cooking steps: replace all mentions of "${targetIngredient}" with "${chosenCandidate.name}".
Adjust cooking time or method only if "${chosenCandidate.name}" genuinely requires different preparation.
Keep all other steps word-for-word identical. Respond in ${language}.
Steps: ${JSON.stringify(existingSteps)}
Output raw JSON only. No markdown, no explanation:
{"steps": ["step1", "step2", ...]}`

          const stepsCompletion = await openai.chat.completions.create({
            model:       'google/gemini-3.1-flash-lite',
            messages:    [{ role: 'user', content: stepsPrompt }],
            max_tokens:  600,
            temperature: 0.3,
            ...GEMINI_EXTRAS,
          } as any)
          const stepsText   = stepsCompletion.choices[0]?.message?.content || ''
          const stepsResult = parseJson(stepsText, 'steps')
          if (Array.isArray(stepsResult.steps) && stepsResult.steps.length > 0) {
            newSteps = stepsResult.steps
          }
        }
      } catch {
        // Step update failure is non-fatal — keep original steps
        newSteps = null
      }

      // Nutrition warnings (soft — don't block, let user decide)
      const nutritionWarnings: string[] = []
      if (!validation.aafco.protein.ok)                   nutritionWarnings.push('protein_low')
      if (!validation.aafco.fat.ok)                       nutritionWarnings.push('fat_low')
      if (validation.complianceLabel === 'non-compliant') nutritionWarnings.push('non_compliant')
      if (!conditionOk)                                   nutritionWarnings.push('condition_attention')

      // Audit log
      await supabase.from('point_transactions').insert({
        user_id:     user.id,
        amount:      -1,
        type:        'substitute_ingredient',
        description: `Substitute: ${targetIngredient} → ${chosenCandidate.name} (source: ${creditSource})`,
      })

      return NextResponse.json({
        substitute: {
          name:              chosenCandidate.name,
          dbName:            chosenCandidate.dbName,
          emoji:             chosenCandidate.emoji || CATEGORY_EMOJI[chosenFood?.category || 'protein'] || '🍽️',
          amountG:           finalAmountG,
          amount:            `${finalAmountG}g`,
          newSteps:          newSteps ?? undefined,
          nutritionWarnings: nutritionWarnings.length > 0 ? nutritionWarnings : undefined,
        },
        proMonthlyUsed:       creditSource === 'pro',
        autoAddedSupplements: validation.supplements,
        updatedCompliance: {
          label:          validation.complianceLabel,
          labelKey:       validation.complianceLabelKey,
          caloriesOk:     validation.caloriesOk,
          targetCalories: validation.targetCalories,
          aafcoDetails: {
            protein:    { value: Math.round(validation.aafco.protein.value),              min: validation.aafco.protein.min,    ok: validation.aafco.protein.ok    },
            fat:        { value: Math.round(validation.aafco.fat.value * 10) / 10,        min: validation.aafco.fat.min,        ok: validation.aafco.fat.ok        },
            calcium:    { value: Math.round(validation.aafco.calcium.value),              min: validation.aafco.calcium.min,    max: validation.aafco.calcium.max,    ok: validation.aafco.calcium.ok    },
            phosphorus: { value: Math.round(validation.aafco.phosphorus.value),           min: validation.aafco.phosphorus.min, ok: validation.aafco.phosphorus.ok },
            caPRatio:   { value: Math.round(validation.aafco.caPRatio.value * 100) / 100, min: validation.aafco.caPRatio.min,   max: validation.aafco.caPRatio.max,   ok: validation.aafco.caPRatio.ok   },
            omega3:     { value: Math.round(validation.aafco.omega3.value),               min: validation.aafco.omega3.min,     ok: validation.aafco.omega3.ok     },
            taurine:    { value: Math.round(validation.aafco.taurine.value),              min: validation.aafco.taurine.min,    ok: validation.aafco.taurine.ok    },
          },
        },
        updatedNutrition: {
          calories: `~${Math.round(validation.actualCalories)}`,
          protein:  `${Math.round(validation.nutrients.protein * 10) / 10}g`,
          fat:      `${Math.round(validation.nutrients.fat     * 10) / 10}g`,
          carbs:    `${Math.round(validation.nutrients.carbs   * 10) / 10}g`,
        },
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (e: any) {
    console.error('substitute-ingredient error:', e)
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}
