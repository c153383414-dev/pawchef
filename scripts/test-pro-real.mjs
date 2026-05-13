/**
 * PawChef Pro 真实食谱生成测试
 * ─────────────────────────────────────────────────────────────────────────────
 * 使用 OpenRouter Claude Sonnet 4.5（Pro 专属高级模型），
 * 完整复刻 app/api/generate-recipe/route.ts 中的 Pro 用户 Prompt 逻辑，
 * 包括 calculateRER / calculateDER / calculatePortionGuidance /
 * formatPortionGuidanceForPrompt 精确计算，与线上行为完全一致。
 *
 * 生成范围：
 *   - 单一健康状态：猫+狗各 100 条（6 种状态循环）= 200 条
 *   - 多选健康状态：猫+狗各 400 条（23 种组合循环）= 800 条
 *   - 合计：1000 条
 *
 * 并发数：3（安全，约 22 RPM，不触发 OpenRouter 限速）
 * 预估费用：~$11 USD  |  预估时间：~45 分钟
 *
 * 运行：node scripts/test-pro-real.mjs
 */

import fs       from 'fs'
import path     from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'
import OpenAI   from 'openai'
import { HttpsProxyAgent } from 'https-proxy-agent'

const __dir = path.dirname(fileURLToPath(import.meta.url))
const ROOT  = path.join(__dir, '..')

// ── 读取 .env.local ────────────────────────────────────────────────────────────
const envRaw = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const getEnv = k => envRaw.match(new RegExp(`^${k}=(.+)`, 'm'))?.[1]?.trim() ?? ''

const OPENROUTER_KEY = getEnv('OPENROUTER_API_KEY')
if (!OPENROUTER_KEY || OPENROUTER_KEY.includes('你的')) {
  console.error('❌  .env.local 中未配置真实 OPENROUTER_API_KEY，请先填入后再运行')
  process.exit(1)
}

// ── 使用 OpenAI SDK + 本地代理（curl 走 127.0.0.1:10809，Node 也需走代理） ──
// curl -sv 显示连接到 127.0.0.1:10809，固定使用该端口
const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:10809')

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey:  OPENROUTER_KEY,
  defaultHeaders: { 'X-Title': 'PawChef-Test' },
  httpAgent: proxyAgent,
})

// ── 运行配置 ───────────────────────────────────────────────────────────────────
const MODEL       = 'anthropic/claude-sonnet-4-5'   // 与生产环境 MODEL_PREMIUM 一致
const CONCURRENCY = 3                                // 3 并发 ≈ 22 RPM，安全区间
const RETRY_MAX   = 3                                // 最多重试 3 次
const MIN_GAP_MS  = 300                              // 每个 worker 两次请求间最小间隔

// ── 宠物参数范围（与前端 UI 校验保持一致） ────────────────────────────────────
const AGE_OPTIONS = [
  '<1yr','1yr','2yr','3yr','4yr','5yr',
  '6yr','7yr','8yr','9yr','10yr','11yr','12yr','12yr+'
]
// 体重：狗 1-100 kg，猫 1-15 kg（route.ts 第 67-78 行校验范围）

// ── 健康状态组合 ───────────────────────────────────────────────────────────────
const SINGLE_SETS = [
  ['healthy'],
  ['kidney'],
  ['pancreatitis'],
  ['diabetes'],
  ['obesity'],
  ['allergy'],
]

const MULTI_SETS = [
  // 2 种
  ['kidney','obesity'],         ['kidney','diabetes'],
  ['kidney','allergy'],         ['kidney','pancreatitis'],
  ['pancreatitis','obesity'],   ['pancreatitis','allergy'],
  ['pancreatitis','diabetes'],  ['diabetes','obesity'],
  ['diabetes','allergy'],       ['obesity','allergy'],
  // 3 种
  ['kidney','diabetes','obesity'],       ['kidney','pancreatitis','obesity'],
  ['kidney','diabetes','allergy'],       ['pancreatitis','diabetes','obesity'],
  ['pancreatitis','obesity','allergy'],  ['diabetes','obesity','allergy'],
  ['kidney','pancreatitis','allergy'],   ['kidney','pancreatitis','diabetes'],
  // 4 种
  ['kidney','diabetes','obesity','allergy'],
  ['kidney','pancreatitis','diabetes','obesity'],
  ['kidney','pancreatitis','obesity','allergy'],
  ['pancreatitis','diabetes','obesity','allergy'],
  // 全 5 种
  ['kidney','pancreatitis','diabetes','obesity','allergy'],
]

