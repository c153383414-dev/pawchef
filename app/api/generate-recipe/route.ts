import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { validateRecipe, validateIngredients, calculateDER, calculatePortionGuidance, formatPortionGuidanceForPrompt, scaleToTargetCalories, PetParams } from '@/lib/nutrition-validator'
import { findFood, getForbiddenFoods, getAllowedFoodsByCategory, OILY_FISH_DBNAMES } from '@/lib/nutrition-db'
import { resolveUnknownIngredients } from '@/lib/usda-api'
import { DeductSource } from '@/types'
import OpenAI from 'openai'

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: { 'X-Title': 'PawChef' }
})

const MODEL_FREE    = 'anthropic/claude-3-5-haiku'
const MODEL_PREMIUM = 'google/gemini-3.1-pro-preview'

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

// 清理 AI 返回的食材：移除禁用/不安全食材，去重油性鱼类，保证胰腺炎有足够脂肪蛋白
function sanitizeIngredients(
  ingredients: any[],
  forbiddenDbNames: string[],
  conditions: string[],
  isCat: boolean,
  portionGuidance: { protein: { max: number } },
  locale_: string
): { sanitized: any[]; removed: any[] } {
  const hasPancreatitis = conditions.includes('pancreatitis')

  // 1. 移除条件禁用 + 物种不安全食材
  const removed: any[] = []
  let result = ingredients.filter((ing: any) => {
    const isForbidden = forbiddenDbNames.includes(ing.dbName)
    const food = ing.dbName ? findFood(ing.dbName, true) : null
    const isSpeciesUnsafe = food && (
      (isCat && food.catSafe === false) ||
      (!isCat && food.dogSafe === false)
    )
    if (isForbidden || isSpeciesUnsafe) { removed.push(ing); return false }
    return true
  })

  // 2. 去重油性鱼类：每份食谱只保留一种
  let oilyFishKept = false
  result = result.filter((ing: any) => {
    if ((OILY_FISH_DBNAMES as readonly string[]).includes(ing.dbName)) {
      if (oilyFishKept) { removed.push(ing); return false }
      oilyFishKept = true
    }
    return true
  })

  // 3. 胰腺炎：确保至少一种蛋白质脂肪含量 ≥ 4g/100g（兔肉5.5%、鹿肉5.0%、鸡胸3.6%均可）
  //    若只剩火鸡/鳕鱼等极瘦蛋白，AAFCO脂肪指标会失败
  if (hasPancreatitis) {
    const proteins = result.filter((i: any) => ['protein', 'organ'].includes(i.category))
    const hasAdequateFat = proteins.some((i: any) => {
      const food = findFood(i.dbName, true)
      return food && food.nutrients.fat >= 4
    })
    if (proteins.length > 0 && !hasAdequateFat) {
      // 找出脂肪最低的蛋白质，替换为兔肉
      let lowestFatIdx = -1
      let lowestFat = Infinity
      result.forEach((i: any, idx: number) => {
        if (['protein', 'organ'].includes(i.category)) {
          const food = findFood(i.dbName, true)
          const fat = food?.nutrients.fat ?? Infinity
          if (fat < lowestFat) { lowestFat = fat; lowestFatIdx = idx }
        }
      })
      if (lowestFatIdx >= 0) {
        result[lowestFatIdx] = {
          ...result[lowestFatIdx],
          name:   locale_ === 'zh' ? '兔肉' : locale_ === 'ja' ? 'ウサギ肉' : locale_ === 'ko' ? '토끼고기' : 'Rabbit',
          dbName: 'rabbit_meat',
        }
      }
    }
  }

  // 4. 兜底：若完全没有蛋白质，自动注入一种安全蛋白
  const hasAnyProtein = result.some((i: any) => ['protein', 'organ'].includes(i.category))
  if (!hasAnyProtein) {
    const fallbackDbName = hasPancreatitis ? 'rabbit_meat' : isCat ? 'chicken_breast' : 'duck_breast'
    const fallbackFood = findFood(fallbackDbName, true)!
    result.push({
      name:     locale_ === 'zh' ? fallbackFood.names[0] : fallbackDbName.replace(/_/g, ' '),
      dbName:   fallbackDbName,
      amountG:  portionGuidance.protein.max,
      category: 'protein',
      emoji:    '🍗',
    })
  }

  return { sanitized: result, removed }
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

    // ── 体重防篡改校验 ────────────────────────────────────────────────────────
    const weightNum = typeof weight === 'number' ? weight : parseFloat(weight)
    const maxWeight = species === 'cat' ? 15 : 100
    if (!weightNum || weightNum < 1) {
      return NextResponse.json(
        { error: 'WEIGHT_TOO_LOW', messageKey: 'recipe.weightErrorTooLow' },
        { status: 400 }
      )
    }
    if (weightNum > maxWeight) {
      return NextResponse.json(
        { error: 'WEIGHT_TOO_HIGH', messageKey: 'recipe.weightErrorTooHigh' },
        { status: 400 }
      )
    }

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

    // 免费用户蛋白池（固定白名单，安全可控）
    const FREE_DOG_PROTEINS = ['chicken breast', 'beef', 'salmon', 'turkey breast', 'duck breast', 'pork', 'egg']
    const FREE_CAT_PROTEINS = ['chicken breast', 'beef', 'salmon', 'turkey breast', 'duck breast', 'egg']
    const freeProteinPool = isCat ? FREE_CAT_PROTEINS : FREE_DOG_PROTEINS

    // Pro季节性主推蛋白（按季度轮换：Q1=lamb Q2=sardines Q3=duck Q4=salmon）
    const PRO_SEASONAL_PROTEINS = ['lamb', 'sardines', 'duck', 'salmon']

    // 查询最近用过的食材，生成多样性提示（蛋白质/蔬菜/碳水/内脏全追踪）
    let recentVeggieNote   = ''
    let recentProteinNote  = ''
    let recentCarbNote     = ''
    let recentOrganNote    = ''
    let proFeaturedNote    = ''
    let freeFeatureProtein = freeProteinPool[Math.floor(Math.random() * freeProteinPool.length)]

    if (user) {
      try {
        const { data: recentRecipes } = await supabase
          .from('recipes')
          .select('content')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)

        const recentIngredients = (recentRecipes || []).flatMap((r: any) => r.content?.ingredients || [])

        const pickRecent = (category: string, n: number) =>
          Array.from(new Set(
            recentIngredients
              .filter((i: any) => i.category === category)
              .map((i: any) => i.dbName || i.name)
              .filter(Boolean)
          )).slice(0, n) as string[]

        // 蔬菜（Pro + 免费）
        const recentVeggies = pickRecent('veggie', 5)
        if (recentVeggies.length > 0)
          recentVeggieNote = `Recently used vegetables to AVOID repeating: ${recentVeggies.join(', ')}`

        // 蛋白质
        const recentProteinNames = pickRecent('protein', 4)
        if (isPro && recentProteinNames.length > 0)
          recentProteinNote = `Recently used proteins: ${recentProteinNames.join(', ')}. You MUST choose a DIFFERENT protein — be creative.`

        if (isPro) {
          const quarter = Math.floor(new Date().getMonth() / 3)
          const seasonalProtein = PRO_SEASONAL_PROTEINS[quarter]
          const seasonalConflict = recentProteinNames.some(r =>
            r.toLowerCase().includes(seasonalProtein) || seasonalProtein.includes(r.toLowerCase())
          )
          if (!seasonalConflict)
            proFeaturedNote = `TODAY's featured protein: ${seasonalProtein} — build the recipe around this protein.`
        }

        if (!isPro && recentProteinNames.length > 0) {
          const freshFreePool = freeProteinPool.filter(
            p => !recentProteinNames.some(r => p.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(p.toLowerCase()))
          )
          if (freshFreePool.length > 0)
            freeFeatureProtein = freshFreePool[Math.floor(Math.random() * freshFreePool.length)]
        }

        // 碳水（狗有碳水，猫无需追踪）
        if (!isCat) {
          const recentCarbs = pickRecent('carb', 2)
          if (recentCarbs.length > 0)
            recentCarbNote = `Recently used carbs: ${recentCarbs.join(', ')}. Use a DIFFERENT carb source (e.g. oatmeal, brown rice, sweet potato, quinoa, barley, millet).`
        }

        // 内脏
        const recentOrgans = pickRecent('organ', 2)
        if (recentOrgans.length > 0)
          recentOrganNote = `Recently used organ meat: ${recentOrgans.join(', ')}. If adding organ meat, choose a different one.`

      } catch {}
    }

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
TODAY's featured protein: ${freeFeatureProtein} — build the recipe around this protein.
${recentVeggieNote ? recentVeggieNote + '\n' : ''}${recentCarbNote ? recentCarbNote + '\n' : ''}${recentOrganNote ? recentOrganNote + '\n' : ''}${isCat ? 'IMPORTANT: Cat is an obligate carnivore. High protein, moderate fat, minimal carbs. Taurine is essential.' : ''}
${isPuppy && !isCat ? 'PUPPY FAT REQUIREMENT: Puppies need ≥21g fat per 1000kcal. You MUST use fatty proteins such as salmon, duck_breast, or egg_cooked — do NOT rely only on lean chicken breast.' : ''}

