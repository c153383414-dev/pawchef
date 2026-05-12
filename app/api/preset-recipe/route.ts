import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// Supported locales that may have pre-baked translations in the DB
const SUPPORTED_LOCALES = ['zh', 'fr', 'es', 'ja', 'ko'] as const
type SupportedLocale = typeof SUPPORTED_LOCALES[number]

function applyTranslation(recipe: any, locale: string): any {
  if (locale === 'en') return recipe

  // Check for pre-baked translation in DB (zero AI cost)
  const tx = recipe.translations?.[locale as SupportedLocale]
  if (!tx) return recipe  // No translation stored yet — fall back to English

  return {
    ...recipe,
    title:     tx.title     ?? recipe.title,
    content:   tx.content   ?? recipe.content,
    nutrition: tx.nutrition ?? recipe.nutrition,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const species      = searchParams.get('species')      || 'dog'
  const weight_range = searchParams.get('weight_range') || 'medium'
  const age_range    = searchParams.get('age_range')    || 'adult'
  const locale       = searchParams.get('locale')       || 'en'

  const supabase = await createServerSupabaseClient()

  // Exact match first
  const { data: exact } = await supabase
    .from('preset_recipes')
    .select('*')
    .eq('species', species)
    .eq('weight_range', weight_range)
    .eq('age_range', age_range)
    .eq('health_condition', 'healthy')
    .limit(1)
    .single()

  if (exact) {
    return NextResponse.json(applyTranslation(exact, locale))
  }

  // Fallback: match only species
  const { data: fallback } = await supabase
    .from('preset_recipes')
    .select('*')
    .eq('species', species)
    .eq('health_condition', 'healthy')
    .limit(1)
    .single()

  if (!fallback) {
    return NextResponse.json({ error: 'No recipe found' }, { status: 404 })
  }

  return NextResponse.json(applyTranslation(fallback, locale))
}
