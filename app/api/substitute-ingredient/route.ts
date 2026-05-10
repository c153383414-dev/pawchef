import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { validateRecipe, PetParams } from '@/lib/nutrition-validator'
import { getAllowedFoodsByCategory, findFood, getForbiddenFoods } from '@/lib/nutrition-db'
import { DeductSource } from '@/types'
import OpenAI from 'openai'

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: { 'X-Title': 'PawChef' }
})

const LANGUAGE_MAP: Record<string, string> = {
  en: 'English', zh: 'Chinese (Simplified)', es: 'Spanish',
  fr: 'French',  ja: 'Japanese',             ko: 'Korean',
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const body = await req.json()
    const {
      targetIngredient, targetDbName,
      currentRecipe,   // { ingredients: Ingredient[] }
      pet,             // PetParams shape from frontend
      allergens = [],
    } = body

    if (!targetIngredient || !pet?.species) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // ── 积分检查：仅 gift/paid/pro 可用，不消耗 free_ai_quota ──
    const { data: profile } = await supabase
      .from('profiles')
      .select('gift_ai_points, paid_points, is_pro, monthly_ai_count, pro_expires_at')
      .eq('id', user.id)
      .single()

    const isPro = !!(profile?.is_pro && profile.pro_expires_at && new Date(profile.pro_expires_at) > new Date())
    const hasCredits =
      (profile?.gift_ai_points ?? 0) > 0 ||
      (profile?.paid_points    ?? 0) > 0 ||
      (isPro && (profile?.monthly_ai_count ?? 0) < 30)

    if (!hasCredits) {
      return NextResponse.json({
        error:  'NO_CREDITS',
        detail: 'Substitute requires AI credits (gift/paid/pro)',
      }, { status: 402 })
    }

    // 扣减积分
    const { data: deductResult, error: deductErr } = await supabase
      .rpc('deduct_ai_credits', { p_user_id: user.id, p_cost: 1 })

    if (deductErr || !deductResult?.ok) {
      return NextResponse.json({ error: 'NO_CREDITS' }, { status: 402 })
    }
    const creditSource: string = deductResult?.source ?? 'paid'

    const deductSource: DeductSource =
      creditSource === 'gift' ? 'gift_ai_points' :
      creditSource === 'pro'  ? 'pro_monthly'    : 'paid_points'

    // ── 构建白名单 ──────────────────────────────────────────────────────────
    const conditions   = (pet.healthConditions || []).filter((c: string) => c !== 'healthy')
    const targetFood   = findFood(targetDbName || targetIngredient, !!targetDbName)
    const category     = targetFood?.category || 'protein'
    const species      = pet.species as 'dog' | 'cat'

    const allowedFoods = getAllowedFoodsByCategory(category, conditions, species)

    if (allowedFoods.length === 0) {
      await refundCredit(supabase, user.id, creditSource)
      return NextResponse.json({
        error:      'NO_SUBSTITUTE',
        messageKey: 'substitute.no_options',
      }, { status: 422 })
    }

    // 排除过敏食材
    const safeAllowed    = allowedFoods.filter(f =>
      !allergens.some((a: string) => f.names.some(n => n.toLowerCase().includes(a.toLowerCase())))
    )
    const candidateFoods = safeAllowed.length > 0 ? safeAllowed : allowedFoods
    const allowedDbNames = candidateFoods.map(f => f.dbName).join(', ')

    // ── 调用 Claude Sonnet ─────────────────────────────────────────────────
    const locale   = req.headers.get('x-locale') || 'zh'
    const language = LANGUAGE_MAP[locale] || 'Chinese (Simplified)'

    const substitutePrompt = `You are a pet nutritionist. Recommend ONE substitute ingredient.
Respond in ${language}.

Replacing: ${targetIngredient} (${category})
Pet: ${species}, ${pet.weightKg || 5}kg, health: ${(pet.healthConditions || ['healthy']).join(', ')}
${species === 'cat' ? 'Cat is an obligate carnivore - prioritize protein, avoid high carb substitutes.' : ''}
Allowed dbName keys ONLY: ${allowedDbNames}
${allergens.length > 0 ? `Allergens to avoid: ${allergens.join(', ')}` : ''}

Output JSON only (no markdown):
{ "name": "ingredient name in ${language}", "dbName": "exact_key_from_allowed_list", "amountG": 50, "emoji": "🍗", "reason": "brief reason in ${language}" }`

    let substitute: any
    try {
      const completion = await openai.chat.completions.create({
        model:       'anthropic/claude-sonnet-4-5',
        messages:    [{ role: 'user', content: substitutePrompt }],
        max_tokens:  400,
        temperature: 0.5,
      })
      const text      = completion.choices[0]?.message?.content || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('AI format error')
      substitute = JSON.parse(jsonMatch[0])
    } catch (aiError) {
      console.error('AI substitute failed:', aiError)
      await refundCredit(supabase, user.id, creditSource)
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
    }

    // ── 白名单验证（AI 可能忽略约束）──────────────────────────────────────────
    const allowedSet = new Set(candidateFoods.map(f => f.dbName))
    if (!allowedSet.has(substitute.dbName)) {
      const fallback = candidateFoods[0]
      substitute = {
        name:         fallback.names[0],
        dbName:       fallback.dbName,
        amountG:      substitute.amountG || 50,
        emoji:        '🍽️',
        reason:       substitute.reason || '',
        autoFallback: true,
      }
    }

    // ── 双重安全检查：forbiddenFor ─────────────────────────────────────────
    const subFood = findFood(substitute.dbName, true)
    if (subFood && conditions.some((c: string) => subFood.forbiddenFor.includes(c as any))) {
      await refundCredit(supabase, user.id, creditSource)
      return NextResponse.json({
        error:      'SUBSTITUTE_SAFETY_VIOLATION',
        messageKey: 'substitute.error.safety_violation',
      }, { status: 422 })
    }

    // ── 替换后重新校验整份食谱 ─────────────────────────────────────────────
    const petParams: PetParams = {
      weightKg:         pet.weightKg || 5,
      ageMonths:        pet.ageMonths || 36,
      species,
      healthConditions: pet.healthConditions || ['healthy'],
    }

    const newIngredients = (currentRecipe?.ingredients || []).map((ing: any) =>
      ing.dbName === targetDbName
        ? { name: substitute.name, dbName: substitute.dbName, amountG: substitute.amountG }
        : ing
    )

    const validation = validateRecipe(newIngredients, petParams)

    // 蛋白质/脂肪严重不足 → 退还
    const isCritical =
      validation.complianceLabel === 'non-compliant' &&
      (!validation.aafco.protein.ok || !validation.aafco.fat.ok)
    if (isCritical) {
      await refundCredit(supabase, user.id, creditSource)
      return NextResponse.json({
        error:      'SUBSTITUTE_NUTRITION_FAILURE',
        messageKey: 'substitute.error.nutrition_failure',
      }, { status: 422 })
    }

    // ── 积分流水 ────────────────────────────────────────────────────────────
    await supabase.from('point_transactions').insert({
      user_id:     user.id,
      amount:      -1,
      type:        'substitute_ingredient',
      description: `Substitute: ${targetIngredient} → ${substitute.name} (source: ${creditSource})`,
    })

    return NextResponse.json({
      substitute: {
        ...substitute,
        amount: `${substitute.amountG}g`,
      },
      autoAddedSupplements: validation.supplements,
      updatedCompliance: {
        label:    validation.complianceLabel,
        labelKey: validation.complianceLabelKey,
      },
      updatedNutrition: {
        calories: `~${validation.actualCalories}`,
        protein:  `${validation.nutrients.protein}g`,
        fat:      `${validation.nutrients.fat}g`,
        carbs:    `${validation.nutrients.carbs}g`,
      },
    })

  } catch (e: any) {
    console.error('substitute-ingredient error:', e)
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}

async function refundCredit(supabase: any, userId: string, source: string) {
  await supabase.rpc('refund_ai_credit', {
    p_user_id: userId, p_source: source, p_cost: 1,
  }).catch(() => {})
}