MANDATORY:
1. Calcium source: calcium_carbonate ~${portionGuidance.calciumCarbonate}g
2. Omega-3: fish_oil ~${Math.max(0.5, weightKg * 0.1).toFixed(1)}ml (mandatory — do NOT replace with cod)
${isCat ? `3. Taurine: taurine_supplement ~${Math.max(0.05, weightKg * 0.025).toFixed(2)}g (cats cannot synthesize taurine)` : isPuppy ? '3. Use salmon, duck_breast, or egg_cooked as main protein to supply sufficient fat for puppy growth' : '3. Balance protein and moderate carbs'}
4. Steps must NOT contain gram/weight numbers
5. Steps must ONLY reference ingredients that appear in the ingredient list above.
   Do NOT mention any ingredient in steps that is not listed. Do NOT add salt, oil,
   seasoning, or any unlisted item in the steps.
6. ONLY use approved ingredients (exact dbName keys):
${isCat ? freeCatIngredients : freeDogIngredients}
${isPuppy && !isCat ? `7. PUPPY energy density: protein must be ≥65% of food weight. Grains/carbs (rice, millet, oats) MAX 15g TOTAL. Total veggies combined MAX ${Math.round(Math.max(weightKg * 8, 10))}g. Spinach MAX 10g (oxalates block calcium absorption).` : !isCat && ageMonths >= 96 ? '7. Avoid spinach for this senior dog (age > 8 years). Use broccoli or carrot instead.' : ''}