// ── 精确复刻 nutrition-validator.ts 中的计算函数 ─────────────────────────────

function calculateRER(weightKg) {
  return Math.round(70 * Math.pow(weightKg, 0.75))
}

function calculateDER(weightKg, ageMonths, species, conditions = []) {
  const rer   = calculateRER(weightKg)
  const isCat = species === 'cat'
  let factor

  if (ageMonths < 12) {
    factor = isCat ? 2.5 : (ageMonths < 4 ? 3.0 : 2.0)
  } else if (conditions.includes('obesity')) {
    factor = isCat ? 0.8 : 1.2
  } else {
    factor = isCat ? 1.2 : 1.6
  }

  const target = Math.round(rer * factor)
  return { min: Math.round(target * 0.9), max: Math.round(target * 1.1) }
}

function calculatePortionGuidance(weightKg, ageMonths, species, conditions = []) {
  const der       = calculateDER(weightKg, ageMonths, species, conditions)
  const targetCal = (der.min + der.max) / 2
  const isCat     = species === 'cat'
  const isPuppy   = ageMonths < 12

  const proteinRatio    = isPuppy ? 0.50 : 0.45
  const veggieRatio     = isPuppy ? 0.08 : 0.10
  const carbRatio       = isCat   ? 0    : (isPuppy ? 0.20 : 0.25)
  const catProteinRatio = isCat   ? (isPuppy ? 0.70 : 0.65) : proteinRatio

  const PROTEIN_KCAL = 150
  const VEGGIE_KCAL  = 40
  const CARB_KCAL    = 120

  const proteinG = (targetCal * (isCat ? catProteinRatio : proteinRatio)) / PROTEIN_KCAL * 100
  const veggieG  = (targetCal * veggieRatio) / VEGGIE_KCAL * 100
  const carbG    = isCat ? 0 : (targetCal * carbRatio) / CARB_KCAL * 100

  const fishOilG   = Math.max(0.5, weightKg * 0.1)
  const rawCalcium = Math.round(weightKg * (isPuppy ? 0.35 : 0.15) * 10) / 10
  const calciumCap = isCat ? 3 : isPuppy ? (weightKg < 25 ? 8 : 15) : Infinity
  const calciumG   = Math.min(rawCalcium, calciumCap)
  const taurineG   = isCat ? Math.max(0.05, Math.round(weightKg * 0.025 * 100) / 100) : null

  const range = v => ({ min: Math.max(1, Math.round(v * 0.85)), max: Math.round(v * 1.15) })
  const totalMid = proteinG + veggieG + carbG

  return {
    targetCalMin:     der.min,
    targetCalMax:     der.max,
    protein:          range(proteinG),
    veggie:           range(veggieG),
    carb:             isCat ? { min: 0, max: 0 } : range(carbG),
    fishOil:          Math.round(fishOilG * 10) / 10,
    calciumCarbonate: calciumG,
    taurine:          taurineG,
    totalWeightMin:   Math.round(totalMid * 0.85),
    totalWeightMax:   Math.round(totalMid * 1.15),
  }
}

function formatPortionGuidanceForPrompt(g, isCat) {
  const carbLine = isCat
    ? '- Carbs/grains: NOT recommended for cats (obligate carnivores)'
    : `- Carbs (rice/oatmeal): ${g.carb.min}–${g.carb.max}g`
  const taurineLine = g.taurine != null
    ? `- Taurine supplement: ${g.taurine}g (fixed, cats cannot synthesize taurine)`
    : ''
  return `Reference portions to hit calorie target ${g.targetCalMin}–${g.targetCalMax} kcal:
- Main protein (meat/fish): ${g.protein.min}–${g.protein.max}g
- Vegetables: ${g.veggie.min}–${g.veggie.max}g
${carbLine}
- Fish oil: ${g.fishOil}ml (fixed)
- Calcium carbonate: ${g.calciumCarbonate}g (fixed)
${taurineLine}
- Total food weight (excluding supplements): ${g.totalWeightMin}–${g.totalWeightMax}g
These are reference ranges. Adjust slightly to stay within calorie target.`
}

