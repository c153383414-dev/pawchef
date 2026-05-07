export interface Profile {
  id: string
  email: string
  display_name: string
  is_pro: boolean
  pro_expires_at: string | null
  points: number
  created_at: string
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
