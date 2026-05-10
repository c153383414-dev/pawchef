import { findFood, NutrientPer100g } from './nutrition-db'

// ── AAFCO 四套标准（per 1000 kcal）──
const AAFCO_DOG_ADULT = {
  protein:    { min: 45 },
  fat:        { min: 13.8 },
  calcium:    { min: 1250, max: 6250 },
  phosphorus: { min: 1000 },
  caPRatio:   { min: 1.0, max: 2.0 },
  omega3:     { min: 110 },
  taurine:    { min: 0 },
}
const AAFCO_DOG_PUPPY = {
  protein:    { min: 56 },
  fat:        { min: 21.3 },
  calcium:    { min: 2000, max: 6250 },
  phosphorus: { min: 1750 },
  caPRatio:   { min: 1.0, max: 2.0 },
  omega3:     { min: 110 },
  taurine:    { min: 0 },
}
const AAFCO_CAT_ADULT = {
  protein:    { min: 65 },
  fat:        { min: 22.5 },
  calcium:    { min: 1400, max: 6250 },
  phosphorus: { min: 1260 },
  caPRatio:   { min: 1.0, max: 2.0 },
  omega3:     { min: 110 },
  taurine:    { min: 250 },
}
const AAFCO_CAT_KITTEN = {
  protein:    { min: 75 },
  fat:        { min: 22.5 },
  calcium:    { min: 2000, max: 6250 },
  phosphorus: { min: 1750 },
  caPRatio:   { min: 1.0, max: 2.0 },
  omega3:     { min: 110 },
  taurine:    { min: 250 },
}

// ── 类型定义 ──

export interface RecipeIngredientInput {
  name:               string
  dbName?:            string
  amountG:            number
  nutrientsOverride?: NutrientPer100g
}

export interface PetParams {
  weightKg:         number
  ageMonths:        number
  species:          'dog' | 'cat'
  healthConditions: string[]
  neutered?:        boolean
  activityLevel?:   'low' | 'normal' | 'high'
}

export type AafcoStandard = 'dog_adult' | 'dog_puppy' | 'cat_adult' | 'cat_kitten'

export interface AafcoCheck {
  passed:     boolean
  standard:   AafcoStandard
  protein:    { value: number; min: number; ok: boolean }
  fat:        { value: number; min: number; ok: boolean }
  calcium:    { value: number; min: number; max: number; ok: boolean }
  phosphorus: { value: number; min: number; ok: boolean }
  caPRatio:   { value: number; min: number; max: number; ok: boolean }
  omega3:     { value: number; min: number; ok: boolean }
  taurine:    { value: number; min: number; ok: boolean }
}

export interface SupplementRecommendation {
  ingredient: string
  dbName:     string
  amountG:    number
  reasonKey:  string
}

export interface ValidationResult {
  targetCalories: { min: number; max: number }
  actualCalories: number
  caloriesOk:     boolean
  nutrients: {
    calories: number; protein: number; fat: number; carbs: number
    calcium: number; phosphorus: number; omega3: number; taurine: number
    vitaminA: number; vitaminD: number; zinc: number; iodine: number
  }
  aafco:              AafcoCheck
  supplements:        SupplementRecommendation[]
  unknownIngredients: string[]
  complianceLabel:    'compliant' | 'partial' | 'non-compliant'
  complianceLabelKey: string
}

// ── 热量计算 ──

export function calculateRER(weightKg: number): number {
  return Math.round(70 * Math.pow(weightKg, 0.75))
}

export function calculateDER(params: PetParams): { min: number; max: number } {
  const rer   = calculateRER(params.weightKg)
  const isCat = params.species === 'cat'
  let factor: number

  if (params.ageMonths < 12) {
    factor = isCat ? 2.5 : (params.ageMonths < 4 ? 3.0 : 2.0)
  } else if (params.healthConditions.includes('obesity')) {
    factor = isCat ? 0.8 : 1.2
  } else if (params.neutered) {
    factor = isCat ? 1.0 : 1.4
  } else if (params.activityLevel === 'high') {
    factor = isCat ? 1.4 : 1.8
  } else if (params.activityLevel === 'low') {
    factor = isCat ? 1.0 : 1.4
  } else {
    factor = isCat ? 1.2 : 1.6
  }

  const target = Math.round(rer * factor)
  return { min: Math.round(target * 0.9), max: Math.round(target * 1.1) }
}

// ── 标准选择 ──