// ── 精确复刻 route.ts 的 proHealthNote（与路由逻辑 100% 一致） ────────────────
function buildHealthNote(conditions) {
  // safeConditions = 过滤掉 'healthy' 后的实际限制列表
  const safeConditions = conditions.filter(c => c !== 'healthy')
  if (safeConditions.length === 0) {
    return 'No restrictions — healthy pet, all safe ingredients allowed.'
  }
  const notes = {
    kidney:       '- Kidney disease: avoid high-phosphorus foods (spinach, legumes, excess organ meat, high-phosphorus fish). Fat must still reach ≥14g/1000kcal — use fish oil or fatty fish.',
    pancreatitis: '- Pancreatitis: STRICTLY LOW FAT — avoid salmon, duck, pork, egg yolk, any fatty meat. Fish oil max 0.1g/kg.',
    diabetes:     '- Diabetes: low glycemic — avoid white rice, sweet potato excess, sugary foods.',
    obesity:      '- Obesity: low calorie — significantly reduce carbohydrates and oils.',
    allergy:      '- Food allergy: avoid all known allergens. Use novel protein sources when uncertain.',
  }
  return `Health condition restrictions:\n${safeConditions.map(c => notes[c] || '').filter(Boolean).join('\n')}`
}

// ── 精确复刻 route.ts 的 proPrompt（逐字逐句一致） ────────────────────────────
function buildProPrompt(species, weightKg, ageMonths, conditions) {
  const isCat    = species === 'cat'
  const isPuppy  = ageMonths < 12
  const g        = calculatePortionGuidance(weightKg, ageMonths, species, conditions)
  const portionTxt  = formatPortionGuidanceForPrompt(g, isCat)
  const healthNote  = buildHealthNote(conditions)
  const fatMin      = Math.round((g.targetCalMin + g.targetCalMax) / 2 * (isPuppy ? 21 : 14) / 1000 / 9 * 10) / 10
  const fishOilMl   = Math.max(0.5, weightKg * 0.1).toFixed(1)
  const taurineG    = Math.max(0.05, weightKg * 0.025).toFixed(2)

  // 测试脚本无历史记录，recentProteinNote 等均为空（模拟首次生成的用户）
  // 相当于路由中 recentProteinNote = '' 的情况

  return `You are an expert pet nutritionist creating a personalized home-cooked meal recipe.
Respond in Chinese (Simplified).

Pet: ${isCat ? 'Cat' : 'Dog'}, ${weightKg}kg, ${ageMonths} months ${isPuppy ? `(${isCat ? 'KITTEN' : 'PUPPY'})` : '(adult)'}
${portionTxt}
${healthNote}

Choose a creative, varied protein source for today.

INGREDIENT FREEDOM — Be creative. You may use ANY safe, nutritious pet food ingredients. Consider:
- Proteins: rabbit, lamb, venison, sardines, mackerel, beef heart, chicken heart, quail egg
- Vegetables: zucchini, asparagus, blueberries, butternut squash, celery, green beans, beet
- Vary ingredients every time — do not repeat the same combination.

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
${isCat ? '\nCAT RULES: Obligate carnivore — protein >65% of calories, no grains/rice as main ingredient. Do NOT use spinach (high oxalates → urinary stones). Taurine MUST be present.' : ''}${!isCat && ageMonths >= 96 ? '\nSENIOR DOG (>8 years): Avoid spinach (high oxalates). Use broccoli or carrot instead.' : ''}
${isPuppy && !isCat ? '\nPUPPY FAT REQUIREMENT: Puppies need ≥21g fat per 1000kcal. Use salmon, duck, or egg — do NOT rely only on lean chicken.' : ''}
Calcium carbonate maximum: puppies <25kg → max 8g | puppies ≥25kg → max 15g | adults → follow calculated | cats → max 3g

FAT REQUIREMENT (CRITICAL — verify before finalizing):
- Total recipe fat must be ≥ ${fatMin}g for this pet.
- Fish oil (1-2g) alone CANNOT meet this target. You MUST ensure the protein/fat sources provide sufficient fat.
- If using lean proteins (pork loin, chicken breast, turkey breast), you MUST also include one of:
  → A high-fat secondary protein: salmon, duck, lamb, sardines, mackerel, beef heart, egg
  → OR switch to a fattier primary protein altogether.

MANDATORY:
1. Calcium: ~${g.calciumCarbonate}g calcium carbonate
2. Omega-3: ~${fishOilMl}ml fish oil (mandatory — do NOT replace with cod)
${isCat
  ? `3. Taurine: ~${taurineG}g taurine supplement OR taurine-rich meat sources
4. Steps must NOT contain gram/weight numbers
5. Steps must ONLY reference ingredients included in the ingredient list
6. For each ingredient provide "dbName" in English snake_case (e.g. rabbit_meat, lamb_leg, sardines_canned, zucchini, beef_heart)`
  : `3. Steps must NOT contain gram/weight numbers
4. Steps must ONLY reference ingredients included in the ingredient list
5. For each ingredient provide "dbName" in English snake_case (e.g. rabbit_meat, lamb_leg, sardines_canned, zucchini, beef_heart)`}

Output JSON only (no markdown):
{
  "title": "title in Chinese (Simplified)",
  "ingredients": [{ "name": "ingredient name in Chinese (Simplified)", "dbName": "english_snake_case", "amountG": 50, "category": "protein|organ|veggie|carb|supplement|oil", "emoji": "🍗" }],
  "steps": ["Step 1", "Step 2", "Step 3", "Step 4"],
  "warnings": ["health-specific warnings if any"]
}`
}

