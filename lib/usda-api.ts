import { createServerSupabaseClient } from '@/lib/supabase-server'
import { findFood, NutrientPer100g } from './nutrition-db'

const USDA_API_KEY = process.env.USDA_API_KEY

interface ResolvedIngredient {
  name:               string
  dbName:             string
  amountG:            number
  nutrientsOverride?: NutrientPer100g
}

export async function resolveUnknownIngredients(
  ingredients: Array<{ name: string; dbName: string; amountG: number }>
): Promise<ResolvedIngredient[]> {
  const supabase = await createServerSupabaseClient()
  const resolved: ResolvedIngredient[] = []

  for (const ing of ingredients) {
    // Skip ingredients already in local nutrition DB — trust curated data over USDA
    // Try: 1) exact dbName match  2) fuzzy name match  3) fuzzy dbName match (catches 'turkey_meat' → turkey_breast)
    const localMatch = findFood(ing.dbName, true)
                    || findFood(ing.name, false)
                    || findFood(ing.dbName, false)
    if (localMatch) {
      resolved.push(ing)
      continue
    }

    // 1. 查 Supabase 缓存
    try {
      const { data: cached } = await supabase
        .from('nutrition_cache')
        .select('nutrients')
        .eq('db_name', ing.dbName)
        .single()
      if (cached) {
        resolved.push({ ...ing, nutrientsOverride: cached.nutrients })
        continue
      }
    } catch {}

    // 2. 查 USDA API（仅在配置了 API key 时调用）
    if (USDA_API_KEY) {
      try {
        const usdaData = await fetchFromUSDA(ing.dbName)
        if (usdaData) {
          await supabase.from('nutrition_cache').upsert({
            db_name:    ing.dbName,
            name_en:    ing.name,
            nutrients:  usdaData,
            created_at: new Date().toISOString(),
          })
          resolved.push({ ...ing, nutrientsOverride: usdaData })
          continue
        }
      } catch {}
    }

    // 3. 同类平均值兜底
    resolved.push({ ...ing, nutrientsOverride: getCategoryAverage(ing.dbName) })
  }
  return resolved
}

async function fetchFromUSDA(dbName: string): Promise<NutrientPer100g | null> {
  const query = dbName.replace(/_/g, ' ')
  const url   = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=1&api_key=${USDA_API_KEY}`
  const res   = await fetch(url, { next: { revalidate: 86400 } })
  if (!res.ok) return null
  const data  = await res.json()
  const food  = data.foods?.[0]
  if (!food) return null

  const get = (name: string): number => {
    const n = food.foodNutrients?.find((fn: any) =>
      fn.nutrientName?.toLowerCase().includes(name.toLowerCase())
    )
    return Math.round((n?.value || 0) * 10) / 10
  }

  return {
    calories:   get('energy'),
    protein:    get('protein'),
    fat:        get('total lipid'),
    carbs:      get('carbohydrate'),
    calcium:    get('calcium'),
    phosphorus: get('phosphorus'),
    omega3:     get('18:3'),
    taurine:    get('taurine') || 0,
    vitaminA:   get('vitamin a'),
    vitaminD:   get('vitamin d'),
    zinc:       get('zinc'),
    iodine:     get('iodine'),
  }
}

function getCategoryAverage(dbName: string): NutrientPer100g {
  if (dbName.includes('liver') || dbName.includes('organ'))
    return { calories: 130, protein: 18, fat: 5, carbs: 1, calcium: 10, phosphorus: 250, omega3: 50, taurine: 100, vitaminA: 5000, vitaminD: 30, zinc: 3, iodine: 10 }
  if (dbName.includes('fish') || dbName.includes('tuna') || dbName.includes('sardine'))
    return { calories: 150, protein: 22, fat: 6, carbs: 0, calcium: 15, phosphorus: 220, omega3: 800, taurine: 100, vitaminA: 20, vitaminD: 200, zinc: 1, iodine: 50 }
  if (dbName.includes('veggie') || dbName.includes('leaf') || dbName.includes('green'))
    return { calories: 35, protein: 2, fat: 0.3, carbs: 7, calcium: 40, phosphorus: 45, omega3: 0, taurine: 0, vitaminA: 200, vitaminD: 0, zinc: 0.3, iodine: 5 }
  return { calories: 150, protein: 25, fat: 5, carbs: 0, calcium: 15, phosphorus: 200, omega3: 50, taurine: 50, vitaminA: 0, vitaminD: 0, zinc: 2, iodine: 7 }
}