CRITICAL: Output raw JSON only. No markdown, no code blocks, no explanation text before or after. Start your response with { and end with }.
{
  "title": "title in ${language}",
  "ingredients": [{ "name": "ingredient name in ${language}", "dbName": "exact_key", "amountG": 50, "category": "protein|organ|veggie|carb|supplement|oil", "emoji": "🍗" }],
  "steps": ["Step 1 (no gram numbers)", "Step 2", "Step 3", "Step 4"],
  "warnings": []
}`

    const proHealthNote = safeConditions.length > 0
      ? `Health condition restrictions:
${safeConditions.map((c: string) => ({
  kidney:       '- Kidney disease: avoid high-phosphorus foods (spinach, legumes, excess organ meat, high-phosphorus fish) AND high-purine foods (asparagus, sardines in excess). Fat must still reach ≥14g/1000kcal — use fish oil or fatty fish.',
  pancreatitis: '- Pancreatitis: STRICTLY LOW FAT — avoid salmon, sardines, mackerel, herring, duck, pork, egg yolk, any fatty fish or meat. Fish oil max 0.1g/kg. Use only lean proteins: chicken breast, turkey breast, venison, rabbit, cod.',
  diabetes:     '- Diabetes: low glycemic — avoid white rice, sweet potato excess, sugary foods.',
  obesity:      '- Obesity: low calorie — significantly reduce carbohydrates and oils.',
  allergy:      '- Food allergy: avoid all known allergens. Use novel protein sources when uncertain.',
} as Record<string, string>)[c] || '').filter(Boolean).join('\n')}`
      : 'No restrictions — healthy pet, all safe ingredients allowed.'

    const proPrompt = `You are an expert pet nutritionist creating a personalized home-cooked meal recipe.
Respond in ${language}.

Pet: ${isCat ? 'Cat' : 'Dog'}${petName ? ` (${petName})` : ''}, ${weightKg}kg, ${ageMonths} months ${isPuppy ? `(${isCat ? 'KITTEN' : 'PUPPY'})` : '(adult)'}
${portionText}
${proHealthNote}