// ── OpenRouter 调用（使用 OpenAI SDK，与 route.ts 完全一致） ─────────────────
async function callAI(prompt) {
  let delay = 5000
  for (let attempt = 0; attempt <= RETRY_MAX; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model:       MODEL,
        messages:    [{ role: 'user', content: prompt }],
        max_tokens:  2000,
        temperature: 0.9,   // 与生产 route.ts 一致
      })
      const content = completion.choices[0]?.message?.content || ''
      const match   = content.match(/\{[\s\S]*\}/)
      if (!match) throw new Error(`AI 响应无 JSON（内容：${content.slice(0, 200)}）`)
      return JSON.parse(match[0])

    } catch (err) {
      // OpenAI SDK 对 429 会自动重试，这里处理其余错误
      if (attempt >= RETRY_MAX) throw err
      const isRateLimit = err?.status === 429 || err?.message?.includes('429')
      const waitMs = isRateLimit
        ? Math.min(delay * 2, 60000)
        : delay
      if (isRateLimit) console.log(`    [限速] 等待 ${Math.round(waitMs/1000)}s 后重试...`)
      await sleep(waitMs)
      delay = Math.min(delay * 2, 30000)
    }
  }
}

// ── 随机参数生成 ───────────────────────────────────────────────────────────────
const rnd    = arr => arr[Math.floor(Math.random() * arr.length)]
const rndF   = (min, max, d = 1) => parseFloat((Math.random() * (max - min) + min).toFixed(d))
const sleep  = ms => new Promise(r => setTimeout(r, ms))

function parseAgeMonths(age) {
  if (age === '<1yr') return 6
  if (age === '12yr+') return 144
  return parseInt(age) * 12
}

function randomParams(species) {
  return {
    weight:     rndF(1, species === 'cat' ? 15 : 100, 1),
    age:        rnd(AGE_OPTIONS),
  }
}

// ── 安全校验（完整版，涵盖所有客户端可见警告） ──────────────────────────────
const TOXIC_LIST = [
  { kw: 'grape',     label: '葡萄' },   { kw: '葡萄',    label: '葡萄' },
  { kw: 'raisin',    label: '葡萄干' }, { kw: '葡萄干', label: '葡萄干' },
  { kw: 'onion',     label: '洋葱' },   { kw: '洋葱',   label: '洋葱' },
  { kw: 'garlic',    label: '大蒜' },   { kw: '大蒜',   label: '大蒜' },
  { kw: 'chive',     label: '韭菜' },   { kw: '韭菜',   label: '韭菜' },
  { kw: 'leek',      label: '韭葱' },
  { kw: 'chocolate', label: '巧克力' }, { kw: '巧克力', label: '巧克力' },
  { kw: 'xylitol',   label: '木糖醇' }, { kw: '木糖醇', label: '木糖醇' },
  { kw: 'macadamia', label: '夏威夷果' },
  { kw: 'avocado',   label: '牛油果' }, { kw: '牛油果', label: '牛油果' },
  { kw: 'alcohol',   label: '酒精' },
  { kw: 'caffeine',  label: '咖啡因' },
]

