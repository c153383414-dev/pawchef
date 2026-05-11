import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { validateRecipe, calculateDER, calculatePortionGuidance, formatPortionGuidanceForPrompt, PetParams } from '@/lib/nutrition-validator'
import { getForbiddenFoods, getAllowedFoodsByCategory } from '@/lib/nutrition-db'
import { resolveUnknownIngredients } from '@/lib/usda-api'
import { DeductSource } from '@/types'
import OpenAI from 'openai'

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: { 'X-Title': 'PawChef' }
})

const MODEL_FREE    = 'anthropic/claude-3-5-haiku'
const MODEL_PREMIUM = 'anthropic/claude-sonnet-4-5'

const LANGUAGE_MAP: Record<string, string> = {
  en: 'English', zh: 'Chinese (Simplified)', es: 'Spanish',
  fr: 'French',  ja: 'Japanese',             ko: 'Korean',
}

// Localized display names for auto-added supplements
const SUPPLEMENT_NAMES: Record<string, Record<string, string>> = {
  calcium_carbonate:  { zh: '碳酸钙', en: 'Calcium Carbonate', es: 'Carbonato de Calcio', fr: 'Carbonate de Calcium', ja: '炭酸カルシウム', ko: '탄산칼슘' },
  fish_oil:           { zh: '鱼油',   en: 'Fish Oil',          es: 'Aceite de Pescado',   fr: "Huile de Poisson",    ja: '魚油',           ko: '어유' },
  taurine_supplement: { zh: '牛磺酸', en: 'Taurine',           es: 'Taurina',             fr: 'Taurine',             ja: 'タウリン',         ko: '타우린' },
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'
}