${recentProteinNote ? recentProteinNote + '\n' : ''}${proFeaturedNote ? proFeaturedNote + '\n' : !recentProteinNote ? 'Choose a creative, varied protein source for today.\n' : ''}${recentVeggieNote ? recentVeggieNote + '\n' : ''}${recentCarbNote ? recentCarbNote + '\n' : ''}${recentOrganNote ? recentOrganNote + '\n' : ''}
INGREDIENT FREEDOM — Be creative. You may use ANY safe, nutritious pet food ingredients. Consider:
- Proteins: ${
  locale_ === 'zh'
    ? 'duck, pork shoulder, chicken thigh, salmon, mackerel, sardines, quail egg, lamb, tuna, trout, pork heart, duck heart, rabbit, beef, chicken heart, sea bream, goat, venison, tilapia, carp'
    : locale_ === 'ja' || locale_ === 'ko'
    ? 'salmon, mackerel, tuna, duck, chicken thigh, pork, egg, sardines, lamb, trout, yellowtail, horse mackerel, chicken heart, duck gizzard, beef, rabbit, goat, venison, sea bass, quail egg'
    : 'turkey, lamb, salmon, duck, mackerel, sardines, chicken thigh, pork shoulder, egg, rabbit, bison, venison, beef, cod, tilapia, catfish, pheasant, goat, quail, whitefish'
}
- Organs (rotate for variety): chicken liver, duck gizzard, beef heart, chicken heart, lamb kidney, pork liver, duck heart, beef liver
- Vegetables: zucchini, asparagus, blueberries, butternut squash, celery, green beans, beet
- Vary ingredients every time — do not repeat the same combination.

VEGETABLE LIMITS (apply always):
- Beet: MAX 15g (moderate oxalates + high sugar — more causes glycemic spike)
- Asparagus: MAX 20g (high purines — excess stresses kidneys; FORBIDDEN for kidney disease)
- Spinach: MAX 15g adults / MAX 10g puppies (high oxalates block calcium absorption)

CARB RULE (CRITICAL — calculate before finalizing):
- Total carbohydrates from ALL sources combined must contribute LESS than 20% of total recipe calories.
- Formula: Σ(ingredient_carb_grams × 4) ÷ total_recipe_kcal < 0.20
- IMPORTANT: Fruits count toward the carb limit. Cranberries, blueberries, apple, banana = HIGH sugar.
- Starchy vegetables also count: sweet potato, pumpkin (large), carrot (large), beet.
- Use at most ONE high-carb ingredient. High-carb = rice, millet, oats, sweet potato, potato, apple, banana, cranberry, or any fruit used in quantity.
- Prioritize protein and fat. Dogs and cats evolved as carnivores — carbs are optional filler, not a base.

STRICTLY FORBIDDEN (toxic — NEVER use under any circumstances):
grapes, raisins, onions, garlic, chives, leeks, chocolate, cocoa, xylitol, macadamia nuts, avocado,
alcohol, caffeine, raw yeast dough, green tomatoes, raw potatoes, fruit seeds/pits

OILY FISH RULE: Use at most ONE oily fish per recipe. Sardines, mackerel, salmon, herring are mutually exclusive — pick only ONE. Combining them causes extreme phosphorus overload.
SARDINES/MACKEREL ARE SUPPLEMENTARY ONLY: Due to high phosphorus and per-kg limits, sardines/mackerel MAX ${Math.round(weightKg * 4)}g for this pet. Do NOT use as the primary/only protein. Always pair with a main protein (duck, rabbit, chicken, beef, etc.).
${isCat ? '\nCAT RULES: Obligate carnivore — protein >65% of calories, no grains/rice as main ingredient. Do NOT use spinach (high oxalates → urinary stones). Taurine MUST be present.' : ''}
${!isCat && ageMonths >= 96 ? '\nSENIOR DOG (>8 years): Avoid spinach (high oxalates). Use broccoli or carrot instead.' : ''}
${isPuppy && !isCat ? `\nPUPPY RULES (growth stage — energy density is critical):
- Protein + organ sources MUST be ≥65% of total food weight (excluding supplements/oils). Puppies need calorie-dense meals.
- Total vegetables combined MAX ${Math.round(Math.max(weightKg * 8, 10))}g — vegetables are supplementary, NOT a base ingredient.
- Fat ≥21g per 1000kcal: use salmon, duck, or egg — do NOT rely only on lean chicken.
- Grains/carbs (rice, millet, oats): MAX 15g TOTAL — protein+fat must dominate puppy meals, not starch.
- Spinach MAX 10g (oxalates block calcium absorption critical for bone development). Prefer broccoli, carrot, pumpkin.
- Include small amount of organ meat (5–10g liver or heart) for vitamin A, copper, B12.` : ''}

Calcium carbonate maximum: puppies <25kg → max 8g | puppies ≥25kg → max 15g | adults → follow calculated | cats → max 3g

