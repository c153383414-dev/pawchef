import { NextRequest, NextResponse } from 'next/server'
import { searchIngredient } from '@/lib/safety-db'
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
  'zh': 'Chinese',
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'ja': 'Japanese',
  'ko': 'Korean',
}

// Module-level cache: key = "query:locale", value = translated result
// Works per server instance (sufficient for Next.js Edge/Node deployments)
const resultCache = new Map<string, any>()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || ''
  const locale = searchParams.get('locale') || 'zh'

  if (!q) return NextResponse.json({ level: 'unknown' })

  const cacheKey = `${q.toLowerCase()}:${locale}`
  if (resultCache.has(cacheKey)) {
    return NextResponse.json(resultCache.get(cacheKey))
  }

  // 1. Direct search (works for Chinese + English + multilingual aliases)
  let result = searchIngredient(q)

  // 2. If not found and locale is not zh/en, try AI-assisted query translation
  //    e.g. "bœuf" → "beef", "viande rouge" → "beef"
  if (!result && !['zh', 'en'].includes(locale)) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'anthropic/claude-sonnet-4-5',
        messages: [{
          role: 'user',
          content: `A user is looking up a pet food ingredient safety check. The UI language is ${LANGUAGE_MAP[locale]}. The search query is: "${q}"\n\nWhat is the English name of this ingredient? Reply with ONLY the English ingredient name (1-3 words), nothing else. If you cannot identify it, reply "unknown".`
        }],
        max_tokens: 15,
        temperature: 0,
      })
      const englishName = completion.choices[0]?.message?.content?.trim().toLowerCase()
      if (englishName && englishName !== 'unknown') {
        result = searchIngredient(englishName)
      }
    } catch {
      // Ignore translation errors — fall through to unknown
    }
  }

  if (!result) {
    const unknown = { level: 'unknown' }
    resultCache.set(cacheKey, unknown)
    return NextResponse.json(unknown)
  }

  // 3. Return result with appropriate language content
  if (locale === 'zh') {
    // DB is in Chinese — return as-is
    resultCache.set(cacheKey, result)
    return NextResponse.json(result)
  }

  if (locale === 'en') {
    // Return with English fields substituted
    const enResult = {
      ...result,
      message: result.messageEn || result.message,
      kidneyWarning: result.kidneyWarningEn || result.kidneyWarning,
      pancreatitisWarning: result.pancreatitisWarningEn || result.pancreatitisWarning,
    }
    resultCache.set(cacheKey, enResult)
    return NextResponse.json(enResult)
  }

  // 4. For fr/es/ja/ko: translate English content to target language
  const language = LANGUAGE_MAP[locale] || 'English'
  const fieldsToTranslate: Record<string, string> = {}

  if (result.messageEn)             fieldsToTranslate.message = result.messageEn
  if (result.kidneyWarningEn)       fieldsToTranslate.kidneyWarning = result.kidneyWarningEn
  if (result.pancreatitisWarningEn) fieldsToTranslate.pancreatitisWarning = result.pancreatitisWarningEn

  if (Object.keys(fieldsToTranslate).length === 0) {
    const fallback = { ...result, message: result.messageEn || result.message }
    resultCache.set(cacheKey, fallback)
    return NextResponse.json(fallback)
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'anthropic/claude-sonnet-4-5',
      messages: [{
        role: 'user',
        content: `Translate the following pet food safety information from English to ${language}. Keep it concise and natural. Return ONLY valid JSON with the same keys, nothing else:\n${JSON.stringify(fieldsToTranslate)}`
      }],
      max_tokens: 400,
      temperature: 0.1,
    })

    const text = completion.choices[0]?.message?.content || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const translated = JSON.parse(jsonMatch[0])
      const translatedResult = {
        ...result,
        message:             translated.message             ?? result.messageEn             ?? result.message,
        kidneyWarning:       translated.kidneyWarning       ?? result.kidneyWarningEn       ?? result.kidneyWarning,
        pancreatitisWarning: translated.pancreatitisWarning ?? result.pancreatitisWarningEn ?? result.pancreatitisWarning,
      }
      resultCache.set(cacheKey, translatedResult)
      return NextResponse.json(translatedResult)
    }
  } catch {
    // Fall back to English on translation error
  }

  const fallback = {
    ...result,
    message:             result.messageEn             ?? result.message,
    kidneyWarning:       result.kidneyWarningEn       ?? result.kidneyWarning,
    pancreatitisWarning: result.pancreatitisWarningEn ?? result.pancreatitisWarning,
  }
  resultCache.set(cacheKey, fallback)
  return NextResponse.json(fallback)
}
