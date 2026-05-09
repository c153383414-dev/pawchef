import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const species = searchParams.get('species') || 'dog'
  const weight_range = searchParams.get('weight_range') || 'medium'
  const age_range = searchParams.get('age_range') || 'adult'

  const supabase = await createServerSupabaseClient()

  // 先精确匹配
  const { data: exact } = await supabase
    .from('preset_recipes')
    .select('*')
    .eq('species', species)
    .eq('weight_range', weight_range)
    .eq('age_range', age_range)
    .eq('health_condition', 'healthy')
    .limit(1)
    .single()

  if (exact) return NextResponse.json(exact)

  // 没有精确匹配，退而求其次只匹配 species
  const { data: fallback } = await supabase
    .from('preset_recipes')
    .select('*')
    .eq('species', species)
    .eq('health_condition', 'healthy')
    .limit(1)
    .single()

  if (fallback) return NextResponse.json(fallback)

  return NextResponse.json({ error: 'No recipe found' }, { status: 404 })
}