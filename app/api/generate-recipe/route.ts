import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import OpenAI from 'openai'

// Single OpenAI-compatible client pointing to OpenRouter
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: { 'X-Title': 'PawChef' }
})

const LANGUAGE_MAP: Record<string, string> = {
  en: 'English',
  zh: 'Chinese (Simplified)',
  es: 'Spanish',
  fr: 'French',
  ja: 'Japanese',
  ko: 'Korean',
}

// Free/standard tier: Llama 3.1 8B (completely free on OpenRouter)
const MODEL_STANDARD = 'meta-llama/llama-3.1-8b-instruct:free'
// Paid/premium tier uses Claude Sonnet (~$0.015/call)
const MODEL_PREMIUM  = 'anthropic/claude-sonnet-4-5'

type DeductionSource = 'guest' | 'free' | 'gift' | 'paid' | 'pro'

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    const {
      species, petName, weight, age, healthConditions, locale,
      guestToken, fingerprint,
    } = await req.json()

    const language = LANGUAGE_MAP[locale] || 'English'
    const ip = getClientIp(req)

    // ── Step 1-5: determine deduction source & model ──────────────────────────
    let selectedModel: string = MODEL_PREMIUM
    let deductionSource: DeductionSource = 'gift'
    let freeRemaining = 0   // returned to client for UI

    if (!user) {
      // ── Step 1: Guest (no account) ──────────────────────────────────────────
      if (!guestToken) {
        return NextResponse.json({ error: 'GUEST_TOKEN_MISSING' }, { status: 400 })
      }

      const filters = [`token.eq.${guestToken}`]
      if (ip !== 'unknown') filters.push(`ip.eq.${ip}`)
      if (fingerprint)      filters.push(`fingerprint.eq.${fingerprint}`)

      const { data: existing } = await supabase
        .from('guest_usage')
        .select('id')
        .or(filters.join(','))
        .limit(1)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ error: 'GUEST_LIMIT_REACHED' }, { status: 402 })
      }

      selectedModel    = MODEL_STANDARD
      deductionSource  = 'guest'

    } else {
      // ── Step 2-5: Logged-in user ────────────────────────────────────────────
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('free_ai_used, free_ai_limit, gift_ai_points, paid_points, is_pro, monthly_ai_count')
        .eq('id', user.id)
        .single()

      if (profileErr || !profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 400 })
      }

      const freeUsed  = profile.free_ai_used  ?? 0
      const freeLimit = profile.free_ai_limit ?? 3

      if (freeUsed < freeLimit) {
        // Step 2: free AI quota (Gemini)
        selectedModel   = MODEL_STANDARD
        deductionSource = 'free'
        freeRemaining   = freeLimit - freeUsed - 1
      } else if ((profile.gift_ai_points ?? 0) > 0) {
        // Step 3: gifted points (Claude)
        deductionSource = 'gift'
      } else if ((profile.paid_points ?? 0) > 0) {
        // Step 4: purchased points (Claude)
        deductionSource = 'paid'
      } else if (profile.is_pro && (profile.monthly_ai_count ?? 0) < 30) {
        // Step 5: Pro monthly quota (Claude)
        deductionSource = 'pro'
      } else {
        return NextResponse.json({ error: 'NO_CREDITS' }, { status: 402 })
      }
    }

    // ── For paid/gift/pro: deduct BEFORE generating (atomic, prevents abuse) ──
    // ── For guest/free: deduct AFTER generating succeeds (so AI failures don't
    //    waste the user's free quota)                                           ──
    let creditSource: string | null = null

    if (deductionSource === 'free') {
      const { data: freeResult, error: freeErr } = await supabase
        .rpc('deduct_free_ai', { p_user_id: user!.id })

      if (freeErr) {
        console.error('deduct_free_ai error:', freeErr)
        return NextResponse.json({ error: 'System error, please retry' }, { status: 500 })
      }
      if (!freeResult?.ok) {
        return NextResponse.json({ error: freeResult?.reason || 'FREE_LIMIT_REACHED' }, { status: 402 })
      }
      freeRemaining = freeResult.remaining ?? 0
    } else if (deductionSource !== 'guest') {
      // gift / paid / pro → use existing deduct_ai_credits
      const { data: deductResult, error: deductErr } = await supabase
        .rpc('deduct_ai_credits', { p_user_id: user!.id, p_cost: 1 })

      if (deductErr) {
        console.error('deduct_ai_credits error:', deductErr)
        return NextResponse.json({ error: 'System error, please retry' }, { status: 500 })
      }
      if (!deductResult?.ok) {
        return NextResponse.json({
          error:          'NO_CREDITS',
          detail:         'All credits exhausted.',
          gift_ai_points: deductResult?.gift_ai_points ?? 0,
          paid_points:    deductResult?.paid_points    ?? 0,
        }, { status: 402 })
      }
      creditSource = deductResult?.source ?? null
    }
    // Note: guest deduction happens AFTER successful AI generation (see below)

    // ── Build prompt ───────────────────────────────────────────────────────────
    const isKidney       = healthConditions?.includes('kidney')
    const isPancreatitis = healthConditions?.includes('pancreatitis')
    const isDiabetes     = healthConditions?.includes('diabetes')
    const isObese        = healthConditions?.includes('obesity')
    const speciesName    = species === 'dog' ? 'dog' : 'cat'

    const prompt = `You are a professional pet nutritionist strictly following AAFCO, ASPCA, and FEDIAF international standards.

Generate a complete homemade pet food recipe for:
- Species: ${speciesName}
- Name: ${petName || 'Pet'}
- Weight: ${weight || 5}kg
- Age: ${age || 'adult'}
- Health conditions: ${healthConditions?.join(', ') || 'healthy'}

Strict requirements:
1. NEVER use: onion, garlic, grapes, raisins, chocolate, xylitol, avocado, macadamia nuts, caffeine, alcohol, chives
2. NO salt, seasoning, or spices whatsoever
3. All meat must be thoroughly cooked
4. This is nutritional reference only, not medical advice
${isKidney       ? '5. Kidney disease mode: low phosphorus, low potassium, restricted protein, use rabbit or cod, avoid organ meats' : ''}
${isPancreatitis ? '5. Pancreatitis mode: very low fat, use skinless chicken breast or cod, avoid any high-fat ingredients' : ''}
${isDiabetes     ? '5. Diabetes mode: low carbohydrate, high protein, avoid starchy foods' : ''}
${isObese        ? '5. Weight loss mode: low calorie, high fiber, controlled fat, reduced carbs' : ''}

Calculate precise daily portions based on ${weight || 5}kg body weight.

IMPORTANT: All text values in the JSON MUST be written in ${language}. This includes the recipe title, all ingredient names, all step descriptions, all warnings, and all notes.

Return ONLY valid JSON, no other text:
{
  "title": "Recipe name in ${language} (include pet name if provided)",
  "content": {
    "ingredients": [
      {"emoji": "🍗", "name": "ingredient name in ${language}", "amount": "XXg"}
    ],
    "steps": ["step 1 in ${language}", "step 2 in ${language}", "step 3 in ${language}", "step 4 in ${language}"],
    "warnings": ["warning in ${language} if health conditions present, else empty array"],
    "notes": "brief notes in ${language}"
  },
  "nutrition": {
    "calories": "~XXX kcal",
    "protein": "XXg",
    "fat": "XXg",
    "carbs": "XXg",
    "standard": "AAFCO compliant"
  }
}`

    // ── Call AI ────────────────────────────────────────────────────────────────
    let recipe: any
    try {
      const completion = await openai.chat.completions.create({
        model:       selectedModel,
        messages:    [{ role: 'user', content: prompt }],
        max_tokens:  1200,
        temperature: 0.7,
      })

      const text      = completion.choices[0]?.message?.content || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('AI response format error')
      recipe = JSON.parse(jsonMatch[0])

    } catch (aiError: any) {
      // Log detailed error for debugging
      const errMsg = aiError?.message || String(aiError)
      const errStatus = aiError?.status || aiError?.response?.status || 'unknown'
      console.error('[generate-recipe] AI call failed:', {
        model: selectedModel,
        status: errStatus,
        message: errMsg,
        keyPrefix: process.env.OPENROUTER_API_KEY?.slice(0, 12) + '...',
      })

      // Refund deducted credits on AI failure
      if (deductionSource === 'free' && user) {
        await supabase.rpc('refund_free_ai', { p_user_id: user.id })
      } else if (deductionSource !== 'guest' && user) {
        await supabase.rpc('refund_ai_credit', {
          p_user_id: user.id,
          p_source:  creditSource,
          p_cost:    1,
        })
      }
      return NextResponse.json(
        { error: `AI generation failed (${errStatus}): ${errMsg}` },
        { status: 500 }
      )
    }

    // ── Record guest usage AFTER successful generation ────────────────────────
    if (deductionSource === 'guest') {
      await supabase.from('guest_usage').insert({
        token:       guestToken,
        ip,
        fingerprint: fingerprint || '',
      })
    }

    // ── Save recipe & log transaction (logged-in users only) ──────────────────
    if (user) {
      await supabase.from('recipes').insert({
        user_id:   user.id,
        title:     recipe.title,
        content:   recipe.content,
        nutrition: recipe.nutrition,
      })

      await supabase.from('point_transactions').insert({
        user_id:     user.id,
        amount:      -1,
        type:        'generate_recipe',
        description: `Generate recipe: ${recipe.title} (source: ${deductionSource})`,
      })
    }

    const tier = (deductionSource === 'guest' || deductionSource === 'free') ? 'standard' : 'premium'

    return NextResponse.json({ ...recipe, tier, freeRemaining })

  } catch (e: any) {
    console.error('generate-recipe error:', e)
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}