FAT REQUIREMENT (CRITICAL — verify before finalizing):
- Total recipe fat must be ≥ ${Math.round((portionGuidance.targetCalMin + portionGuidance.targetCalMax) / 2 * (isPuppy ? 21 : 14) / 1000 / 9 * 10) / 10}g for this pet.
- Fish oil (1-2g) alone CANNOT meet this target. You MUST ensure the protein/fat sources provide sufficient fat.
- If using lean proteins (pork loin, chicken breast, turkey breast), you MUST also include one of:
  → A high-fat secondary protein: salmon, duck, lamb, sardines, mackerel, beef heart, egg
  → OR switch to a fattier primary protein altogether.

MANDATORY:
1. Calcium: ~${portionGuidance.calciumCarbonate}g calcium carbonate
2. Omega-3: ~${Math.max(0.5, weightKg * 0.1).toFixed(1)}ml fish oil (mandatory — do NOT replace with cod)
${isCat ? `3. Taurine: ~${Math.max(0.05, weightKg * 0.025).toFixed(2)}g taurine supplement OR taurine-rich meat sources
4. Steps must NOT contain gram/weight numbers
5. Steps must ONLY reference ingredients included in the ingredient list
6. For each ingredient provide "dbName" in English snake_case (e.g. rabbit_meat, lamb_leg, sardines_canned, zucchini, beef_heart)` : `3. Steps must NOT contain gram/weight numbers
4. Steps must ONLY reference ingredients included in the ingredient list
5. For each ingredient provide "dbName" in English snake_case (e.g. rabbit_meat, lamb_leg, sardines_canned, zucchini, beef_heart)`}