function runSafetyChecks(ingredients = [], species, conditions, ageMonths) {
  const isCat  = species === 'cat'
  const issues = []    // ❌ 严重错误
  const warns  = []    // ⚠️ 警告
  const info   = []    // ✅ 正常提示

  for (const ing of ingredients) {
    const raw = `${ing.name ?? ''} ${ing.dbName ?? ''}`.toLowerCase()

    // 1. 毒性食材（绝对禁止）
    for (const t of TOXIC_LIST) {
      if (raw.includes(t.kw.toLowerCase())) {
        issues.push(`❌ 毒性食材: ${ing.name}（含 ${t.label}）— AI Prompt 明令禁止仍出现`)
      }
    }

    // 2. 猫咪菠菜（草酸→泌尿结石）
    if (isCat && (raw.includes('spinach') || raw.includes('菠菜'))) {
      issues.push(`❌ 猫咪禁用: ${ing.name}（菠菜高草酸 → 泌尿结石，Prompt 已明令禁止）`)
    }

    // 3. 老年犬（>8岁）菠菜
    if (!isCat && ageMonths >= 96 && (raw.includes('spinach') || raw.includes('菠菜'))) {
      warns.push(`⚠️ 老年犬(>8y): ${ing.name} — 菠菜高草酸，Prompt 已提示应避免`)
    }

    // 4. 肾病 + 高磷食材
    if (conditions.includes('kidney')) {
      if (raw.includes('spinach') || raw.includes('菠菜'))
        warns.push(`⚠️ 肾病+高磷: ${ing.name}（菠菜高磷）`)
      if (/legume|豌豆|green.pea|lentil/.test(raw))
        warns.push(`⚠️ 肾病+高磷: ${ing.name}（豆类高磷）`)
      if (ing.category === 'organ' && raw.includes('liver'))
        warns.push(`⚠️ 肾病+高磷: ${ing.name}（肝脏高磷，建议少量）`)
    }

    // 5. 胰腺炎 + 高脂食材
    if (conditions.includes('pancreatitis')) {
      if (/salmon|三文鱼|duck|鸭|pork|猪|mackerel|鲭|sardine|沙丁/.test(raw))
        warns.push(`⚠️ 胰腺炎+高脂: ${ing.name} — 胰腺炎应严格低脂`)
      // 鱼油量检查（胰腺炎应限量）
      if ((raw.includes('fish_oil') || raw.includes('鱼油')) && (ing.amountG ?? 0) > (ing.weightKg ?? 3) * 0.1) {
        // 无法在此精确检查，仅提示
      }
    }

    // 6. 糖尿病 + 高升糖
    if (conditions.includes('diabetes')) {
      if (raw.includes('white_rice') || raw.includes('白米') || raw.includes('白饭'))
        warns.push(`⚠️ 糖尿病+高升糖: ${ing.name}（白米饭）`)
      if (/banana|香蕉|apple|苹果|cranberry|蔓越莓/.test(raw))
        warns.push(`⚠️ 糖尿病+高糖水果: ${ing.name}`)
    }
  }

  // 7. 猫咪牛磺酸检查
  if (isCat) {
    const hasTaurine = ingredients.some(i =>
      (i.dbName || '').includes('taurine') || (i.name || '').includes('牛磺酸')
    )
    hasTaurine
      ? info.push('✅ 牛磺酸已添加')
      : warns.push('⚠️ 猫咪必需: 未检测到牛磺酸补充剂（猫无法自行合成）')
  }

  // 8. 钙源检查
  const hasCalcium = ingredients.some(i =>
    (i.dbName || '').includes('calcium') || (i.name || '').includes('碳酸钙')
  )
  hasCalcium
    ? info.push('✅ 碳酸钙已添加')
    : warns.push('⚠️ 缺少钙源: 未检测到碳酸钙（长期主食必须补钙）')

  // 9. 鱼油检查
  const hasFishOil = ingredients.some(i =>
    (i.dbName || '').includes('fish_oil') || (i.name || '').includes('鱼油')
  )
  hasFishOil
    ? info.push('✅ 鱼油已添加')
    : warns.push('⚠️ 缺少 Omega-3: 未检测到鱼油（Prompt 要求必须添加）')

  // 10. 蛋白质存在检查
  const hasProtein = ingredients.some(i => i.category === 'protein' || i.category === 'organ')
  if (!hasProtein) issues.push('❌ 食谱无蛋白质食材（protein/organ 均缺失）')

  return { issues, warns, info }
}

