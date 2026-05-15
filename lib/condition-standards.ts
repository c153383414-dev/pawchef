/**
 * 病症专属营养参考标准
 *
 * 数据来源（经交叉核对）：
 *
 * 肾病（CKD）：
 *   Cline MG. "Nutritional Management of Chronic Kidney Disease in Cats & Dogs."
 *   Today's Veterinary Practice, 2016. (ACVN / IRIS 分期背景)
 *   IRIS CKD Treatment Recommendations 2023 — 血清磷目标 (iris-kidney.com)
 *   注：IRIS 本身不发布饮食磷的 mg/1000kcal 数值；
 *       0.4–1.2 g/1000kcal（犬）/ 0.8–1.35 g/1000kcal（猫）来自治疗性肾病饲料描述范围
 *
 * 胰腺炎（猫）：
 *   Forman et al. "ACVIM Consensus Statement on pancreatitis in cats."
 *   JVIM 2021. PMC7995362.
 *   结论：无科学证据表明限脂对猫胰腺炎有益，多数专家组成员不建议限脂
 *
 * 胰腺炎（犬）：
 *   Kathrani A. "Nutritional management of pancreatitis and concurrent disease
 *   in dogs and cats." JAVMA 262(6), 2024.
 *   注：犬胰腺炎低脂建议为专家意见，非 RCT 临床对照证据
 *
 * 糖尿病：
 *   AAHA Diabetes Management Guidelines for Dogs and Cats 2018/2022
 *   猫：约 12% ME 碳水 = 30 g/1000kcal
 *
 * 肥胖：
 *   AAHA Nutrition and Weight Management Guidelines 2021
 *   建议：理想体重 RER × 80%；本系统以当前体重 DER × 0.8 近似
 *   猫：注意肝脂肪沉积风险，减重速度不超过每周 2%
 */

export type ConditionKey = 'kidney' | 'pancreatitis' | 'diabetes' | 'obesity'

export const CONDITION_KEYS: ConditionKey[] = ['kidney', 'pancreatitis', 'diabetes', 'obesity']

// ── 营养目标定义 ─────────────────────────────────────────────────────────────

export interface ConditionNutrientTargets {
  phosphorus?: { max: number }    // mg / 1000 kcal
  fat?:        { max: number }    // g  / 1000 kcal
  carbs?:      { maxG: number }   // g  / 1000 kcal（12% ME ≈ 30 g/1000kcal）
  protein?:    { min?: number; max?: number } // g / 1000 kcal
}

export interface ConditionStandard {
  /** 完整文献引用 */
  citation: string
  /** UI 显示的权威机构简称（犬） */
  authorityShortDog: string
  /** UI 显示的权威机构简称（猫） */
  authorityShortCat: string
  /** 是否需要"专家意见"注解（犬胰腺炎） */
  expertOpinionDog?: boolean
  dog: ConditionNutrientTargets
  cat: ConditionNutrientTargets
}

export const CONDITION_STANDARDS: Record<ConditionKey, ConditionStandard> = {

  kidney: {
    citation:
      'Cline MG, Today\'s Veterinary Practice 2016 (ACVN); IRIS CKD Treatment Recommendations 2023',
    authorityShortDog: 'IRIS / ACVN',
    authorityShortCat: 'IRIS / ACVN',
    dog: {
      // 治疗性肾病饲料范围上限：1.2 g/1000kcal = 1200 mg/1000kcal
      phosphorus: { max: 1200 },
    },
    cat: {
      // 治疗性肾病饲料范围上限：1.35 g/1000kcal = 1350 mg/1000kcal
      phosphorus: { max: 1350 },
      // 猫不宜过度限制蛋白质，防止肌肉流失
      protein: { min: 58 },
    },
  },

  pancreatitis: {
    citation:
      'Kathrani A, JAVMA 262(6) 2024 (犬，专家意见); Forman et al, ACVIM Consensus JVIM 2021 (猫)',
    authorityShortDog: 'JAVMA 2024',
    authorityShortCat: 'ACVIM 2021',
    expertOpinionDog:  true,
    dog: {
      // < 15% DM 脂肪（非高甘油三酯犬）≈ < 35 g/1000kcal
      // Kathrani 2024；专家意见，非 RCT 证据
      fat: { max: 35 },
    },
    cat: {
      // ACVIM 2021：无科学证据表明限脂对猫胰腺炎有益
      // 猫的目标：保持热量摄入，不设脂肪上限
    },
  },

  diabetes: {
    citation: 'AAHA Diabetes Management Guidelines for Dogs and Cats 2018 / 2022',
    authorityShortDog: 'AAHA 2018',
    authorityShortCat: 'AAHA 2018',
    dog: {
      // AAHA 2018：无具体碳水数值目标，重点为高膳食纤维（可溶 + 不可溶）
      // 不设数值约束，通过 AI prompt 引导
    },
    cat: {
      // AAHA 2018：约 12% ME 碳水 = 30 g/1000kcal
      carbs:   { maxG: 30 },
      // ≥ 40% ME 蛋白质 = 100 g/1000kcal
      protein: { min: 100 },
    },
  },

  obesity: {
    citation: 'AAHA Nutrition and Weight Management Guidelines 2021',
    authorityShortDog: 'AAHA 2021',
    authorityShortCat: 'AAHA 2021',
    dog: {
      // 热量已由 calculateDER 中的 obesity 因子控制（RER × 0.8）
      // 无额外宏量营养素数值约束
    },
    cat: {
      // 同犬；猫减重需防止肝脂肪沉积，减重速度≤每周 2%
    },
  },

}

