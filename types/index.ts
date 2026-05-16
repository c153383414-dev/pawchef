export interface Profile {
  id: string
  email: string
  display_name: string
  is_pro: boolean
  pro_expires_at: string | null
  // 旧字段（兼容保留）
  points: number
  // 新积分字段
  free_points: number       // 免费积分：签到/分享/邀请，仅用于导出报告
  paid_points: number       // AI积分：购买积分包
  gift_ai_points: number    // 会员赠送AI积分（月底清零）
  // 使用次数
  monthly_ai_count: number  // 当月已用AI次数
  count_reset_at: string | null
  last_checkin_date: string | null
  created_at: string
  // 免费AI次数（新增）
  free_ai_used: number      // 已用免费AI次数（默认0）
  free_ai_limit: number     // 免费次数上限（默认2）
  disclaimer_ack?: boolean  // 是否已确认免责声明
}

export interface Pet {
  id: string
  user_id: string
  name: string
  species: 'dog' | 'cat'
  breed?: string
  age_months?: number
  weight_kg?: number
  gender?: string
  neutered?: boolean
  health_conditions: string[]
  allergens: string[]
  created_at: string
}

export interface Recipe {
  id: string
  user_id: string
  pet_id?: string
  title: string
  content: RecipeContent
  nutrition?: NutritionInfo
  is_saved: boolean
  created_at: string
}

export interface RecipeContent {
  ingredients: Ingredient[]
  steps: string[]
  warnings?: string[]
  notes?: string
}

export interface Ingredient {
  emoji:      string
  name:       string          // 当前语言的食材名（展示用）
  dbName?:    string          // nutrition-db 中的固定 key（查表用）
  amount:     string          // 展示用字符串，如 "30g"
  amountG?:   number          // 数字克重
  category?:  'protein' | 'organ' | 'veggie' | 'carb' | 'supplement' | 'oil'
  autoAdded?: boolean         // true = validator 自动追加
  reasonKey?: string          // autoAdded 时的 i18n reason key
}

export interface SubstituteItem {
  name:               string
  dbName?:            string
  amount:             string
  amountG?:           number
  emoji:              string
  reason:             string
  nutrition_note:     string
  autoFallback?:      boolean
  newSteps?:          string[]    // 替换后重新生成的烹饪步骤
  nutritionWarnings?: string[]    // ['protein_low','fat_low','non_compliant'] 软警告
}

export interface NutritionInfo {
  calories: string
  protein:  string
  fat:      string
  carbs:    string
  // standard 字段已移除，合规信息由 compliance 对象提供
}

export interface AafcoMetric {
  value: number
  min:   number
  max?:  number
  ok:    boolean
}

export interface RecipeCompliance {
  label:                'compliant' | 'partial' | 'non-compliant'
  labelKey:             string
  caloriesOk:           boolean
  targetCalories:       { min: number; max: number }
  autoAddedSupplements: Array<{ ingredient: string; dbName: string; amountG: number; reasonKey: string }>
  aafcoDetails?: {
    protein:    AafcoMetric
    fat:        AafcoMetric
    calcium:    AafcoMetric
    phosphorus: AafcoMetric
    caPRatio:   AafcoMetric
    omega3:     AafcoMetric
    taurine:    AafcoMetric
  }
}

export type DeductSource =
  | 'free_ai_quota'
  | 'gift_ai_points'
  | 'paid_points'
  | 'pro_monthly'
  | 'guest'

export interface PointTransaction {
  id: string
  user_id: string
  amount: number
  type: string
  description: string
  created_at: string
}

export type HealthCondition =
  | 'healthy'
  | 'kidney'
  | 'pancreatitis'
  | 'diabetes'
  | 'obesity'
  | 'allergy'
