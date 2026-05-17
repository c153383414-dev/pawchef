import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { validateRecipe, scaleToTargetCalories, PetParams } from '@/lib/nutrition-validator'
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

// Gemini requires these to suppress thinking-chain leakage and enforce JSON mode
const GEMINI_EXTRAS = {
  response_format:  { type: 'json_object' },
  thinking_config:  { include_thoughts: false },
}

// Robust JSON parser: handles Gemini markdown code-blocks and thinking preamble
function parseSubstituteJson(text: string, requiredKey: string): any {
  // Strategy 1: extract ```json ... ``` block
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlock) {
    try {
      const p = JSON.parse(codeBlock[1])
      if (p[requiredKey] !== undefined) return p
    } catch {}
  }

  // Strategy 2: bracket-depth scan — find first complete {...} containing requiredKey
  {
    let depth = 0, start = -1
    let inString = false, escape = false
    for (let i = 0; i < text.length; i++) {
      const c = text[i]
      if (escape) { escape = false; continue }
      if (c === '\\' && inString) { escape = true; continue }
      if (c === '"') { inString = !inString; continue }
      if (inString) continue
      if (c === '{') { if (depth === 0) start = i; depth++ }
      else if (c === '}') {
        depth--
        if (depth === 0 && start !== -1) {
          try {
            const p = JSON.parse(text.slice(start, i + 1))
            if (p[requiredKey] !== undefined) return p
          } catch {}
          start = -1
        }
      }
    }
  }

  // Strategy 3: direct parse
  try { return JSON.parse(text.trim()) } catch {}

  throw new Error('AI response format error')
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
      excludeExtra = [],  // extra dbNames to exclude (e.g. previously suggested substitute)
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
    // 同时排除前端传来的额外排除项（如上次建议的食材，避免"换一个"重复推荐）
    const existingDbNames = new Set([
      ...(currentRecipe?.ingredients || [])
        .filter((ing: any) => ing.dbName && ing.dbName !== targetDbName)
        .map((ing: any) => ing.dbName as string),
      ...excludeExtra.filter((d: any) => typeof d === 'string'),
    ])

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

    // 排除：已在食谱 + 过敏 + 病症禁忌(forbiddenFor) + 极端脂肪差异
    // 注：forbiddenFor 在此处过滤，确保 AI 调用前已排除禁忌食材，避免无效 API 成本
    const safeAllowed = allowedFoods.filter(f =>
      !existingDbNames.has(f.dbName) &&
      !allergens.some((a: string) => f.names.some(n => n.toLowerCase().includes(a.toLowerCase()))) &&
      !conditions.some((c: string) => f.forbiddenFor.includes(c as any)) &&
      !(isOriginalFatty && (f.nutrients?.fat ?? 0) < 1)
    )
    // 降级：过滤后无候选时，仅保留过敏+禁忌过滤（允许已在食谱的食材作为候选）
    const candidateFoods = safeAllowed.length > 0
      ? safeAllowed
      : allowedFoods.filter(f =>
          !allergens.some((a: string) => f.names.some(n => n.toLowerCase().includes(a.toLowerCase()))) &&
          !conditions.some((c: string) => f.forbiddenFor.includes(c as any))
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

    // 取打乱后的前5个作为"优先推荐"，引导 AI 不总选同一食材
    const top5 = shuffledCandidates.slice(0, 5).map(f => f.dbName).join(', ')

    const substitutePrompt = `You are a pet nutritionist. Recommend ONE substitute ingredient.
Respond in ${language}.

Replacing: ${targetIngredient} (category: ${category})
Pet: ${species}, ${pet.weightKg || 5}kg, health: ${(pet.healthConditions || ['healthy']).join(', ')}
${species === 'cat' ? 'Cat is an obligate carnivore - prioritize protein, avoid high carb substitutes.' : ''}
Allowed dbName keys (pick ONLY from this list): ${allowedDbNames}
${existingNote}
${allergens.length > 0 ? `Allergens to avoid: ${allergens.join(', ')}` : ''}

VARIETY INSTRUCTION: Strongly prefer one of these top candidates today: ${top5}
Avoid always defaulting to the most common proteins — be adventurous and pick something less typical when appropriate.

IMPORTANT: You MUST pick a dbName from the allowed list. Do NOT suggest any ingredient already in the recipe.

Output raw JSON only. No markdown, no code blocks, no explanation. Start with { and end with }:
{ "name": "ingredient name in ${language}", "dbName": "exact_key_from_allowed_list", "amountG": ${originalAmountG}, "emoji": "🍗", "reason": "brief reason in ${language}" }`

    let substitute: any
    try {
      const completion = await openai.chat.completions.create({
        model:       'google/gemini-3.1-flash-lite',
        messages:    [{ role: 'user', content: substitutePrompt }],
        max_tokens:  400,
        temperature: 1.0,
        ...GEMINI_EXTRAS,
      } as any)
      const text = completion.choices[0]?.message?.content || ''
      substitute = parseSubstituteJson(text, 'dbName')
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

    // ── 替换后重新校验整份食谱 ─────────────────────────────────────────────
    const petParams: PetParams = {
      weightKg:         pet.weightKg || 5,
      ageMonths:        pet.ageMonths || 36,
      species,
      healthConditions: pet.healthConditions || ['healthy'],
    }

    // ── 等热量缩放：调整替换食材用量使热量贡献与原食材相同 ─────────────────
    // 这样替换后总热量基本不变，避免热量偏差警告
    const origFood = findFood(targetDbName || targetIngredient, !!targetDbName)
    const subFood  = findFood(substitute.dbName, true)
    if (origFood && subFood && subFood.nutrients.calories > 0 && origFood.nutrients.calories > 0) {
      const origCalContrib  = originalAmountG * (origFood.nutrients.calories / 100)
      const isoAmountG = Math.round(origCalContrib / (subFood.nutrients.calories / 100))
      // 允许在原用量 50%–200% 之间缩放，防止极端结果
      substitute.amountG = Math.min(originalAmountG * 2, Math.max(originalAmountG * 0.5, isoAmountG))
    } else if (originalAmountG > 100 && substitute.amountG < originalAmountG * 0.3) {
      // 兜底：AI 给出用量远小于原食材时退回原用量
      substitute.amountG = originalAmountG
    }

    const newIngredients = (currentRecipe?.ingredients || []).map((ing: any) =>
      ing.dbName === targetDbName
        ? { name: substitute.name, dbName: substitute.dbName, amountG: substitute.amountG }
        : ing
    )

    let validation = validateRecipe(newIngredients, petParams)

    // ── 热量超标时整体缩放（与 generate-recipe 保持一致）────────────────────
    // 偏差 ≤50% 时按比例缩放所有主食材以命中目标热量中点
    if (!validation.caloriesOk && validation.actualCalories > 0) {
      const calorieDiff = Math.abs(validation.actualCalories - (validation.targetCalories.min + validation.targetCalories.max) / 2)
      const diffRatio   = calorieDiff / validation.actualCalories
      if (diffRatio <= 0.5) {
        const scaled = scaleToTargetCalories(
          validation.supplements.length > 0
            ? [...newIngredients, ...validation.supplements.map(s => ({ name: s.ingredient, dbName: s.dbName, amountG: s.amountG }))]
            : newIngredients,
          petParams,
          validation.actualCalories,
        )
        // 用缩放后的食材列表更新 newIngredients（同步到步骤生成）
        newIngredients.length = 0
        scaled.scaledIngredients.forEach(i => newIngredients.push(i))
        // 用缩放后的验证结果替换原始验证结果
        validation = scaled.revalidation
        // 同步替换食材的用量
        const scaledSub = scaled.scaledIngredients.find((i: any) => i.dbName === substitute.dbName)
        if (scaledSub) substitute.amountG = scaledSub.amountG
      }
    }

    // 营养偏差 → 软警告（不硬拒，不退费，让用户自决）
    const nutritionWarnings: string[] = []
    if (!validation.aafco.protein.ok) nutritionWarnings.push('protein_low')
    if (!validation.aafco.fat.ok)     nutritionWarnings.push('fat_low')
    if (validation.complianceLabel === 'non-compliant') nutritionWarnings.push('non_compliant')

    // ── 重新生成烹饪步骤（不额外扣费，作为替换操作的一部分）─────────────────
    let newSteps: string[] | null = null
    try {
      const fullNewIngredients = newIngredients.map((ing: any) => ({
        name:   ing.name,
        amountG: ing.amountG,
      }))
      const locale   = req.headers.get('x-locale') || 'zh'
      const language = LANGUAGE_MAP[locale] || 'Chinese (Simplified)'
      const stepsPrompt = `You are a pet chef. Generate exactly 4 cooking steps for this home-cooked pet meal.
Respond in ${language}.

Ingredients:
${fullNewIngredients.map((i: any) => `- ${i.name} ${i.amountG}g`).join('\n')}

Rules:
1. Steps must NOT contain gram or weight numbers
2. Steps must ONLY reference the ingredients listed above — do NOT mention any other ingredient
3. No salt, seasoning, oil, or unlisted additives in steps
4. Steps should be clear, practical, and match the actual cooking method for each ingredient
5. Consider correct preparation: fish needs deboning, chicken needs thorough cooking, grains need soaking/boiling, etc.

Output raw JSON only. No markdown, no code blocks, no explanation. Start with { and end with }:
{"steps": ["step 1", "step 2", "step 3", "step 4"]}`

      const stepsCompletion = await openai.chat.completions.create({
        model:       'google/gemini-3.1-flash-lite',
        messages:    [{ role: 'user', content: stepsPrompt }],
        max_tokens:  600,
        temperature: 0.3,
        ...GEMINI_EXTRAS,
      } as any)
      const stepsText = stepsCompletion.choices[0]?.message?.content || ''
      try {
        const stepsResult = parseSubstituteJson(stepsText, 'steps')
        if (Array.isArray(stepsResult.steps) && stepsResult.steps.length > 0) {
          newSteps = stepsResult.steps
        }
      } catch {
        // parse failed — fall through to keep original steps
      }
    } catch {
      // 步骤生成失败时保留原步骤，不阻断主流程
      newSteps = null
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
        amount:           `${substitute.amountG}g`,
        newSteps:         newSteps ?? undefined,
        nutritionWarnings: nutritionWarnings.length > 0 ? nutritionWarnings : undefined,
      },
      proMonthlyUsed: creditSource === 'pro',
      autoAddedSupplements: validation.supplements,
      updatedCompliance: {
        label:          validation.complianceLabel,
        labelKey:       validation.complianceLabelKey,
        caloriesOk:     validation.caloriesOk,
        targetCalories: validation.targetCalories,
        aafcoDetails: {
          protein:    validation.aafco.protein,
          fat:        validation.aafco.fat,
          calcium:    validation.aafco.calcium,
          phosphorus: validation.aafco.phosphorus,
          caPRatio:   validation.aafco.caPRatio,
          omega3:     validation.aafco.omega3,
          taurine:    validation.aafco.taurine,
        },
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