// ── 合规性评估 ─────────────────────────────────────────────────────────────────
function assessCompliance(result, species, conditions, ageMonths) {
  const { ingredients = [], warnings: aiWarnings = [] } = result
  const isCat = species === 'cat'
  const flags = []

  // AI 警告是否覆盖了健康限制
  const nonHealthy = conditions.filter(c => c !== 'healthy')
  if (nonHealthy.length > 0 && aiWarnings.length === 0)
    flags.push('⚠️ 有健康限制但 AI 未输出任何警告（用户看不到提示）')

  // 猫咪含碳水主食
  if (isCat) {
    const carbs = ingredients.filter(i => i.category === 'carb')
    if (carbs.length > 0)
      flags.push(`⚠️ 猫咪食谱含碳水: ${carbs.map(c => c.name).join(', ')}（猫应极低碳水）`)
  }

  // 幼崽脂肪来源
  if (ageMonths < 12 && !isCat) {
    const hasFatSource = ingredients.some(i =>
      /salmon|duck|egg|sardine|mackerel/.test((i.dbName || '').toLowerCase())
    )
    if (!hasFatSource)
      flags.push('⚠️ 幼犬缺高脂蛋白: 幼犬需 ≥21g/1000kcal 脂肪，但未见三文鱼/鸭肉/蛋')
  }

  return flags
}

// ── 单条食谱格式化（复现客户端界面全部信息） ──────────────────────────────────
function formatRecipeText(num, total, params, result, safety, complianceFlags) {
  const { species, weight, age, conditions } = params
  const isCat      = species === 'cat'
  const ageMonths  = parseAgeMonths(age)
  const g          = calculatePortionGuidance(weight, ageMonths, species, conditions)
  const { title = '？', ingredients = [], steps = [], warnings: aiWarn = [] } = result

  const condLabel = conditions.includes('healthy') && conditions.length === 1
    ? '健康'
    : conditions.filter(c => c !== 'healthy').join(' + ')

  const ageLabel =
    age === '<1yr'  ? '< 1 岁（幼崽期）' :
    age === '12yr+' ? '12 岁以上（老年）' :
    `${age.replace('yr', '')} 岁`

  const S = '═'.repeat(92)
  const s = '─'.repeat(92)

  // 营养估算行（真实路由会做 AAFCO 校验，这里显示 AI 输出的估算）
  const nutrition = result.nutrition || {}
  const calLine = nutrition.calories
    ? `热量: ~${nutrition.calories} kcal  |  蛋白质: ${nutrition.protein ?? '—'}g  |  脂肪: ${nutrition.fat ?? '—'}g  |  碳水: ${nutrition.carbs ?? '—'}g`
    : '（AI 未输出营养估算 — 真实路由会通过 AAFCO 校验后计算）'

  // 真实路由补充说明
  const routeNote =
    '📌 真实路由还会：① USDA 查询未知食材营养值  ② AAFCO 合规性校验  ' +
    '③ 必要时重新生成（最多3次）  ④ 自动缩放克重到目标热量范围  ⑤ 自动注入碳酸钙/鱼油/牛磺酸'

  const lines = [
    '',
    S,
    ` #${String(num).padStart(4, '0')} / ${total}    ${isCat ? '🐈 猫' : '🐕 狗'}  |  体重: ${weight} kg  |  年龄: ${ageLabel}  |  健康状况: 【${condLabel}】`,
    ` 目标热量: ${g.targetCalMin}–${g.targetCalMax} kcal  |  蛋白参考: ${g.protein.min}–${g.protein.max}g  |  钙: ${g.calciumCarbonate}g  |  鱼油: ${g.fishOil}ml${g.taurine != null ? `  |  牛磺酸: ${g.taurine}g` : ''}`,
    S,
    `【标题】 ${title}`,
    s,
    '【食材列表】',
    ...ingredients.map(i => {
      const catZh = { protein:'蛋白质', organ:'内脏', veggie:'蔬菜', carb:'碳水', supplement:'补充剂', oil:'油脂' }[i.category] || i.category
      return `  ${(i.emoji || '🍖').padEnd(2)} ${String(i.name || '?').padEnd(20)} ${String(i.amountG ?? '?').padStart(7)}g  [${catZh}]  dbName: ${i.dbName || '—'}`
    }),
    s,
    '【烹饪步骤】',
    ...steps.map((step, i) => `  ${i + 1}. ${step}`),
    s,
    `【营养摘要（AI 估算）】  ${calLine}`,
    s,
    '【AI 提示 / 警告（客户端直接显示给用户）】',
    ...(aiWarn.length > 0
      ? aiWarn.map(w => `  ⚡ ${w}`)
      : ['  （AI 本次未输出健康警告）']
    ),
    s,
    '【自动安全校验结果】',
    ...safety.issues.map(l => `  ${l}`),
    ...safety.warns.map(l => `  ${l}`),
    ...safety.info.map(l => `  ${l}`),
    ...complianceFlags.map(l => `  ${l}`),
    ...(safety.issues.length === 0 && safety.warns.length === 0 && complianceFlags.length === 0
      ? ['  ✅ 通过所有安全校验']
      : []
    ),
    s,
    routeNote,
  ]

  return lines.join('\n')
}

