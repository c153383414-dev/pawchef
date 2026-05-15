/**
 * Unit tests for validateConditionRecipe()
 *
 * Standards under test:
 *   Kidney   — Cline 2016 (ACVN); IRIS CKD 2023
 *   Pancreatitis — Kathrani JAVMA 2024 (dog); Forman ACVIM JVIM 2021 (cat)
 *   Diabetes — AAHA 2018/2022
 *   Obesity  — AAHA 2021
 */

import {
  validateConditionRecipe,
  CONDITION_STANDARDS,
  CONDITION_KEYS,
  type ConditionKey,
  type ConditionValidationResult,
} from '../lib/condition-standards'

// ─── helpers ────────────────────────────────────────────────────────────────

/** baseline "healthy" nutrients — all values well within any condition target */
const BASE = { protein: 120, fat: 25, carbs: 10, phosphorus: 800 }

function mkNutrients(overrides: Partial<typeof BASE>) {
  return { ...BASE, ...overrides }
}

// ─── metadata sanity ────────────────────────────────────────────────────────

describe('CONDITION_KEYS and CONDITION_STANDARDS', () => {
  test('CONDITION_KEYS contains exactly the 4 expected conditions', () => {
    expect(CONDITION_KEYS).toHaveLength(4)
    expect(CONDITION_KEYS).toEqual(
      expect.arrayContaining(['kidney', 'pancreatitis', 'diabetes', 'obesity']),
    )
  })

  test('every CONDITION_KEY has a matching entry in CONDITION_STANDARDS', () => {
    for (const key of CONDITION_KEYS) {
      expect(CONDITION_STANDARDS[key]).toBeDefined()
      expect(CONDITION_STANDARDS[key].citation).toBeTruthy()
      expect(CONDITION_STANDARDS[key].authorityShortDog).toBeTruthy()
      expect(CONDITION_STANDARDS[key].authorityShortCat).toBeTruthy()
    }
  })
})

// ─── return shape ────────────────────────────────────────────────────────────

describe('return shape', () => {
  test('returns all required fields', () => {
    const result = validateConditionRecipe(BASE, 'dog', 'kidney')
    const keys: (keyof ConditionValidationResult)[] = [
      'condition', 'authorityShort', 'citation', 'expertOpinion',
      'label', 'labelKey', 'failures', 'nutrients',
    ]
    for (const k of keys) {
      expect(result).toHaveProperty(k)
    }
  })

  test('labelKey matches pattern condition.label.{condition}_{label}', () => {
    const r1 = validateConditionRecipe(BASE, 'dog', 'kidney')
    expect(r1.labelKey).toBe('condition.label.kidney_within_range')

    const r2 = validateConditionRecipe(mkNutrients({ phosphorus: 1400 }), 'dog', 'kidney')
    expect(r2.labelKey).toBe('condition.label.kidney_attention_needed')
  })

  test('nutrients snapshot is rounded correctly', () => {
    const n = mkNutrients({ fat: 12.456, phosphorus: 1023.7, carbs: 18.9, protein: 77.3 })
    const result = validateConditionRecipe(n, 'dog', 'kidney')
    expect(result.nutrients.fatPer1000).toBe(12.5)        // 1 decimal
    expect(result.nutrients.phosphorusPer1000).toBe(1024) // integer
    expect(result.nutrients.carbsPer1000).toBe(19)        // integer
    expect(result.nutrients.proteinPer1000).toBe(77)      // integer
  })
})

// ─── KIDNEY ─────────────────────────────────────────────────────────────────

