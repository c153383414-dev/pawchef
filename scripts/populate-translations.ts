/**
 * ONE-TIME setup script — run once to pre-bake Chinese (and other locale)
 * translations into the preset_recipes.translations column.
 *
 * After this runs, the API serves translations directly from DB with zero AI cost.
 *
 * Usage:
 *   npx tsx scripts/populate-translations.ts
 *
 * Requirements:
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local
 *   - OPENROUTER_API_KEY in .env.local  (used ONLY for this one-time run)
 *   - Run the SQL migration first:  supabase/add-translations-column.sql
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// ── Load env from .env.local ────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env.local')
const env: Record<string, string> = {}
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const [k, ...rest] = line.split('=')
  if (k) env[k.trim()] = rest.join('=').trim()
})

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SECRET_KEY'])
const openai   = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey:  env['OPENROUTER_API_KEY'],
  defaultHeaders: { 'HTTP-Referer': env['NEXT_PUBLIC_SITE_URL'], 'X-Title': 'PawChef' },
})

const LOCALES: Record<string, string> = {
  zh: 'Chinese (Simplified)',
  fr: 'French',
  es: 'Spanish',
  ja: 'Japanese',
  ko: 'Korean',
}

async function translateRecipe(recipe: any, langCode: string, langName: string) {
  const payload = {
    title:     recipe.title,
    content:   recipe.content,
    nutrition: recipe.nutrition,
  }

  const resp = await openai.chat.completions.create({
    model: 'anthropic/claude-haiku-4-5',   // cheapest model — translation only
    messages: [{
      role: 'user',
      content: `Translate this pet food recipe JSON to ${langName}. Rules:
- Keep all emojis exactly as-is
- Keep all numbers and units (g, kg, ml, kcal) exactly as-is
- Keep ALL JSON keys exactly as-is — only translate string values
- "standard" field → AAFCO compliance phrase in ${langName}
- Return ONLY the translated JSON, no commentary

${JSON.stringify(payload)}`,
    }],
    max_tokens: 1500,
    temperature: 0.1,
  })

  const text = resp.choices[0]?.message?.content || ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON in response for ${langCode}`)
  return JSON.parse(match[0])
}

async function main() {
  const { data: recipes, error } = await supabase
    .from('preset_recipes')
    .select('id, title, content, nutrition, translations')

  if (error || !recipes) { console.error('DB error:', error?.message); process.exit(1) }

  const todo = recipes.filter(r => !r.translations || Object.keys(r.translations).length < Object.keys(LOCALES).length)
  console.log(`Total: ${recipes.length}  |  Need translation: ${todo.length}`)

  let done = 0
  for (const recipe of todo) {
    const existing: Record<string, any> = recipe.translations ?? {}
    const translations: Record<string, any> = { ...existing }

    for (const [code, name] of Object.entries(LOCALES)) {
      if (translations[code]) { console.log(`  [${recipe.id}] ${code} already done, skip`); continue }
      try {
        console.log(`  Translating [${++done}/${todo.length}] "${recipe.title.substring(0, 40)}" → ${code}`)
        translations[code] = await translateRecipe(recipe, code, name)
        // Small delay to respect rate limits
        await new Promise(r => setTimeout(r, 300))
      } catch (e: any) {
        console.error(`  ✗ ${code}: ${e.message}`)
      }
    }

    const { error: updateErr } = await supabase
      .from('preset_recipes')
      .update({ translations })
      .eq('id', recipe.id)

    if (updateErr) console.error(`  ✗ DB update failed for ${recipe.id}:`, updateErr.message)
    else console.log(`  ✓ Saved translations for "${recipe.title.substring(0, 40)}"`)
  }

  console.log('\n✅ Done. All recipes now have pre-baked translations in DB.')
  console.log('The API will serve them at zero AI cost from now on.')
}

main().catch(console.error)