// ── 并发执行池 ─────────────────────────────────────────────────────────────────
async function runPool(taskDefs, concurrency, onResult) {
  let idx = 0
  async function worker() {
    while (idx < taskDefs.length) {
      const i    = idx++
      const def  = taskDefs[i]
      const t0   = Date.now()
      const res  = await def()
      onResult(i, res)
      // 保证每个 worker 两次请求之间有最小间隔
      const elapsed = Date.now() - t0
      if (elapsed < MIN_GAP_MS) await sleep(MIN_GAP_MS - elapsed)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, taskDefs.length) }, worker))
}

// ── 构建任务列表（打乱顺序，避免同物种/同条件连续涌入） ────────────────────────
function buildTasks() {
  const list = []

  // 单一健康状态：猫+狗各 100
  for (const sp of ['dog', 'cat']) {
    for (let i = 0; i < 100; i++) {
      list.push({ species: sp, conditions: SINGLE_SETS[i % SINGLE_SETS.length], group: 'single' })
    }
  }

  // 多选健康状态：猫+狗各 400
  for (const sp of ['dog', 'cat']) {
    for (let i = 0; i < 400; i++) {
      list.push({ species: sp, conditions: MULTI_SETS[i % MULTI_SETS.length], group: 'multi' })
    }
  }

  // Fisher-Yates 打乱
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }

  return list
}

// ── 用户确认 ───────────────────────────────────────────────────────────────────
async function confirm(q) {
  if (process.argv.includes('--yes')) return 'y'
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(r => rl.question(q, a => { rl.close(); r(a.trim().toLowerCase()) }))
}