describe('kidney — dog', () => {
  const PHOS_MAX = 1200 // mg/1000kcal

  test('within_range when phosphorus exactly at limit', () => {
    const r = validateConditionRecipe(mkNutrients({ phosphorus: PHOS_MAX }), 'dog', 'kidney')
    expect(r.label).toBe('within_range')
    expect(r.failures).toHaveLength(0)
  })

  test('within_range when phosphorus is comfortably below limit', () => {
    const r = validateConditionRecipe(mkNutrients({ phosphorus: 800 }), 'dog', 'kidney')
    expect(r.label).toBe('within_range')
    expect(r.failures).toHaveLength(0)
  })

  test('attention_needed when phosphorus is 1 mg above limit', () => {
    const r = validateConditionRecipe(mkNutrients({ phosphorus: 1201 }), 'dog', 'kidney')
    expect(r.label).toBe('attention_needed')
    expect(r.failures).toHaveLength(1)
    expect(r.failures[0].metric).toBe('phosphorus')
    expect(r.failures[0].actual).toBe(1201)
    expect(r.failures[0].messageKey).toBe('condition.fail.phosphorus_high')
    expect(r.failures[0].targetDesc).toContain('1200')
  })

  test('attention_needed when phosphorus is clearly above limit (e.g. 1500)', () => {
    const r = validateConditionRecipe(mkNutrients({ phosphorus: 1500 }), 'dog', 'kidney')
    expect(r.label).toBe('attention_needed')
    expect(r.failures[0].actual).toBe(1500)
  })

  test('does NOT flag protein (no protein constraint for dog kidney)', () => {
    // dogs with CKD: no protein minimum defined in our standard
    const r = validateConditionRecipe(mkNutrients({ protein: 10 }), 'dog', 'kidney')
    const proteinFailure = r.failures.find(f => f.metric === 'protein')
    expect(proteinFailure).toBeUndefined()
  })

  test('authorityShort is IRIS / ACVN', () => {
    const r = validateConditionRecipe(BASE, 'dog', 'kidney')
    expect(r.authorityShort).toBe('IRIS / ACVN')
  })

  test('expertOpinion is false for dog kidney', () => {
    const r = validateConditionRecipe(BASE, 'dog', 'kidney')
    expect(r.expertOpinion).toBe(false)
  })
})

describe('kidney — cat', () => {
  const PHOS_MAX  = 1350 // mg/1000kcal
  const PROT_MIN  = 58   // g/1000kcal

  test('within_range when both phosphorus and protein are in range', () => {
    const r = validateConditionRecipe(mkNutrients({ phosphorus: 1000, protein: 80 }), 'cat', 'kidney')
    expect(r.label).toBe('within_range')
    expect(r.failures).toHaveLength(0)
  })

  test('within_range when phosphorus exactly at limit and protein exactly at minimum', () => {
    const r = validateConditionRecipe(mkNutrients({ phosphorus: PHOS_MAX, protein: PROT_MIN }), 'cat', 'kidney')
    expect(r.label).toBe('within_range')
    expect(r.failures).toHaveLength(0)
  })

  test('attention_needed when phosphorus exceeds cat limit (1350)', () => {
    const r = validateConditionRecipe(mkNutrients({ phosphorus: 1400 }), 'cat', 'kidney')
    expect(r.label).toBe('attention_needed')
    expect(r.failures.some(f => f.metric === 'phosphorus')).toBe(true)
  })

  test('attention_needed when protein below cat minimum (58 g/1000kcal)', () => {
    const r = validateConditionRecipe(mkNutrients({ protein: 50 }), 'cat', 'kidney')
    expect(r.label).toBe('attention_needed')
    const pf = r.failures.find(f => f.metric === 'protein')
    expect(pf).toBeDefined()
    expect(pf!.actual).toBe(50)
    expect(pf!.messageKey).toBe('condition.fail.protein_low')
    expect(pf!.targetDesc).toContain('58')
  })

  test('two failures when both phosphorus high AND protein low', () => {
    const r = validateConditionRecipe(
      mkNutrients({ phosphorus: 1500, protein: 40 }),
      'cat', 'kidney'
    )
    expect(r.failures).toHaveLength(2)
    expect(r.failures.map(f => f.metric).sort()).toEqual(['phosphorus', 'protein'])
  })

  test('cat phosphorus threshold (1350) is higher than dog threshold (1200)', () => {
    // 1300 mg is within cat range but outside dog range
    const catResult = validateConditionRecipe(mkNutrients({ phosphorus: 1300 }), 'cat', 'kidney')
    const dogResult = validateConditionRecipe(mkNutrients({ phosphorus: 1300 }), 'dog', 'kidney')
    expect(catResult.label).toBe('within_range')
    expect(dogResult.label).toBe('attention_needed')
  })
})

// ─── PANCREATITIS ────────────────────────────────────────────────────────────