function selectStandard(species: 'dog' | 'cat', ageMonths: number) {
  if (species === 'cat') return ageMonths < 12 ? AAFCO_CAT_KITTEN : AAFCO_CAT_ADULT
  return ageMonths < 12 ? AAFCO_DOG_PUPPY : AAFCO_DOG_ADULT
}

function getStandardKey(species: 'dog' | 'cat', ageMonths: number): AafcoStandard {
  if (species === 'cat') return ageMonths < 12 ? 'cat_kitten' : 'cat_adult'
  return ageMonths < 12 ? 'dog_puppy' : 'dog_adult'
}

// ── 主校验函数 ──

export function validateRecipe(
  ingredients: RecipeIngredientInput[],
  pet: PetParams
): ValidationResult {
  const targetCalories = calculateDER(pet)
  const standards      = selectStandard(pet.species, pet.ageMonths)
  const standardKey    = getStandardKey(pet.species, pet.ageMonths)
  const unknownIngredients: string[] = []

  const nutrients = {
    calories: 0, protein: 0, fat: 0, carbs: 0,
    calcium: 0, phosphorus: 0, omega3: 0, taurine: 0,
    vitaminA: 0, vitaminD: 0, zinc: 0, iodine: 0
  }

  for (const ing of ingredients) {
    const n100g: NutrientPer100g | undefined =
      ing.nutrientsOverride ??
      (ing.dbName ? findFood(ing.dbName, true)?.nutrients : undefined) ??
      findFood(ing.name, false)?.nutrients

    if (!n100g) {
      unknownIngredients.push(ing.dbName || ing.name)
      continue
    }

    const r = ing.amountG / 100
    nutrients.calories   += n100g.calories   * r
    nutrients.protein    += n100g.protein    * r
    nutrients.fat        += n100g.fat        * r
    nutrients.carbs      += n100g.carbs      * r
    nutrients.calcium    += n100g.calcium    * r
    nutrients.phosphorus += n100g.phosphorus * r
    nutrients.omega3     += n100g.omega3     * r
    nutrients.taurine    += n100g.taurine    * r
    nutrients.vitaminA   += n100g.vitaminA   * r
    nutrients.vitaminD   += n100g.vitaminD   * r
    nutrients.zinc       += n100g.zinc       * r
    nutrients.iodine     += n100g.iodine     * r
  }

  const cal     = nutrients.calories || 1
  const per1000 = 1000 / cal

  const aafco: AafcoCheck = {
    passed:     false,
    standard:   standardKey,
    protein:    { value: nutrients.protein    * per1000, min: standards.protein.min,                               ok: false },
    fat:        { value: nutrients.fat        * per1000, min: standards.fat.min,                                   ok: false },
    calcium:    { value: nutrients.calcium    * per1000, min: standards.calcium.min, max: standards.calcium.max,   ok: false },
    phosphorus: { value: nutrients.phosphorus * per1000, min: standards.phosphorus.min,                            ok: false },
    caPRatio:   { value: nutrients.phosphorus > 0 ? nutrients.calcium / nutrients.phosphorus : 0,
                  min: standards.caPRatio.min, max: standards.caPRatio.max,                                         ok: false },
    omega3:     { value: nutrients.omega3     * per1000, min: standards.omega3.min,                                ok: false },
    taurine:    { value: nutrients.taurine    * per1000, min: standards.taurine.min,                               ok: false },
  }

  aafco.protein.ok    = aafco.protein.value    >= aafco.protein.min
  aafco.fat.ok        = aafco.fat.value        >= aafco.fat.min
  aafco.calcium.ok    = aafco.calcium.value    >= aafco.calcium.min && aafco.calcium.value <= aafco.calcium.max
  aafco.phosphorus.ok = aafco.phosphorus.value >= aafco.phosphorus.min
  aafco.caPRatio.ok   = aafco.caPRatio.value   >= aafco.caPRatio.min && aafco.caPRatio.value <= aafco.caPRatio.max
  aafco.omega3.ok     = aafco.omega3.value     >= aafco.omega3.min
  aafco.taurine.ok    = standards.taurine.min === 0 || aafco.taurine.value >= standards.taurine.min

  aafco.passed = [
    aafco.protein.ok, aafco.fat.ok, aafco.calcium.ok,
    aafco.phosphorus.ok, aafco.caPRatio.ok, aafco.omega3.ok, aafco.taurine.ok
  ].every(Boolean)

  // ── 自动补全缺口 ──
  const supplements: SupplementRecommendation[] = []

  // 补钙
  if (!aafco.calcium.ok || !aafco.caPRatio.ok) {
    const targetCalcium = Math.max(
      nutrients.phosphorus * 1.2,
      (standards.calcium.min / 1000) * cal
    )
    const deficit = Math.max(0, targetCalcium - nutrients.calcium)
    if (deficit > 0) {
      const amountG = Math.ceil((deficit / 400) * 10) / 10
      supplements.push({ ingredient: 'calcium_carbonate', dbName: 'calcium_carbonate', amountG, reasonKey: 'supplement.reason.calcium_deficiency' })
      nutrients.calcium += amountG * 400
    }
  }

  // 补 Omega-3
  const targetOmega3 = Math.max(pet.weightKg * 50, (standards.omega3.min / 1000) * cal)
  if (nutrients.omega3 < targetOmega3) {
    const deficit = targetOmega3 - nutrients.omega3
    const amountG = Math.ceil((deficit / 300) * 10) / 10
    supplements.push({ ingredient: 'fish_oil', dbName: 'fish_oil', amountG, reasonKey: 'supplement.reason.omega3_deficiency' })
    nutrients.omega3 += amountG * 300
  }

  // 补牛磺酸（仅猫）
  if (pet.species === 'cat' && !aafco.taurine.ok) {
    const targetTaurine = (standards.taurine.min / 1000) * cal
    const deficit       = Math.max(0, targetTaurine - nutrients.taurine)
    if (deficit > 0) {
      const amountG = Math.ceil((deficit / 1000) * 100) / 100
      supplements.push({ ingredient: 'taurine_supplement', dbName: 'taurine_supplement', amountG, reasonKey: 'supplement.reason.taurine_deficiency' })
      nutrients.taurine += amountG * 1000
    }
  }

  // 补全后重新计算合规状态
  if (supplements.length > 0) {
    const p2 = 1000 / (nutrients.calories || 1)
    aafco.calcium.value  = nutrients.calcium  * p2
    aafco.omega3.value   = nutrients.omega3   * p2
    aafco.taurine.value  = nutrients.taurine  * p2
    aafco.caPRatio.value = nutrients.phosphorus > 0 ? nutrients.calcium / nutrients.phosphorus : 0
    aafco.calcium.ok     = aafco.calcium.value  >= aafco.calcium.min && aafco.calcium.value <= aafco.calcium.max
    aafco.omega3.ok      = aafco.omega3.value   >= aafco.omega3.min
    aafco.taurine.ok     = standards.taurine.min === 0 || aafco.taurine.value >= standards.taurine.min
    aafco.caPRatio.ok    = aafco.caPRatio.value >= aafco.caPRatio.min && aafco.caPRatio.value <= aafco.caPRatio.max
    aafco.passed         = [aafco.protein.ok, aafco.fat.ok, aafco.calcium.ok, aafco.phosphorus.ok, aafco.caPRatio.ok, aafco.omega3.ok, aafco.taurine.ok].every(Boolean)
  }

  const caloriesOk = nutrients.calories >= targetCalories.min && nutrients.calories <= targetCalories.max
  const failCount  = [aafco.protein.ok, aafco.fat.ok, aafco.calcium.ok, aafco.phosphorus.ok, aafco.caPRatio.ok, aafco.omega3.ok, aafco.taurine.ok].filter(v => !v).length

  const complianceLabel: ValidationResult['complianceLabel'] =
    failCount === 0 && caloriesOk ? 'compliant' :
    failCount <= 1               ? 'partial'    : 'non-compliant'

  const complianceLabelKey = `compliance.label.${complianceLabel}_${standardKey}`

  return {
    targetCalories,
    actualCalories: Math.round(nutrients.calories),
    caloriesOk,
    nutrients: {
      calories:   Math.round(nutrients.calories),
      protein:    Math.round(nutrients.protein   * 10) / 10,
      fat:        Math.round(nutrients.fat       * 10) / 10,
      carbs:      Math.round(nutrients.carbs     * 10) / 10,
      calcium:    Math.round(nutrients.calcium),
      phosphorus: Math.round(nutrients.phosphorus),
      omega3:     Math.round(nutrients.omega3),
      taurine:    Math.round(nutrients.taurine),
      vitaminA:   Math.round(nutrients.vitaminA),
      vitaminD:   Math.round(nutrients.vitaminD),
      zinc:       Math.round(nutrients.zinc * 10) / 10,
      iodine:     Math.round(nutrients.iodine),
    },
    aafco,
    supplements,
    unknownIngredients,
    complianceLabel,
    complianceLabelKey,
  }
}