// ── 主程序 ─────────────────────────────────────────────────────────────────────
async function main() {
  const tasks = buildTasks()
  const total = tasks.length

  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║    PawChef Pro 真实食谱生成测试  (Claude Sonnet 4.5)             ║')
  console.log('║    Prompt 逻辑与 route.ts proPrompt 100% 一致                    ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  console.log()
  console.log(`  总条数:   ${total} 条`)
  console.log(`    ├ 单一健康状态: 猫+狗各 100 条 = 200 条`)
  console.log(`    └ 多选健康状态: 猫+狗各 400 条 = 800 条`)
  console.log(`  模型:     ${MODEL}  (temperature=0.9，与生产一致)`)
  console.log(`  并发数:   ${CONCURRENCY}  (≈ 22 RPM，安全区间)`)
  console.log(`  预估费用: ~$${(total * 0.011).toFixed(2)} USD`)
  console.log(`  预估时间: ~${Math.ceil(total / CONCURRENCY * 8 / 60)} 分钟`)
  console.log()
  console.log('  说明: 本脚本直接调用 OpenRouter，无需 Supabase 认证，不消耗 Pro 月额度。')
  console.log('        Prompt 与真实路由完全一致（已精确移植所有计算函数）。')
  console.log('        真实路由的后置步骤（USDA 查询 / AAFCO 校验 / 自动缩放）')
  console.log('        会在报告中注明，但不重复执行（目的是评估 AI 原始输出质量）。')
  console.log()

  const ans = await confirm('  确认开始生成？(y/n): ')
  if (ans !== 'y' && ans !== 'yes') { console.log('  已取消。'); return }

  // 创建输出文件
  const ts      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outText = path.join(ROOT, `pro-test-${ts}.txt`)
  const outJson = path.join(ROOT, `pro-test-${ts}.jsonl`)
  const txtWS   = fs.createWriteStream(outText, { flags: 'a' })
  const jsonWS  = fs.createWriteStream(outJson, { flags: 'a' })

  txtWS.write(
    `PawChef Pro 真实食谱测试报告\n` +
    `生成时间: ${new Date().toLocaleString()}\n` +
    `模型: ${MODEL}\n` +
    `总计: ${total} 条 (单一200 + 多选800)\n` +
    `${'═'.repeat(92)}\n`
  )

  // 统计
  const S = { done: 0, err: 0, critical: 0, warned: 0, toxic: 0, noTaurine: 0, noCalcium: 0, noFishOil: 0 }
  const allResults = new Array(total).fill(null)
  const t0  = Date.now()
  let done  = 0

  await runPool(
    tasks.map((def, idx) => async () => {
      const { species, conditions } = def
      const { weight, age }         = randomParams(species)
      const ageMonths               = parseAgeMonths(age)
      const num                     = idx + 1

      let result, safety, compFlags, errMsg = null

      try {
        const prompt = buildProPrompt(species, weight, ageMonths, conditions)
        result       = await callAI(prompt)
        safety       = runSafetyChecks(result.ingredients, species, conditions, ageMonths)
        compFlags    = assessCompliance(result, species, conditions, ageMonths)
      } catch (e) {
        errMsg   = e.message
        safety   = { issues: [], warns: [], info: [] }
        compFlags = []
        result   = {}
        S.err++
      }

      const params = { species, weight, age, conditions }

      // 更新统计
      done++; S.done++
      if (safety.issues.length > 0 || compFlags.some(f => f.startsWith('❌')))  S.critical++
      if (safety.warns.length > 0  || compFlags.some(f => f.startsWith('⚠️')))  S.warned++
      if (safety.issues.some(i => i.includes('毒性')))  S.toxic++
      if (safety.warns.some(w => w.includes('牛磺酸')))  S.noTaurine++
      if (safety.warns.some(w => w.includes('钙源')))    S.noCalcium++
      if (safety.warns.some(w => w.includes('Omega')))   S.noFishOil++

      // 控制台进度
      const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
      const eta     = done > 0 ? Math.ceil((total - done) * (Date.now() - t0) / done / 1000) : '?'
      const marks   = [
        safety.issues.length > 0   ? `❌×${safety.issues.length}` : '',
        safety.warns.length > 0    ? `⚠️×${safety.warns.length}` : '',
        compFlags.length > 0       ? `📋×${compFlags.length}` : '',
        errMsg                     ? `💥 ERR` : '',
      ].filter(Boolean).join(' ')
      const preview = errMsg
        ? `ERROR: ${errMsg.slice(0, 40)}`
        : (result.title || '').slice(0, 28)
      console.log(
        `[${String(done).padStart(4)}/${total}] ${species === 'cat' ? '🐈' : '🐕'} ` +
        `${String(weight).padEnd(5)}kg ${age.padEnd(5)} [${conditions.join('+').padEnd(35)}] ` +
        `→ ${preview.padEnd(30)} ${marks}  (${elapsed}s, ETA ${eta}s)`
      )

      // 保存结果
      const text = errMsg
        ? `\n${'─'.repeat(92)}\n #${num} ERROR: ${species} ${conditions.join('+')} ${weight}kg ${age}\n  → ${errMsg}\n`
        : formatRecipeText(num, total, params, result, safety, compFlags)

      allResults[idx] = {
        text,
        json: {
          num, species, weight, age, conditions,
          ...(errMsg ? { error: errMsg } : result),
          safety, compFlags,
        },
      }
    }),
    CONCURRENCY,
    () => {}
  )

  // 按序写入文件
  for (const r of allResults) {
    if (!r) continue
    txtWS.write(r.text + '\n')
    jsonWS.write(JSON.stringify(r.json) + '\n')
  }

  // 统计摘要
  const summary = [
    '',
    '═'.repeat(92),
    ' 测试完成 — 汇总统计',
    '═'.repeat(92),
    `  总计生成:         ${S.done} 条 / 失败: ${S.err} 条`,
    `  ❌ 含严重问题:    ${S.critical} 条  ← 优先处理`,
    `  ⚠️  含安全警告:   ${S.warned} 条`,
    `  🚨 毒性食材出现:  ${S.toxic} 条  ← 如 > 0 立即检查`,
    `  猫缺牛磺酸:       ${S.noTaurine} 条`,
    `  缺碳酸钙:         ${S.noCalcium} 条`,
    `  缺鱼油:           ${S.noFishOil} 条`,
  ]
  txtWS.write(summary.join('\n') + '\n')
  await new Promise(r => txtWS.end(r))
  await new Promise(r => jsonWS.end(r))

  console.log(summary.join('\n'))
  console.log()
  console.log(`  📄 文本报告: ${outText}`)
  console.log(`  📊 JSON数据: ${outJson}`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