CRITICAL: Output raw JSON only. No markdown, no code blocks, no explanation text before or after. Start your response with { and end with }.
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
    const FISH_OIL_KEYWORDS = ['fish oil', '鱼油', '魚油', '어유', 'huile de poisson', 'aceite de pescado']
    const TAURINE_KEYWORDS  = ['taurine', '牛磺酸', 'タウリン', '타우린', 'taurina']
    const weightKg_         = typeof weight === 'number' ? weight : parseFloat(weight)
    const isCat_            = species === 'cat'

    const syncStepsIngredients = (result: any) => {
      const stepsText = (result.steps || []).join(' ').toLowerCase()
      if (!result.ingredients.some((i: any) => i.dbName === 'fish_oil') &&
          FISH_OIL_KEYWORDS.some(kw => stepsText.includes(kw))) {
        result.ingredients.push({
          name: SUPPLEMENT_NAMES['fish_oil']?.[locale_] || 'Fish Oil',
          dbName: 'fish_oil',
          amountG: parseFloat(Math.max(0.5, weightKg_ * 0.1).toFixed(1)),
          category: 'oil', emoji: '💧',
        })
      }
      if (!result.ingredients.some((i: any) => i.dbName === 'taurine_supplement') &&
          isCat_ && TAURINE_KEYWORDS.some(kw => stepsText.includes(kw))) {
        result.ingredients.push({
          name: SUPPLEMENT_NAMES['taurine_supplement']?.[locale_] || 'Taurine',
          dbName: 'taurine_supplement',
          amountG: parseFloat(Math.max(0.05, weightKg_ * 0.025).toFixed(2)),
          category: 'supplement', emoji: '💊',
        })
      }
    }

    // Gemini reasoning 模型需要关闭思维链输出并强制 JSON，避免返回纯推理文字
    const geminiExtras = isPro ? { include_reasoning: false } : {}

    let aiResult: any
    try {
      const completion = await openai.chat.completions.create({
        model, messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens, temperature,
        ...geminiExtras,
      } as any)
      const text = completion.choices[0]?.message?.content || ''
      console.error('[DIAG] len:', text.length, 'content:', JSON.stringify(text.slice(0, 500)))
      aiResult   = parseAIJson(text)
      syncStepsIngredients(aiResult)
    } catch (aiError: any) {
      console.error('[generate-recipe] AI call failed:', aiError?.message)
      await refundCredits(supabase, user?.id, deductSource, creditSource)
      return NextResponse.json(
        { error: `AI generation failed: ${aiError?.message || 'unknown'}` },
        { status: 500 }
      )
    }

    // ── Pro 专属：食材安全净化（静默处理，不退款不报错）────────────────────────
    if (isPro) {
      const { sanitized, removed } = sanitizeIngredients(
        aiResult.ingredients, forbiddenDbNames, safeConditions, isCat, portionGuidance, locale_
      )
      aiResult.ingredients = sanitized
      if (removed.length > 0) {
        aiResult.warnings = [
          ...(aiResult.warnings || []),
          ...removed.map((i: any) => `ingredient_removed:${i.dbName}`),
        ]
      }
    }

    // ── 营养校验 + 自动缩放 + 自动补全 ──────────────────────────────────────
    let ingredientsForValidation = (aiResult.ingredients || []).map((ing: any) => ({
      name: ing.name, dbName: ing.dbName, amountG: ing.amountG || 0,
    }))

    // Pro 用户对未知食材查 USDA
    if (isPro) {
      ingredientsForValidation = await resolveUnknownIngredients(ingredientsForValidation)
    }

    // 第一次校验（先执行食材用量上限校验）
    const { ingredients: cappedIngredients } = validateIngredients(ingredientsForValidation, petParams)
    ingredientsForValidation = cappedIngredients
    let validation = validateRecipe(ingredientsForValidation, petParams)

    // 热量偏差处理
    const targetMid   = (validation.targetCalories.min + validation.targetCalories.max) / 2
    const calorieDiff = Math.abs(validation.actualCalories - targetMid) / targetMid

    if (!validation.caloriesOk) {
      if (calorieDiff <= 0.5) {
        // 偏差 ≤ 50%：直接缩放修正
        const { scaledIngredients, revalidation } = scaleToTargetCalories(
          ingredientsForValidation, petParams, validation.actualCalories
        )
        ingredientsForValidation = scaledIngredients
        validation = revalidation

      } else if (isPro) {
        // 偏差 > 50%，Pro 用户：重新生成一次（最多1次）
        console.error('[AI-CALL#2-calorie-retry] calorieDiff:', calorieDiff.toFixed(2), 'actual:', validation.actualCalories, 'target:', targetMid)
        try {
          const retryCompletion = await openai.chat.completions.create({
            model, messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens, temperature,
            ...geminiExtras,
          } as any)
          const retryText   = retryCompletion.choices[0]?.message?.content || ''
          const retryResult = parseAIJson(retryText)

          retryResult.ingredients = retryResult.ingredients.filter((ing: any) => {
            if (forbiddenDbNames.includes(ing.dbName)) return false
            const food = ing.dbName ? findFood(ing.dbName, true) : null
            if (food && ((isCat && food.catSafe === false) || (!isCat && food.dogSafe === false))) return false
            return true
          })
          let retryIngredients = retryResult.ingredients.map((ing: any) => ({
            name: ing.name, dbName: ing.dbName, amountG: ing.amountG || 0,
          }))
          retryIngredients = await resolveUnknownIngredients(retryIngredients)

          const retryValidation = validateRecipe(retryIngredients, petParams)
          if (!retryValidation.caloriesOk) {
            const { scaledIngredients, revalidation } = scaleToTargetCalories(
              retryIngredients, petParams, retryValidation.actualCalories
            )
            ingredientsForValidation = scaledIngredients
            validation = revalidation
          } else {
            ingredientsForValidation = retryIngredients
            validation = retryValidation
          }
          aiResult = retryResult
          syncStepsIngredients(aiResult)

        } catch {
          // 重试失败：强制缩放原结果，不中断流程
          const { scaledIngredients, revalidation } = scaleToTargetCalories(
            ingredientsForValidation, petParams, validation.actualCalories
          )
          ingredientsForValidation = scaledIngredients
          validation = revalidation
        }

      } else {
        // 偏差 > 50%，免费用户：强制缩放
        const { scaledIngredients, revalidation } = scaleToTargetCalories(
          ingredientsForValidation, petParams, validation.actualCalories
        )
        ingredientsForValidation = scaledIngredients
        validation = revalidation
      }
    }

    // 合规性重试：仅在 non-compliant（≥2项失败）时重试，partial（1项轻微不达标）直接返回
    // partial 触发重试会导致 89% 的食谱额外调用一次 AI，费用翻倍但改善有限
    const maxRetries = 1
    const order = { compliant: 0, partial: 1, 'non-compliant': 2 }
    let retryCount = 0
    while (
      retryCount < maxRetries &&
      validation.complianceLabel === 'non-compliant'
    ) {
      retryCount++
      try {
        // 把当前失败项注入重试 prompt，每次重试都基于最新 validation 状态
        const failedItems: string[] = []
        const av = validation.aafco
        if (!av.protein.ok)    failedItems.push(`protein (${Math.round(av.protein.value)}g/1000kcal, need ≥${av.protein.min}g — use more meat)`)
        if (!av.fat.ok)        failedItems.push(`fat (${Math.round(av.fat.value)}g/1000kcal, need ≥${av.fat.min}g — use fattier protein like rabbit, venison, or duck)`)
        if (!av.phosphorus.ok) failedItems.push(`phosphorus (${Math.round(av.phosphorus.value)}mg/1000kcal, need ≥${av.phosphorus.min}mg — increase total meat/fish amount)`)
        if (!av.caPRatio.ok)   failedItems.push(`Ca:P ratio (${av.caPRatio.value.toFixed(2)}, need 1.0–2.5 — do NOT add extra calcium, increase phosphorus-rich meat)`)
        if (!av.omega3.ok)     failedItems.push(`omega-3 (${Math.round(av.omega3.value)}mg/1000kcal, need ≥${av.omega3.min}mg — add fatty fish or fish oil)`)
        if (!av.calcium.ok)    failedItems.push(`calcium (${Math.round(av.calcium.value)}mg/1000kcal, need ${av.calcium.min}–${av.calcium.max}mg)`)
        if (!av.taurine.ok)    failedItems.push(`taurine (${Math.round(av.taurine.value)}mg/1000kcal, need ≥${av.taurine.min}mg — add taurine supplement)`)
        const complianceHint = failedItems.length > 0
          ? `\n\nCRITICAL CORRECTION NEEDED (attempt ${retryCount}): The previous attempt failed AAFCO compliance. Fix ONLY these issues:\n${failedItems.map(f => `- ${f}`).join('\n')}\nDo not change ingredients that are already correct.`
          : ''
        console.error('[AI-CALL#3-compliance-retry] label:', validation.complianceLabel, 'failures:', failedItems.length)
        const cRetry = await openai.chat.completions.create({
          model, messages: [{ role: 'user', content: prompt + complianceHint }],
          max_tokens: maxTokens, temperature,
          ...geminiExtras,
        } as any)
        const cText  = cRetry.choices[0]?.message?.content || ''
        let cResult: any
        try { cResult = parseAIJson(cText) } catch { break }
        if (isPro) {
          const { sanitized, removed } = sanitizeIngredients(
            cResult.ingredients || [], forbiddenDbNames, safeConditions, isCat, portionGuidance, locale_
          )
          cResult.ingredients = sanitized
          if (removed.length > 0)
            cResult.warnings = [...(cResult.warnings || []), ...removed.map((i: any) => `ingredient_removed:${i.dbName}`)]
        }
        syncStepsIngredients(cResult)
        let cIngredients = (cResult.ingredients || []).map((ing: any) => ({
          name: ing.name, dbName: ing.dbName, amountG: ing.amountG || 0,
        }))
        if (isPro) cIngredients = await resolveUnknownIngredients(cIngredients)
        const { ingredients: cCappedIngredients } = validateIngredients(cIngredients, petParams)
        cIngredients = cCappedIngredients
        let cValidation = validateRecipe(cIngredients, petParams)
        if (!cValidation.caloriesOk) {
          const { scaledIngredients, revalidation } = scaleToTargetCalories(
            cIngredients, petParams, cValidation.actualCalories
          )
          cIngredients  = scaledIngredients
          cValidation   = revalidation
        }
        if (order[cValidation.complianceLabel] <= order[validation.complianceLabel]) {
          ingredientsForValidation = cIngredients
          validation               = cValidation
          aiResult                 = cResult
        }
        if (validation.complianceLabel === 'compliant') break
      } catch { break }
    }

    // 免费用户：未知食材超30% → 退还
    if (!isPro && validation.unknownIngredients.length > 0 &&
        validation.unknownIngredients.length / (aiResult.ingredients?.length || 1) > 0.3) {
      await refundCredits(supabase, user?.id, deductSource, creditSource)
      return NextResponse.json({ error: 'INGREDIENT_MISMATCH' }, { status: 500 })
    }

    // 蛋白质/脂肪严重不足 → 不再硬拒，返回食谱但带 non-compliant 标签
    // 用户通过合规性标签感知问题，可选择重新生成，不浪费已消耗的 API 成本
    if (validation.complianceLabel === 'non-compliant' &&
        !validation.aafco.protein.ok && !validation.aafco.fat.ok) {
      aiResult.warnings = [
        ...(aiResult.warnings || []),
        'nutrition_critical_warning',
      ]
    }

    // ── 用缩放后克重更新主食材，合并补充剂 ──────────────────────────────────
    const mainIngredientDbNames = new Set(
      ingredientsForValidation
        .filter((ing: { dbName?: string }) => {
          const food = ing.dbName ? findFood(ing.dbName, true) : undefined
          return !['supplement', 'oil'].includes(food?.category || '')
        })
        .map((ing: { dbName?: string }) => ing.dbName)
    )

    const scaledMainIngredients = (aiResult.ingredients || [])
      .filter((ing: any) => mainIngredientDbNames.has(ing.dbName) || !['supplement', 'oil'].includes(ing.category))
      .map((ing: any) => {
        const scaled = ingredientsForValidation.find((s: any) => s.dbName === ing.dbName)
        return {
          ...ing,
          amountG: scaled?.amountG ?? ing.amountG,
          amount:  `${scaled?.amountG ?? ing.amountG}g`,
        }
      })

    // AI 原始输出中的油/补充剂若验证器未重新添加，保留入列表以保持步骤一致性
    const validationSupplementDbNames = new Set(validation.supplements.map(s => s.dbName))
    const scaledMainDbNames           = new Set(scaledMainIngredients.map((i: any) => i.dbName))
    const aiRetainedSupplements = (aiResult.ingredients || [])
      .filter((ing: any) =>
        ['supplement', 'oil'].includes(ing.category) &&
        ing.dbName &&
        !validationSupplementDbNames.has(ing.dbName) &&
        !scaledMainDbNames.has(ing.dbName)
      )
      .map((ing: any) => ({
        ...ing,
        amount: `${ing.amountG}g`,
        autoAdded: false,
      }))

    const finalIngredients = [
      ...scaledMainIngredients,
      ...aiRetainedSupplements,
      ...validation.supplements.map(s => ({
        name:      SUPPLEMENT_NAMES[s.dbName]?.[locale_] || SUPPLEMENT_NAMES[s.dbName]?.['en'] || s.ingredient,
        dbName:    s.dbName,
        amountG:   s.amountG,
        amount:    `${s.amountG}g`,
        category:  'supplement' as const,
        emoji:     s.dbName === 'taurine_supplement' ? '💊' : s.dbName === 'fish_oil' ? '💧' : '🦴',
        autoAdded: true,
        reasonKey: s.reasonKey,
      })),
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
          calories: `${Math.round(validation.actualCalories)} kcal`,
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
        calories: `${Math.round(validation.actualCalories)} kcal`,
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
      generatedBy:        isPro ? 'gemini-3.1-pro' : 'claude-haiku',
      freeRemaining,
      proMonthlyUsed:     deductSource === 'pro_monthly',
    })

  } catch (e: any) {
    console.error('generate-recipe error:', e)
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}