// 将年龄字符串转为月份（"3yr" → 36）
function parseAgeToMonths(age: string): number {
  if (age === '<1yr') return 6
  if (age === '12yr+') return 144
  const match = age.match(/^(\d+)yr$/)
  return match ? parseInt(match[1]) * 12 : 36
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()

    const {
      species, petName, weight, age, healthConditions, locale,
      guestToken, fingerprint,
    } = await req.json()

    const language = LANGUAGE_MAP[locale] || 'English'
    const ip       = getClientIp(req)
    const locale_  = locale || 'en'

    console.log('[generate-recipe] auth:', {
      userId: user?.id ?? 'null',
      authErr: authErr?.message ?? 'none',
      hasGuestToken: !!guestToken,
    })

    // ── 确定积分扣减来源 ──────────────────────────────────────────────────────
    let deductSource: DeductSource = 'guest'
    let freeRemaining = 0
    let isPro = false
    let creditSource: string | null = null

    if (!user) {
      if (!guestToken) {
        return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
      }
      const filters = [`token.eq.${guestToken}`]
      if (ip !== 'unknown') filters.push(`ip.eq.${ip}`)
      if (fingerprint)      filters.push(`fingerprint.eq.${fingerprint}`)
      const { data: existing } = await supabase
        .from('guest_usage').select('id').or(filters.join(',')).limit(1).maybeSingle()
      if (existing) {
        return NextResponse.json({ error: 'GUEST_LIMIT_REACHED' }, { status: 402 })
      }
      deductSource = 'guest'

    } else {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('free_ai_used, free_ai_limit, gift_ai_points, paid_points, is_pro, monthly_ai_count, pro_expires_at')
        .eq('id', user.id)
        .single()

      if (profileErr || !profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 400 })
      }

      isPro = !!(profile.is_pro && profile.pro_expires_at && new Date(profile.pro_expires_at) > new Date())

      const freeUsed  = profile.free_ai_used  ?? 0
      const freeLimit = profile.free_ai_limit ?? 2

      if (freeUsed < freeLimit) {
        deductSource  = 'free_ai_quota'
        freeRemaining = freeLimit - freeUsed - 1
      } else if ((profile.gift_ai_points ?? 0) > 0) {
        deductSource = 'gift_ai_points'
      } else if ((profile.paid_points ?? 0) > 0) {
        deductSource = 'paid_points'
      } else if (isPro && (profile.monthly_ai_count ?? 0) < 30) {
        deductSource = 'pro_monthly'
      } else {
        return NextResponse.json({ error: 'NO_CREDITS' }, { status: 402 })
      }

      // 付费/赠送/Pro 先扣再生成
      if (deductSource === 'free_ai_quota') {
        const { data: freeResult, error: freeErr } = await supabase
          .rpc('deduct_free_ai', { p_user_id: user.id })
        if (freeErr) {
          return NextResponse.json({ error: 'System error, please retry' }, { status: 500 })
        }
        if (!freeResult?.ok) {
          return NextResponse.json({ error: freeResult?.reason || 'FREE_LIMIT_REACHED' }, { status: 402 })
        }
        freeRemaining = freeResult.remaining ?? 0
      } else {
        const source = deductSource === 'pro_monthly' ? 'pro' :
                       deductSource === 'gift_ai_points' ? 'gift' : 'paid'
        const { data: deductResult, error: deductErr } = await supabase
          .rpc('deduct_ai_credits', { p_user_id: user.id, p_cost: 1 })
        if (deductErr) {
          return NextResponse.json({ error: 'System error, please retry' }, { status: 500 })
        }
        if (!deductResult?.ok) {
          return NextResponse.json({ error: 'NO_CREDITS' }, { status: 402 })
        }
        creditSource = deductResult?.source ?? source
      }
    }

    // ── 宠物参数 ──────────────────────────────────────────────────────────────
    const ageMonths   = parseAgeToMonths(age || '3yr')
    const weightKg    = parseFloat(weight) || 5
    const isPuppy     = ageMonths < 12
    const isCat       = species === 'cat'

    // 服务端强制：非 Pro 用户只能使用 healthy
    const safeConditions: string[] = isPro
      ? (healthConditions?.filter((c: string) => c !== 'healthy') ?? [])
      : []

    const petParams: PetParams = {
      weightKg,
      ageMonths,
      species: species as 'dog' | 'cat',
      healthConditions: safeConditions.length > 0 ? safeConditions : ['healthy'],
    }

    const targetCalories   = calculateDER(petParams)
    const forbiddenDbNames = getForbiddenFoods(safeConditions)

    // 动态参考克重，注入 prompt 解决 AI 热量偏低问题
    const portionGuidance = calculatePortionGuidance(petParams)
    const portionText     = formatPortionGuidanceForPrompt(portionGuidance, isCat)

    // Pro 多样性：每次随机选一个主蛋白类型
    const DOG_PROTEINS = ['chicken breast', 'beef', 'salmon', 'turkey', 'duck', 'pork', 'cod']
    const CAT_PROTEINS = ['chicken breast', 'beef', 'salmon', 'turkey', 'duck', 'cod']
    const proProteinPool = isCat ? CAT_PROTEINS : DOG_PROTEINS
    const featuredProtein = proProteinPool[Math.floor(Math.random() * proProteinPool.length)]

    // ── Prompt 构建 ──────────────────────────────────────────────────────────
    const freeDogIngredients = `proteins: chicken_breast, beef_lean, salmon, turkey_breast, duck_breast, cod, pork_lean, egg_cooked
   organs: chicken_liver, chicken_gizzard
   veggies: carrot, broccoli, pumpkin, sweet_potato, spinach, green_peas
   carbs: brown_rice_cooked, white_rice_cooked, oatmeal_cooked
   supplements: calcium_carbonate
   oils: fish_oil`

    const freeCatIngredients = `proteins: chicken_breast, beef_lean, salmon, turkey_breast, duck_breast, cod, pork_lean, egg_cooked
   organs: chicken_liver, chicken_gizzard
   veggies: carrot, broccoli, pumpkin, green_peas
   supplements: calcium_carbonate, taurine_supplement
   oils: fish_oil
   (NO carbs/rice/oatmeal - cats need very low carbohydrates)`

    const freePrompt = `You are a professional pet nutritionist creating a home-cooked meal recipe.
Respond in ${language}.

Pet: ${isCat ? 'Cat' : 'Dog'}, ${weightKg}kg, ${ageMonths} months ${isPuppy ? `(${isCat ? 'KITTEN' : 'PUPPY'} - higher protein/fat/calcium needed)` : '(adult)'}
${portionText}
${isCat ? 'IMPORTANT: Cat is an obligate carnivore. High protein, moderate fat, minimal carbs. Taurine is essential.' : ''}

MANDATORY:
1. Calcium source: calcium_carbonate ~${(weightKg * (isPuppy ? 0.35 : 0.15)).toFixed(1)}g
2. Omega-3: fish_oil ~${Math.max(0.5, weightKg * 0.1).toFixed(1)}ml OR use salmon/cod
${isCat ? `3. Taurine: taurine_supplement ~${Math.max(0.05, weightKg * 0.025).toFixed(2)}g (cats cannot synthesize taurine)` : '3. Balance protein and moderate carbs'}
4. Steps must NOT contain gram/weight numbers
5. ONLY use approved ingredients (exact dbName keys):
${isCat ? freeCatIngredients : freeDogIngredients}

Output JSON only (no markdown):
{
  "title": "title in ${language}",
  "ingredients": [{ "name": "ingredient name in ${language}", "dbName": "exact_key", "amountG": 50, "category": "protein|organ|veggie|carb|supplement|oil", "emoji": "🍗" }],
  "steps": ["Step 1 (no gram numbers)", "Step 2", "Step 3", "Step 4"],
  "warnings": []
}`

    const healthNote = safeConditions.length > 0
      ? `\nHealth restrictions:\n${safeConditions.map((c: string) => ({
          kidney:       '- Low phosphorus: avoid spinach, legumes, excess organ meat',
          pancreatitis: '- Low fat: avoid fatty meats, excess egg yolk',
          diabetes:     '- Low glycemic: avoid white rice, sweet potato excess',
          obesity:      '- Low calorie: reduce carbohydrates and oils',
          allergy:      '- Check for allergens in all ingredients',
        } as Record<string, string>)[c] || '').filter(Boolean).join('\n')}
Forbidden ingredient dbNames: ${forbiddenDbNames.join(', ')}`
      : ''

    const proPrompt = `You are an expert pet nutritionist creating a personalized home-cooked meal recipe.
Respond in ${language}.

Pet: ${isCat ? 'Cat' : 'Dog'}${petName ? ` (${petName})` : ''}, ${weightKg}kg, ${ageMonths} months ${isPuppy ? `(${isCat ? 'KITTEN' : 'PUPPY'})` : '(adult)'}
Health: ${petParams.healthConditions.join(', ')}
${portionText}
${isCat ? 'IMPORTANT: Cat is an obligate carnivore. High protein (>50% calories), moderate fat, minimal/no carbs. Taurine MUST be present.' : ''}
${healthNote}

TODAY's featured protein: ${featuredProtein} — build the recipe around this protein unless health conditions forbid it.

MANDATORY:
1. Calcium source required: ~${(weightKg * (isPuppy ? 0.35 : 0.15)).toFixed(1)}g calcium carbonate
2. Omega-3 required: ~${Math.max(0.5, weightKg * 0.1).toFixed(1)}ml fish oil OR fatty fish
${isCat ? `3. Taurine required: ~${Math.max(0.05, weightKg * 0.025).toFixed(2)}g taurine supplement OR ensure meat sources provide sufficient taurine` : ''}
4. Steps must NOT contain gram/weight numbers
5. Be creative with safe ingredients — vary the combination each time
6. Provide dbName in English snake_case for each ingredient

Output JSON only (no markdown):
{
  "title": "title in ${language}",
  "ingredients": [{ "name": "ingredient name in ${language}", "dbName": "english_snake_case", "amountG": 50, "category": "protein|organ|veggie|carb|supplement|oil", "emoji": "🍗" }],
  "steps": ["Step 1", "Step 2", "Step 3", "Step 4"],
  "warnings": ["health-specific warnings if any"]
}`

    const model       = isPro ? MODEL_PREMIUM : MODEL_FREE
    const prompt      = isPro ? proPrompt     : freePrompt
    const maxTokens   = isPro ? 2000          : 1200
    const temperature = isPro ? 0.9           : 0.7   // Pro: higher temp for more diversity

    // ── AI 调用 ──────────────────────────────────────────────────────────────
    let aiResult: any
    try {
      const completion = await openai.chat.completions.create({
        model, messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens, temperature,
      })
      const text      = completion.choices[0]?.message?.content || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('AI response format error')
      aiResult = JSON.parse(jsonMatch[0])
    } catch (aiError: any) {
      console.error('[generate-recipe] AI call failed:', aiError?.message)
      await refundCredits(supabase, user?.id, deductSource, creditSource)
      return NextResponse.json(
        { error: `AI generation failed: ${aiError?.message || 'unknown'}` },
        { status: 500 }
      )
    }

    // ── Pro 专属：禁用食材硬校验 ──────────────────────────────────────────────
    if (isPro && safeConditions.length > 0) {
      const removedItems: any[] = []
      aiResult.ingredients = aiResult.ingredients.filter((ing: any) => {
        const isForbidden = forbiddenDbNames.includes(ing.dbName)
        if (isForbidden) removedItems.push(ing)
        return !isForbidden
      })
      if (removedItems.length > 0) {
        const removedCritical = removedItems.filter((i: any) =>
          ['protein', 'organ', 'carb'].includes(i.category)
        )
        if (removedCritical.length > 0) {
          await refundCredits(supabase, user!.id, deductSource, creditSource)
          return NextResponse.json({
            error:        'FORBIDDEN_INGREDIENT_REMOVED',
            messageKey:   'recipe.error.forbidden_ingredient',
            removedItems: removedCritical.map((i: any) => i.name),
          }, { status: 422 })
        }
        aiResult.warnings = [
          ...(aiResult.warnings || []),
          ...removedItems.map((i: any) => `ingredient_removed:${i.dbName}`),
        ]
      }
    }

    // ── 营养校验 ─────────────────────────────────────────────────────────────
    let ingredientsForValidation = (aiResult.ingredients || []).map((ing: any) => ({
      name: ing.name, dbName: ing.dbName, amountG: ing.amountG || 0,
    }))

    // Pro 用户对未知食材查 USDA
    if (isPro) {
      ingredientsForValidation = await resolveUnknownIngredients(ingredientsForValidation)
    }

    const validation = validateRecipe(ingredientsForValidation, petParams)

    // 免费用户：未知食材超30% → 退还
    if (!isPro && validation.unknownIngredients.length > 0 &&
        validation.unknownIngredients.length / (aiResult.ingredients?.length || 1) > 0.3) {
      await refundCredits(supabase, user?.id, deductSource, creditSource)
      return NextResponse.json({ error: 'INGREDIENT_MISMATCH' }, { status: 500 })
    }

    // 蛋白质/脂肪严重不足 → 退还
    const isCriticalFailure =
      validation.complianceLabel === 'non-compliant' &&
      (!validation.aafco.protein.ok || !validation.aafco.fat.ok)
    if (isCriticalFailure) {
      await refundCredits(supabase, user?.id, deductSource, creditSource)
      return NextResponse.json({
        error:      'NUTRITION_CRITICAL_FAILURE',
        messageKey: 'recipe.error.nutrition_failure',
      }, { status: 422 })
    }

    // ── 合并自动补全食材 ──────────────────────────────────────────────────────
    // Skip supplements whose dbName already appears in AI-generated ingredients
    const aiDbNames = new Set((aiResult.ingredients || []).map((ing: any) => ing.dbName))
    const supplementIngredients = validation.supplements
      .filter(s => !aiDbNames.has(s.dbName))
      .map(s => ({
        name:      SUPPLEMENT_NAMES[s.dbName]?.[locale_] || SUPPLEMENT_NAMES[s.dbName]?.['en'] || s.ingredient,
        dbName:    s.dbName,
        amountG:   s.amountG,
        amount:    `${s.amountG}g`,
        category:  'supplement' as const,
        emoji:     '💊',
        autoAdded: true,
        reasonKey: s.reasonKey,
      }))

    const finalIngredients = [
      ...(aiResult.ingredients || []).map((ing: any) => ({
        ...ing,
        amount: ing.amount || `${ing.amountG}g`,
      })),
      ...supplementIngredients,
    ]

    // ── 访客：生成成功后记录使用 ──────────────────────────────────────────────
    if (deductSource === 'guest') {
      await supabase.from('guest_usage').insert({
        token: guestToken, ip, fingerprint: fingerprint || '',
      })
    }

    // ── 登录用户：保存食谱 & 积分流水 ─────────────────────────────────────────
    if (user) {
      await supabase.from('recipes').insert({
        user_id:   user.id,
        title:     aiResult.title,
        content:   { ingredients: finalIngredients, steps: aiResult.steps, warnings: aiResult.warnings },
        nutrition: {
          calories: `~${validation.actualCalories}`,
          protein:  `${validation.nutrients.protein}g`,
          fat:      `${validation.nutrients.fat}g`,
          carbs:    `${validation.nutrients.carbs}g`,
        },
      })
      await supabase.from('point_transactions').insert({
        user_id:     user.id,
        amount:      -1,
        type:        'generate_recipe',
        description: `Generate recipe: ${aiResult.title} (source: ${deductSource})`,
      })
    }

    return NextResponse.json({
      title:       aiResult.title,
      ingredients: finalIngredients,
      steps:       aiResult.steps   || [],
      warnings:    aiResult.warnings || [],
      nutrition: {
        calories: `~${validation.actualCalories}`,
        protein:  `${validation.nutrients.protein}g`,
        fat:      `${validation.nutrients.fat}g`,
        carbs:    `${validation.nutrients.carbs}g`,
      },
      compliance: {
        label:                validation.complianceLabel,
        labelKey:             validation.complianceLabelKey,
        caloriesOk:           validation.caloriesOk,
        targetCalories:       validation.targetCalories,
        autoAddedSupplements: validation.supplements,
      },
      unknownIngredients: validation.unknownIngredients,
      generatedBy:        isPro ? 'claude-sonnet' : 'gpt-4o-mini',
      freeRemaining,
    })

  } catch (e: any) {
    console.error('generate-recipe error:', e)
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}

// ── 退还积分辅助函数 ─────────────────────────────────────────────────────────
async function refundCredits(
  supabase: any,
  userId: string | undefined,
  source: DeductSource,
  creditSource: string | null
) {
  if (!userId || source === 'guest') return
  if (source === 'free_ai_quota') {
    await supabase.rpc('refund_free_ai', { p_user_id: userId }).catch(() => {})
  } else {
    const src = creditSource ||
      (source === 'gift_ai_points' ? 'gift' :
       source === 'paid_points'    ? 'paid' : 'pro')
    await supabase.rpc('refund_ai_credit', {
      p_user_id: userId, p_source: src, p_cost: 1,
    }).catch(() => {})
  }
}
