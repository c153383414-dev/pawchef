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

    const targetCategory: string | undefined = body.targetCategory

    if (!targetIngredient || !pet?.species) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // ── 获取原食材用量 ─────────────────────────────────────────────────────
    const originalIngredient = (currentRecipe?.ingredients || []).find(
      (ing: any) => (targetDbName && ing.dbName === targetDbName) || ing.name === targetIngredient
    )
    const originalAmountG: number =
      originalIngredient?.amountG ||
      (originalIngredient?.amount ? parseInt(String(originalIngredient.amount)) : 0) ||
      50

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
    const conditions = (pet.healthConditions || []).filter((c: string) => c !== 'healthy')
    const targetFood = findFood(targetDbName || targetIngredient, !!targetDbName)
                    || findFood(targetIngredient, false)
    // 优先用 DB 查到的 category，其次用前端传来的 targetCategory，最后才兜底 protein
    const VALID_CATEGORIES = ['protein', 'organ', 'veggie', 'carb', 'supplement', 'oil'] as const
    type FoodCategory = typeof VALID_CATEGORIES[number]
    const rawCategory = targetFood?.category || targetCategory || 'protein'
    const category = (VALID_CATEGORIES.includes(rawCategory as FoodCategory) ? rawCategory : 'protein') as FoodCategory
    const species    = pet.species as 'dog' | 'cat'

    // 已在食谱中的食材 dbName（排除被替换的那个，避免建议已有食材）
    const existingDbNames = new Set(
      (currentRecipe?.ingredients || [])
        .filter((ing: any) => ing.dbName && ing.dbName !== targetDbName)
        .map((ing: any) => ing.dbName as string)
    )

    const allowedFoods = getAllowedFoodsByCategory(category, conditions, species)

    if (allowedFoods.length === 0) {
      await refundCredit(supabase, user.id, creditSource)
      return NextResponse.json({
        error:      'NO_SUBSTITUTE',
        messageKey: 'substitute.no_options',
      }, { status: 422 })
    }

    // 判断原食材是否为高脂食材（用于排除过瘦的替换候选）
    const originalFoodForFat = findFood(targetDbName || targetIngredient, !!targetDbName)
    const isOriginalFatty = (originalFoodForFat?.nutrients?.fat ?? 0) > 5

    // 排除过敏食材 + 已存在于食谱中的食材 + 脂肪差异过大的候选
    const safeAllowed = allowedFoods.filter(f =>
      !existingDbNames.has(f.dbName) &&
      !allergens.some((a: string) => f.names.some(n => n.toLowerCase().includes(a.toLowerCase()))) &&
      // 原食材是高脂食材时（如三文鱼 12g fat/100g），排除极低脂的候选（如鳕鱼 0.7g fat/100g）
      !(isOriginalFatty && (f.nutrients?.fat ?? 0) < 1)
    )
    // 如果过滤后没有选项，退化到只排除过敏（保留已有食材，但不推荐重复）
    const candidateFoods = safeAllowed.length > 0
      ? safeAllowed
      : allowedFoods.filter(f =>
          !allergens.some((a: string) => f.names.some(n => n.toLowerCase().includes(a.toLowerCase())))
        )

    // 打乱候选顺序，避免 AI 总是选列表第一项
    const shuffledCandidates = [...candidateFoods].sort(() => Math.random() - 0.5)
    const allowedDbNames  = shuffledCandidates.map(f => f.dbName).join(', ')
    const existingNote    = existingDbNames.size > 0
      ? `Already in recipe - DO NOT suggest these: ${Array.from(existingDbNames).join(', ')}`
      : ''

    // ── 调用 Claude Sonnet ─────────────────────────────────────────────────
    const locale   = req.headers.get('x-locale') || 'zh'
    const language = LANGUAGE_MAP[locale] || 'Chinese (Simplified)'

    const substitutePrompt = `You are a pet nutritionist. Recommend ONE substitute ingredient.
Respond in ${language}.

Replacing: ${targetIngredient} (category: ${category})
Pet: ${species}, ${pet.weightKg || 5}kg, health: ${(pet.healthConditions || ['healthy']).join(', ')}
${species === 'cat' ? 'Cat is an obligate carnivore - prioritize protein, avoid high carb substitutes.' : ''}
Allowed dbName keys ONLY (pick from this list): ${allowedDbNames}
${existingNote}
${allergens.length > 0 ? `Allergens to avoid: ${allergens.join(', ')}` : ''}

IMPORTANT: You MUST pick a dbName from the allowed list. Do NOT suggest any ingredient already in the recipe.

Output JSON only (no markdown):
{ "name": "ingredient name in ${language}", "dbName": "exact_key_from_allowed_list", "amountG": ${originalAmountG}, "emoji": "🍗", "reason": "brief reason in ${language}" }`

    let substitute: any
    try {
      const completion = await openai.chat.completions.create({
        model:       'anthropic/claude-sonnet-4-5',
        messages:    [{ role: 'user', content: substitutePrompt }],
        max_tokens:  400,
        temperature: 0.8,
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
    const allowedSet = new Set(shuffledCandidates.map(f => f.dbName))
    if (!allowedSet.has(substitute.dbName)) {
      // 随机选择候选食材（已打乱顺序，取前5中随机一个）
      const fallbackIdx = Math.floor(Math.random() * Math.min(shuffledCandidates.length, 5))
      const fallback = shuffledCandidates[fallbackIdx]
      substitute = {
        name:         fallback.names[0],
        dbName:       fallback.dbName,
        amountG:      substitute.amountG || originalAmountG,
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

    // 如果 AI 给出的用量远小于原食材（原食材>100g 且建议<原食材30%），退回原食材用量
    if (originalAmountG > 100 && substitute.amountG < originalAmountG * 0.3) {
      substitute.amountG = originalAmountG
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
      proMonthlyUsed: creditSource === 'pro',
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
  try {
    await supabase.rpc('refund_ai_credit', { p_user_id: userId, p_source: source, p_cost: 1 })
  } catch {}
}