describe('pancreatitis — dog', () => {
  const FAT_MAX = 35 // g/1000kcal

  test('within_range when fat exactly at limit', () => {
    const r = validateConditionRecipe(mkNutrients({ fat: FAT_MAX }), 'dog', 'pancreatitis')
    expect(r.label).toBe('within_range')
    expect(r.failures).toHaveLength(0)
  })

  test('within_range when fat is comfortably below limit', () => {
    const r = validateConditionRecipe(mkNutrients({ fat: 20 }), 'dog', 'pancreatitis')
    expect(r.label).toBe('within_range')
    expect(r.failures).toHaveLength(0)
  })

  test('attention_needed when fat exceeds 35 g/1000kcal', () => {
    const r = validateConditionRecipe(mkNutrients({ fat: 40 }), 'dog', 'pancreatitis')
    expect(r.label).toBe('attention_needed')
    const ff = r.failures.find(f => f.metric === 'fat')
    expect(ff).toBeDefined()
    expect(ff!.messageKey).toBe('condition.fail.fat_high')
    expect(ff!.targetDesc).toContain('35')
  })

  test('fat actual value is stored with 1 decimal place', () => {
    const r = validateConditionRecipe(mkNutrients({ fat: 36.789 }), 'dog', 'pancreatitis')
    expect(r.failures[0].actual).toBe(36.8)
  })

  test('expertOpinion is true for dog pancreatitis (Kathrani 2024 is expert opinion)', () => {
    const r = validateConditionRecipe(BASE, 'dog', 'pancreatitis')
    expect(r.expertOpinion).toBe(true)
  })

  test('authorityShort is JAVMA 2024 for dog', () => {
    const r = validateConditionRecipe(BASE, 'dog', 'pancreatitis')
    expect(r.authorityShort).toBe('JAVMA 2024')
  })
})

describe('pancreatitis — cat (ACVIM 2021: NO fat restriction)', () => {
  test('within_range even with very high fat (e.g. 100 g/1000kcal)', () => {
    const r = validateConditionRecipe(mkNutrients({ fat: 100 }), 'cat', 'pancreatitis')
    expect(r.label).toBe('within_range')
    expect(r.failures).toHaveLength(0)
  })

  test('within_range even with extreme fat (200 g/1000kcal)', () => {
    const r = validateConditionRecipe(mkNutrients({ fat: 200 }), 'cat', 'pancreatitis')
    expect(r.label).toBe('within_range')
    expect(r.failures).toHaveLength(0)
  })

  test('no fat failure metric present in result for cat', () => {
    const r = validateConditionRecipe(mkNutrients({ fat: 999 }), 'cat', 'pancreatitis')
    const fatFailure = r.failures.find(f => f.metric === 'fat')
    expect(fatFailure).toBeUndefined()
  })

  test('expertOpinion is false for cat pancreatitis', () => {
    const r = validateConditionRecipe(BASE, 'cat', 'pancreatitis')
    expect(r.expertOpinion).toBe(false)
  })

  test('authorityShort is ACVIM 2021 for cat', () => {
    const r = validateConditionRecipe(BASE, 'cat', 'pancreatitis')
    expect(r.authorityShort).toBe('ACVIM 2021')
  })

  test('cat pancreatitis has DIFFERENT label than dog for same high-fat recipe', () => {
    const highFat = mkNutrients({ fat: 50 })
    const catResult = validateConditionRecipe(highFat, 'cat', 'pancreatitis')
    const dogResult = validateConditionRecipe(highFat, 'dog', 'pancreatitis')
    expect(catResult.label).toBe('within_range')
    expect(dogResult.label).toBe('attention_needed')
  })
})

// ─── DIABETES ────────────────────────────────────────────────────────────────

describe('diabetes — cat (AAHA 2018)', () => {
  const CARBS_MAX  = 30  // g/1000kcal  (≈ 12% ME)
  const PROT_MIN   = 100 // g/1000kcal  (≈ 40% ME)

  test('within_range when carbs exactly at limit and protein exactly at minimum', () => {
    const r = validateConditionRecipe(
      mkNutrients({ carbs: CARBS_MAX, protein: PROT_MIN }),
      'cat', 'diabetes'
    )
    expect(r.label).toBe('within_range')
    expect(r.failures).toHaveLength(0)
  })

  test('within_range when carbs low and protein high', () => {
    const r = validateConditionRecipe(
      mkNutrients({ carbs: 10, protein: 150 }),
      'cat', 'diabetes'
    )
    expect(r.label).toBe('within_range')
    expect(r.failures).toHaveLength(0)
  })

  test('attention_needed when carbs exceed 30 g/1000kcal', () => {
    const r = validateConditionRecipe(
      mkNutrients({ carbs: 35, protein: 110 }),
      'cat', 'diabetes'
    )
    expect(r.label).toBe('attention_needed')
    const cf = r.failures.find(f => f.metric === 'carbs')
    expect(cf).toBeDefined()
    expect(cf!.messageKey).toBe('condition.fail.carbs_high')
    expect(cf!.targetDesc).toContain('30')
    expect(cf!.targetDesc).toContain('12%')
  })

  test('attention_needed when protein below 100 g/1000kcal', () => {
    const r = validateConditionRecipe(
      mkNutrients({ carbs: 15, protein: 80 }),
      'cat', 'diabetes'
    )
    expect(r.label).toBe('attention_needed')
    const pf = r.failures.find(f => f.metric === 'protein')
    expect(pf).toBeDefined()
    expect(pf!.messageKey).toBe('condition.fail.protein_low')
    expect(pf!.actual).toBe(80)
  })

  test('two failures when both carbs high AND protein low', () => {
    const r = validateConditionRecipe(
      mkNutrients({ carbs: 50, protein: 70 }),
      'cat', 'diabetes'
    )
    expect(r.failures).toHaveLength(2)
    expect(r.failures.map(f => f.metric).sort()).toEqual(['carbs', 'protein'])
  })

  test('authorityShort is AAHA 2018', () => {
    const r = validateConditionRecipe(BASE, 'cat', 'diabetes')
    expect(r.authorityShort).toBe('AAHA 2018')
  })
})

