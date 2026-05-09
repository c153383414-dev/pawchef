import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import OpenAI from 'openai'

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL,
    'X-Title': 'PawChef'
  }
})

const LANGUAGE_MAP: Record<string, string> = {
  'zh': 'Chinese (Simplified)',
  'es': 'Spanish',
  'fr': 'French',
  'ja': 'Japanese',
  'ko': 'Korean',
}

async function translateRecipe(recipe: any, locale: string): Promise<any> {
  const language = LANGUAGE_MAP[locale]
  if (!language) return recipe

  try {
    const completion = await openai.chat.completions.create({
      model: 'anthropic/claude-sonnet-4-5',
      messages: [{
        role: 'user',
        content: `Translate this pet food recipe JSON to ${language}. Rules:
- Keep all emojis exactly as-is
- Keep all numbers and units (g, kg, ml, kcal) exactly as-is
- Keep the JSON structure and all key names exactly as-is
- Only translate the text values: title, ingredient names, step descriptions, warnings, notes
- "standard" field value should be the AAFCO compliance phrase in ${language}
- Return ONLY the translated JSON, no explanation

${JSON.stringify(recipe)}`
      }],
      max_tokens: 1200,
      temperature: 0.1,
    })

    const text = completion.choices[0]?.message?.content || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return recipe
    return JSON.parse(jsonMatch[0])
  } catch {
    // Fall back to original (English) on any error
    return recipe
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const species = searchParams.get('species') || 'dog'
  const weight_range = searchParams.get('weight_range') || 'medium'
  const age_range = searchParams.get('age_range') || 'adult'
  const locale = searchParams.get('locale') || 'en'

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

  const recipe = exact ?? null

  if (recipe) {
    if (locale === 'en' || !LANGUAGE_MAP[locale]) return NextResponse.json(recipe)
    return NextResponse.json(await translateRecipe(recipe, locale))
  }

  // 没有精确匹配，退而求其次只匹配 species
  const { data: fallback } = await supabase
    .from('preset_recipes')
    .select('*')
    .eq('species', species)
    .eq('health_condition', 'healthy')
    .limit(1)
    .single()

  if (!fallback) return NextResponse.json({ error: 'No recipe found' }, { status: 404 })

  if (locale === 'en' || !LANGUAGE_MAP[locale]) return NextResponse.json(fallback)
  return NextResponse.json(await translateRecipe(fallback, locale))
}
