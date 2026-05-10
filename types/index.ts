export interface Profile {
  id: string
  email: string
  display_name: string
  is_pro: boolean
  pro_expires_at: string | null
  // 旧字段（兼容保留）
  points: number
  // 新积分字段
  free_points: number       // 免费积分：签到/分享/邀请
  paid_points: number       // AI积分：购买积分包
  gift_ai_points: number    // 会员赠送AI积分（月底清零）
  // 使用次数
  monthly_ai_count: number  // 当月已用AI次数
  count_reset_at: string | null
  last_checkin_date: string | null
  created_at: string
  // 免费AI次数（新增）
  free_ai_used: number      // 已用免费AI次数（默认0）
  free_ai_limit: number     // 免费次数上限（默认3）
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
  emoji: string
  name: string
  amount: string
}
 
export interface NutritionInfo {
  calories: string
  protein: string
  fat: string
  carbs: string
  standard: string
}
 
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
