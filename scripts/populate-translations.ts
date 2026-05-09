/**
 * ONE-TIME setup script — run once to pre-bake translations into preset_recipes.translations
 * Usage: npx tsx scripts/populate-translations.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// ── Load env: system env vars > .env.local ───────────────────────────────────
const env: Record<string, string> = { ...(process.env as Record<string, string>) }
const envCandidates = [
  path.resolve(__dirname, '../.env.local'),
  path.resolve(__dirname, '../../../../.env.local'),
  path.resolve(__dirname, '../../../.env.local'),
]
const envPath = envCandidates.find(p => fs.existsSync(p))
if (envPath) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const eq = line.indexOf('=')
    if (eq < 1) return
    const k = line.slice(0, eq).trim()
    const v = line.slice(eq + 1).trim()
    if (!env[k]) env[k] = v
  })
}

const OPENROUTER_KEY = env['OPENROUTER_API_KEY'] || ''
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SECRET_KEY'])

// Use openai SDK (undici-based, Windows-compatible)
// Do NOT set HTTP-Referer — passing undefined as a header value causes 500s
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: OPENROUTER_KEY,
  defaultHeaders: { 'X-Title': 'PawChef' },
})

const LOCALES: Record<string, string> = {
  zh: 'Chinese (Simplified)',
  fr: 'French',
  es: 'Spanish',
  ja: 'Japanese',
  ko: 'Korean',
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function translateRecipe(recipe: any, langName: string): Promise<any> {
  const payload = { title: recipe.title, content: recipe.content, nutrition: recipe.nutrition }

  const resp = await openai.chat.completions.create({
    model: 'anthropic/claude-3-haiku-20240307',
    temperature: 0.1,
    max_tokens: 1500,
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
  })

  const text = resp.choices?.[0]?.message?.content || ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON in response: ${text.substring(0, 100)}`)
  return JSON.parse(match[0])
}

async function main() {
  console.log('OPENROUTER_KEY prefix:', OPENROUTER_KEY.substring(0, 20) + '...')

  const { data: recipes, error } = await supabase
    .from('preset_recipes')
    .select('id, title, content, nutrition, translations')

  if (error || !recipes) { console.error('DB error:', error?.message); process.exit(1) }

  const todo = recipes.filter(r =>
    !r.translations || Object.keys(r.translations).length < Object.keys(LOCALES).length
  )
  console.log(`Total: ${recipes.length}  |  Need translation: ${todo.length}\n`)

  let idx = 0
  for (const recipe of todo) {
    const translations: Record<string, any> = { ...(recipe.translations ?? {}) }

    for (const [code, name] of Object.entries(LOCALES)) {
      if (translations[code]) { console.log(`  skip ${code} (already done)`); continue }
      idx++
      try {
        console.log(`  [${idx}] "${recipe.title.substring(0, 45)}" → ${code}`)
        translations[code] = await translateRecipe(recipe, name)
        await sleep(300)
      } catch (e: any) {
        const detail = e.status
          ? `HTTP ${e.status}: ${JSON.stringify(e.error ?? e.message)}`
          : (e.cause ? `${e.message} → ${e.cause}` : e.message)
        console.error(`  ✗ ${code}: ${detail}`)
        await sleep(1000)
      }
    }

    const { error: upErr } = await supabase
      .from('preset_recipes').update({ translations }).eq('id', recipe.id)
    if (upErr) console.error(`  ✗ DB save failed:`, upErr.message)
    else console.log(`  ✓ saved\n`)
  }

  console.log('✅ Done — all translations stored in DB, zero runtime AI cost from now on.')
}

main().catch(console.error)