// ── 条件验证结果类型 ─────────────────────────────────────────────────────────

export interface ConditionFailure {
  metric:      'phosphorus' | 'fat' | 'carbs' | 'protein'
  actual:      number
  targetDesc:  string
  messageKey:  string
}

export interface ConditionValidationResult {
  condition:      ConditionKey
  authorityShort: string
  citation:       string
  expertOpinion:  boolean
  label:          'within_range' | 'attention_needed'
  labelKey:       string
  failures:       ConditionFailure[]
  nutrients: {
    phosphorusPer1000: number
    fatPer1000:        number
    carbsPer1000:      number
    proteinPer1000:    number
  }
}

// ── 验证函数 ─────────────────────────────────────────────────────────────────

/**
 * 根据病症标准验证食谱营养数值（per 1000 kcal）
 * @param nutrientsPer1000 各营养素 per 1000 kcal 值
 * @param species          'dog' | 'cat'
 * @param condition        病症 key
 */
export function validateConditionRecipe(
  nutrientsPer1000: {
    protein:    number
    fat:        number
    carbs:      number
    phosphorus: number
  },
  species:   'dog' | 'cat',
  condition: ConditionKey,
): ConditionValidationResult {
  const standard   = CONDITION_STANDARDS[condition]
  const targets    = species === 'cat' ? standard.cat : standard.dog
  const failures: ConditionFailure[] = []

  if (targets.phosphorus?.max !== undefined &&
      nutrientsPer1000.phosphorus > targets.phosphorus.max) {
    failures.push({
      metric:     'phosphorus',
      actual:     Math.round(nutrientsPer1000.phosphorus),
      targetDesc: `< ${targets.phosphorus.max} mg/1000kcal`,
      messageKey: 'condition.fail.phosphorus_high',
    })
  }

  if (targets.fat?.max !== undefined &&
      nutrientsPer1000.fat > targets.fat.max) {
    failures.push({
      metric:     'fat',
      actual:     Math.round(nutrientsPer1000.fat * 10) / 10,
      targetDesc: `< ${targets.fat.max} g/1000kcal`,
      messageKey: 'condition.fail.fat_high',
    })
  }

  if (targets.carbs?.maxG !== undefined &&
      nutrientsPer1000.carbs > targets.carbs.maxG) {
    failures.push({
      metric:     'carbs',
      actual:     Math.round(nutrientsPer1000.carbs),
      targetDesc: `< ${targets.carbs.maxG} g/1000kcal (≈12% ME)`,
      messageKey: 'condition.fail.carbs_high',
    })
  }

  if (targets.protein?.min !== undefined &&
      nutrientsPer1000.protein < targets.protein.min) {
    failures.push({
      metric:     'protein',
      actual:     Math.round(nutrientsPer1000.protein),
      targetDesc: `≥ ${targets.protein.min} g/1000kcal`,
      messageKey: 'condition.fail.protein_low',
    })
  }

  const label: 'within_range' | 'attention_needed' =
    failures.length === 0 ? 'within_range' : 'attention_needed'

  const authorityShort = species === 'cat'
    ? standard.authorityShortCat
    : standard.authorityShortDog

  return {
    condition,
    authorityShort,
    citation:      standard.citation,
    expertOpinion: species === 'dog' ? (standard.expertOpinionDog ?? false) : false,
    label,
    labelKey:      `condition.label.${condition}_${label}`,
    failures,
    nutrients: {
      phosphorusPer1000: Math.round(nutrientsPer1000.phosphorus),
      fatPer1000:        Math.round(nutrientsPer1000.fat * 10) / 10,
      carbsPer1000:      Math.round(nutrientsPer1000.carbs),
      proteinPer1000:    Math.round(nutrientsPer1000.protein),
    },
  }
}