describe('diabetes — dog (AAHA 2018: no numeric constraint)', () => {
  test('always within_range regardless of carbs', () => {
    const r = validateConditionRecipe(mkNutrients({ carbs: 200 }), 'dog', 'diabetes')
    expect(r.label).toBe('within_range')
    expect(r.failures).toHaveLength(0)
  })

  test('always within_range regardless of protein', () => {
    const r = validateConditionRecipe(mkNutrients({ protein: 1 }), 'dog', 'diabetes')
    expect(r.label).toBe('within_range')
    expect(r.failures).toHaveLength(0)
  })

  test('always within_range regardless of fat', () => {
    const r = validateConditionRecipe(mkNutrients({ fat: 999 }), 'dog', 'diabetes')
    expect(r.label).toBe('within_range')
    expect(r.failures).toHaveLength(0)
  })
})

// ─── OBESITY ─────────────────────────────────────────────────────────────────

describe('obesity — dog and cat (AAHA 2021: calorie-only control)', () => {
  test('dog: always within_range — no macronutrient threshold', () => {
    const r = validateConditionRecipe(
      mkNutrients({ fat: 999, carbs: 999, protein: 1, phosphorus: 9999 }),
      'dog', 'obesity'
    )
    expect(r.label).toBe('within_range')
    expect(r.failures).toHaveLength(0)
  })

  test('cat: always within_range — no macronutrient threshold', () => {
    const r = validateConditionRecipe(
      mkNutrients({ fat: 999, carbs: 999, protein: 1, phosphorus: 9999 }),
      'cat', 'obesity'
    )
    expect(r.label).toBe('within_range')
    expect(r.failures).toHaveLength(0)
  })

  test('dog authorityShort is AAHA 2021', () => {
    const r = validateConditionRecipe(BASE, 'dog', 'obesity')
    expect(r.authorityShort).toBe('AAHA 2021')
  })

  test('cat authorityShort is AAHA 2021', () => {
    const r = validateConditionRecipe(BASE, 'cat', 'obesity')
    expect(r.authorityShort).toBe('AAHA 2021')
  })
})

// ─── cross-condition edge cases ───────────────────────────────────────────────

describe('cross-condition behavior', () => {
  test('condition field in result matches requested condition', () => {
    for (const cond of CONDITION_KEYS as ConditionKey[]) {
      const r = validateConditionRecipe(BASE, 'dog', cond)
      expect(r.condition).toBe(cond)
    }
  })

  test('citation is non-empty for all conditions', () => {
    for (const cond of CONDITION_KEYS as ConditionKey[]) {
      const r = validateConditionRecipe(BASE, 'cat', cond)
      expect(r.citation.length).toBeGreaterThan(10)
    }
  })

  test('failures array is empty (not undefined) when within range', () => {
    const r = validateConditionRecipe(BASE, 'dog', 'obesity')
    expect(Array.isArray(r.failures)).toBe(true)
    expect(r.failures).toHaveLength(0)
  })

  test('nutrients snapshot is always populated regardless of condition', () => {
    for (const cond of CONDITION_KEYS as ConditionKey[]) {
      const r = validateConditionRecipe(BASE, 'dog', cond)
      expect(typeof r.nutrients.phosphorusPer1000).toBe('number')
      expect(typeof r.nutrients.fatPer1000).toBe('number')
      expect(typeof r.nutrients.carbsPer1000).toBe('number')
      expect(typeof r.nutrients.proteinPer1000).toBe('number')
    }
  })
})