// ── AI 响应 JSON 解析（兼容 Gemini reasoning model 输出）────────────────────────
function parseAIJson(text: string): any {
  // 策略1：提取 ```json ... ``` 或 ``` ... ``` 代码块内容（Gemini 常见格式）
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlock) {
    try {
      const p = JSON.parse(codeBlock[1])
      if (p.title && p.ingredients) return p
    } catch {}
  }

  // 策略2：括号深度扫描 — 遍历所有完整 {...} 块，返回第一个含 title+ingredients 的合法 JSON
  // 用于处理 Gemini reasoning model 在 JSON 前输出含 {} 的思考文本的情况
  {
    let depth = 0, start = -1
    let inString = false, escape = false
    for (let i = 0; i < text.length; i++) {
      const c = text[i]
      if (escape) { escape = false; continue }
      if (c === '\\' && inString) { escape = true; continue }
      if (c === '"') { inString = !inString; continue }
      if (inString) continue
      if (c === '{') {
        if (depth === 0) start = i
        depth++
      } else if (c === '}') {
        depth--
        if (depth === 0 && start !== -1) {
          try {
            const p = JSON.parse(text.slice(start, i + 1))
            if (p.title && p.ingredients) return p
          } catch {}
          start = -1
        }
      }
    }
  }

  // 策略3：整体直接解析
  try { return JSON.parse(text.trim()) } catch {}

  throw new Error('AI response format error')
}

// ── 退还积分辅助函数 ─────────────────────────────────────────────────────────
async function refundCredits(
  supabase: any,
  userId: string | undefined,
  source: DeductSource,
  creditSource: string | null
) {
  if (!userId || source === 'guest') return
  try {
    if (source === 'free_ai_quota') {
      await supabase.rpc('refund_free_ai', { p_user_id: userId })
    } else {
      const src = creditSource ||
        (source === 'gift_ai_points' ? 'gift' :
         source === 'paid_points'    ? 'paid' : 'pro')
      await supabase.rpc('refund_ai_credit', {
        p_user_id: userId, p_source: src, p_cost: 1,
      })
    }
  } catch { /* 退款失败静默处理，不影响主流程 */ }
}
