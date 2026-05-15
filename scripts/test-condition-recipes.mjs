/**
 * PawChef 病症食谱 AI 真实生成测试
 * ─────────────────────────────────────────────────────────────────────────────
 * 目的：验证 buildConditionGuidance() 注入的 Prompt 能引导 AI 生成符合
 *       病症营养标准的食谱（IRIS / ACVIM / AAHA）。
 *
 * 测试规格：
 *   - 6 健康状况 × 2 物种 = 12 组合，每组 50 条 → 共 600 条
 *   - 健康状况: healthy / kidney / pancreatitis / diabetes / obesity / allergy
 *   - 并发数: 3  |  预估费用: ~$0.50 USD  |  预估时间: ~20 分钟
 *   - 模型: google/gemini-3.1-flash-lite（与生产 Pro 环境完全一致）
 *
 * 校验逻辑（与 lib/condition-standards.ts 完全对齐）：
 *   healthy      : 定性检查（无病症约束）
 *   kidney dog   : 磷 < 1200 mg/1000kcal
 *   kidney cat   : 磷 < 1350 mg/1000kcal; 蛋白 ≥ 58 g/1000kcal
 *   pancreatitis dog : 脂肪 < 35 g/1000kcal
 *   pancreatitis cat : 无脂肪限制（ACVIM 2021）
 *   diabetes cat : 碳水 < 30 g/1000kcal; 蛋白 ≥ 100 g/1000kcal
 *   diabetes dog : 仅定性检查（无数值目标，AAHA 2018）
 *   obesity      : 仅定性检查（热量已由 DER×0.8 控制，AAHA 2021）
 *   allergy      : 定性检查（新奇蛋白 + 无常见过敏源）
 *
 * 营养估算：使用内联简化营养数据库（per 100g）计算 per-1000kcal 值。
 * 未知食材会触发 ⚠️ 提示，但不影响已知食材的汇总。
 *
 * 运行：node scripts/test-condition-recipes.mjs [--yes]
 */

import fs       from 'fs'
import path     from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'
import OpenAI   from 'openai'
import { HttpsProxyAgent } from 'https-proxy-agent'

const __dir = path.dirname(fileURLToPath(import.meta.url))
const ROOT  = path.join(__dir, '..')

// ── 环境 ──────────────────────────────────────────────────────────────────────
const envRaw = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const getEnv = k => envRaw.match(new RegExp(`^${k}=(.+)`, 'm'))?.[1]?.trim() ?? ''
const OPENROUTER_KEY = getEnv('OPENROUTER_API_KEY')
if (!OPENROUTER_KEY || OPENROUTER_KEY.includes('你的')) {
  console.error('❌  请先在 .env.local 中配置真实的 OPENROUTER_API_KEY')
  process.exit(1)
}

const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:10809')
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey:  OPENROUTER_KEY,
  defaultHeaders: { 'X-Title': 'PawChef-ConditionTest' },
  httpAgent: proxyAgent,
})

const MODEL       = 'google/gemini-3.1-flash-lite'  // 与生产 Pro 环境一致（route.ts MODEL_PREMIUM）
const CONCURRENCY = 3
const RECIPES_PER_COMBO = 50

// ── 内联简化营养数据库（per 100g）────────────────────────────────────────────
// 字段: [protein_g, fat_g, carbs_g, phosphorus_mg, kcal_per_100g]
// 来源：USDA FoodData Central 代表性数值，用于测试估算，不用于生产
const INLINE_DB = {
  // 蛋白质 - 精瘦
  chicken_breast:   [31.0, 3.6, 0.0, 220, 165],
  turkey_breast:    [29.0, 1.0, 0.0, 210, 135],
  rabbit_meat:      [22.0, 5.0, 0.0, 230, 136],
  venison:          [26.0, 2.4, 0.0, 205, 130],
  cod:              [17.8, 0.7, 0.0, 220,  82],
  white_fish:       [18.0, 1.0, 0.0, 215,  82],
  tilapia:          [20.0, 2.7, 0.0, 204, 108],
  // 蛋白质 - 中脂
  beef:             [26.1, 15.0, 0.0, 200, 250],
  beef_lean:        [26.0, 8.0, 0.0, 195, 180],
  pork_loin:        [27.0, 6.0, 0.0, 200, 165],
  chicken_thigh:    [24.0, 9.0, 0.0, 210, 177],
  quail:            [22.0, 8.0, 0.0, 285, 161],
  quail_egg:        [13.1, 11.1, 0.6, 218, 158],
  egg:              [12.6, 10.6, 0.7, 198, 155],
  // 蛋白质 - 高脂
  salmon:           [20.0, 13.4, 0.0, 260, 208],
  duck:             [19.0, 28.0, 0.0, 170, 337],
  lamb:             [25.0, 21.0, 0.0, 188, 294],
  pork_belly:       [14.0, 35.0, 0.0, 146, 518],
  mackerel:         [18.6, 13.9, 0.0, 217, 205],
  sardines:         [24.6, 11.5, 0.0, 490, 208],  // 骨头带来高磷
  sardines_canned:  [24.6, 11.5, 0.0, 490, 208],
  anchovies:        [29.0, 10.0, 0.0, 420, 210],
  herring:          [18.0, 9.0, 0.0, 236, 158],
  // 内脏
  beef_heart:       [17.7, 5.3, 0.1, 212, 112],
  chicken_liver:    [17.1, 5.0, 0.9, 362, 119],  // 高磷
  beef_liver:       [20.4, 3.6, 3.9, 387, 135],  // 高磷
  pork_liver:       [21.4, 3.7, 2.5, 362, 130],
  kidney:           [17.4, 4.0, 0.8, 269, 112],
  // 蔬菜（低磷）
  zucchini:         [1.2, 0.3, 3.1,  38,  17],
  broccoli:         [2.8, 0.4, 6.6,  66,  34],
  carrot:           [0.9, 0.2, 9.6,  35,  41],
  green_beans:      [1.8, 0.2, 6.9,  38,  31],
  asparagus:        [2.2, 0.1, 3.9,  52,  20],
  celery:           [0.7, 0.1, 3.0,  24,  16],
  cucumber:         [0.7, 0.1, 3.6,  24,  15],
  butternut_squash: [1.0, 0.1, 11.7, 33,  45],
  beet:             [1.6, 0.2, 9.6,  40,  43],
  blueberries:      [0.7, 0.3, 14.5, 12,  57],
  pumpkin:          [1.0, 0.1, 7.0,  44,  26],
  apple:            [0.3, 0.2, 13.8,  11,  52],
  // 碳水
  sweet_potato:     [1.6, 0.1, 20.1, 47,  86],
  white_rice:       [2.7, 0.3, 28.2, 43, 130],
  brown_rice:       [2.6, 0.9, 22.8, 83, 111],
  oatmeal:          [2.5, 1.7, 12.0, 52,  71],
  millet:           [3.5, 1.0, 23.7, 100, 119],
  quinoa:           [4.4, 1.9, 21.3, 152, 120],
  // 豆类（肾病高磷）
  green_peas:       [5.4, 0.4, 14.5, 108,  81],
  lentils:          [9.0, 0.4, 20.1, 180, 116],
  // 补充剂（不计入营养总量）
  fish_oil:         [0.0, 100.0, 0.0, 0, 902],
  calcium_carbonate:[0.0, 0.0, 0.0, 0,   0],
  taurine_supplement:[0.0,0.0, 0.0, 0,   0],
  taurine:          [0.0, 0.0, 0.0, 0,   0],
}

// 类别匹配（用于 fallback 估算）
const CATEGORY_FALLBACKS = {
  protein: [22.0, 8.0, 0.0, 200, 160],
  organ:   [18.0, 5.0, 1.0, 300, 120],
  veggie:  [1.5,  0.2, 6.0,  45,  30],
  carb:    [2.5,  0.5, 22.0, 70, 110],
  supplement:[0,  0.0, 0.0,   0,   0],
  oil:     [0.0, 100.0, 0.0,  0, 902],
}

/** per 100g → 计算整份食谱 per 1000 kcal 的营养数值 */
function estimateNutrients(ingredients) {
  let totalKcal = 0, totalProtein = 0, totalFat = 0, totalCarbs = 0, totalPhos = 0
  const unknowns = []

  for (const ing of ingredients) {
    const amtG     = ing.amountG ?? 0
    const dbName   = (ing.dbName ?? '').toLowerCase().replace(/-/g, '_')
    const category = (ing.category ?? '').toLowerCase()

    // 补充剂不计入宏量（只计热量用于校准）
    if (['supplement', 'oil'].includes(category) && dbName.includes('calcium')) continue

    let row = INLINE_DB[dbName]
    if (!row) {
      // 尝试部分匹配
      const key = Object.keys(INLINE_DB).find(k => dbName.includes(k) || k.includes(dbName.split('_')[0]))
      if (key) row = INLINE_DB[key]
    }
    if (!row) {
      row = CATEGORY_FALLBACKS[category] || CATEGORY_FALLBACKS['protein']
      unknowns.push(dbName)
    }

    const [protG, fatG, carbG, phosM, kcal] = row
    const factor = amtG / 100
    totalKcal    += kcal * factor
    totalProtein += protG * factor
    totalFat     += fatG  * factor
    totalCarbs   += carbG * factor
    totalPhos    += phosM * factor
  }

  if (totalKcal < 1) return { ok: false, msg: '热量为0，无法计算', unknowns }

  const per1000 = v => (v / totalKcal) * 1000

  return {
    ok: true,
    totalKcal: Math.round(totalKcal),
    protein:    Math.round(per1000(totalProtein)),
    fat:        Math.round(per1000(totalFat) * 10) / 10,
    carbs:      Math.round(per1000(totalCarbs)),
    phosphorus: Math.round(per1000(totalPhos)),
    unknowns,
  }
}

// ── 内联病症标准（与 lib/condition-standards.ts 完全一致）────────────────────
const CONDITION_STANDARDS = {
  healthy: {
    dog: {}, // 无病症约束，仅定性检查
    cat: {},
  },
  kidney: {
    dog: { phosphorus: { max: 1200 } },
    cat: { phosphorus: { max: 1350 }, protein: { min: 58 } },
  },
  pancreatitis: {
    dog: { fat: { max: 35 } },
    cat: {}, // 无限制（ACVIM 2021）
  },
  diabetes: {
    dog: {}, // 无数值目标（AAHA 2018，仅定性）
    cat: { carbs: { maxG: 30 }, protein: { min: 100 } },
  },
  obesity: {
    dog: {}, // 无宏量目标（热量已由 DER×0.8 控制）
    cat: {},
  },
  allergy: {
    dog: {}, // 仅定性检查（新奇蛋白 + 回避常见过敏源）
    cat: {},
  },
}

function validateCondition(nutrients, species, condition) {
  const targets = CONDITION_STANDARDS[condition][species]
  const failures = []

  if (targets.phosphorus?.max !== undefined && nutrients.phosphorus > targets.phosphorus.max)
    failures.push(`磷 ${nutrients.phosphorus} mg > 上限 ${targets.phosphorus.max} mg`)

  if (targets.fat?.max !== undefined && nutrients.fat > targets.fat.max)
    failures.push(`脂肪 ${nutrients.fat} g > 上限 ${targets.fat.max} g`)

  if (targets.carbs?.maxG !== undefined && nutrients.carbs > targets.carbs.maxG)
    failures.push(`碳水 ${nutrients.carbs} g > 上限 ${targets.carbs.maxG} g`)

  if (targets.protein?.min !== undefined && nutrients.protein < targets.protein.min)
    failures.push(`蛋白 ${nutrients.protein} g < 下限 ${targets.protein.min} g`)

  return { pass: failures.length === 0, failures }
}

// ── 定性检查（ingredient-level red flag）────────────────────────────────────
// 过敏源：常见过敏食材（chicken / beef / dairy / wheat / egg / soy）
const ALLERGY_FLAGS = [
  { pattern: /\bchicken\b|鸡肉|鸡胸|鸡腿|鸡心/i,         label: '鸡肉（常见过敏源）' },
  { pattern: /\bbeef\b|牛肉|牛心|牛肝|beef_heart|beef_liver/i, label: '牛肉（常见过敏源）' },
  { pattern: /dairy|milk|cheese|乳制品|牛奶|奶酪/i,        label: '乳制品（常见过敏源）' },
  { pattern: /wheat|小麦|面粉/i,                            label: '小麦（常见过敏源）' },
  { pattern: /\begg\b|鸡蛋/i,                               label: '鸡蛋（常见过敏源）' },
  { pattern: /\bsoy\b|soybean|豆腐|大豆/i,                  label: '大豆（常见过敏源）' },
]

const RED_FLAGS = {
  'healthy': {
    dog: [], // 无病症限制，定性通过安全基础检查
    cat: [],
  },
  'kidney': {
    dog: [
      { pattern: /spinach|菠菜/i,                label: '菠菜（高草酸+磷）' },
      { pattern: /green_pea|lentil|legume|豌豆/i, label: '豆类（高磷）' },
      { pattern: /dairy|milk|cheese|乳制品/i,     label: '乳制品（高磷）' },
    ],
    cat: [
      { pattern: /spinach|菠菜/i,                label: '菠菜（高草酸+磷）' },
      { pattern: /green_pea|lentil|legume|豌豆/i, label: '豆类（高磷）' },
      { pattern: /dairy|milk|cheese|乳制品/i,     label: '乳制品（高磷）' },
    ],
  },
  'pancreatitis': {
    dog: [
      { pattern: /\bsalmon\b|三文鱼/i,      label: '三文鱼（高脂）' },
      { pattern: /\bduck\b|鸭肉/i,          label: '鸭肉（高脂）' },
      { pattern: /pork_belly|猪腩|猪肚/i,   label: '猪腩（极高脂）' },
      { pattern: /\blamb\b|羊肉/i,          label: '羊肉（高脂）' },
      { pattern: /mackerel|鲭鱼/i,          label: '鲭鱼（高脂）' },
      { pattern: /vegetable_oil|olive_oil|cooking_oil|植物油|橄榄油/i, label: '额外食用油' },
    ],
    cat: [], // 猫无禁用（ACVIM 2021）
  },
  'diabetes': {
    dog: [
      { pattern: /white_rice|白米|白饭/i,  label: '白米饭（高升糖）' },
      { pattern: /banana|香蕉/i,            label: '香蕉（高糖）' },
    ],
    cat: [
      { pattern: /white_rice|(?<!\w)rice(?!\w)|大米|白米|燕麦|oat|millet|小米/i, label: '谷物/淀粉（碳水过高）' },
      { pattern: /sweet_potato|番薯|红薯/i,  label: '番薯（高碳水）' },
      { pattern: /banana|香蕉/i,             label: '香蕉（高糖）' },
    ],
  },
  'obesity': {
    dog: [
      { pattern: /vegetable_oil|olive_oil|cooking_oil|植物油|橄榄油/i, label: '额外食用油（增加热量）' },
    ],
    cat: [
      { pattern: /vegetable_oil|olive_oil|cooking_oil|植物油|橄榄油/i, label: '额外食用油（增加热量）' },
    ],
  },
  'allergy': {
    dog: ALLERGY_FLAGS,
    cat: ALLERGY_FLAGS,
  },
}

function qualityCheck(ingredients, species, condition) {
  const flags = RED_FLAGS[condition]?.[species] ?? []
  const hits = []
  for (const ing of ingredients) {
    const raw = `${ing.name ?? ''} ${ing.dbName ?? ''}`
    for (const flag of flags) {
      if (flag.pattern.test(raw)) {
        hits.push(`❌ 红旗食材: ${ing.name}（${flag.label}）`)
      }
    }
  }
  return hits
}

// ── 完全复刻 route.ts 中的计算函数 ────────────────────────────────────────────
function calculateRER(w) { return Math.round(70 * Math.pow(w, 0.75)) }
function calculateDER(w, ageMonths, species, condition) {
  const rer = calculateRER(w), isCat = species === 'cat'
  let f = ageMonths < 12 ? (isCat ? 2.5 : ageMonths < 4 ? 3.0 : 2.0)
        : condition === 'obesity' ? 0.8
        : (isCat ? 1.2 : 1.6)
  const t = Math.round(rer * f)
  return { min: Math.round(t * 0.9), max: Math.round(t * 1.1) }
}
function calculatePortionGuidance(w, ageMonths, species, condition) {
  const der       = calculateDER(w, ageMonths, species, condition)
  const targetCal = (der.min + der.max) / 2
  const isCat     = species === 'cat'
  const isPuppy   = ageMonths < 12
  const catProteinRatio = isPuppy ? 0.70 : 0.65
  const proteinRatio    = isPuppy ? 0.50 : 0.45
  const veggieRatio     = isPuppy ? 0.08 : 0.10
  const carbRatio       = isCat   ? 0    : (isPuppy ? 0.20 : 0.25)
  const proteinG  = (targetCal * (isCat ? catProteinRatio : proteinRatio)) / 150 * 100
  const veggieG   = (targetCal * veggieRatio) / 40 * 100
  const carbG     = isCat ? 0 : (targetCal * carbRatio) / 120 * 100
  const fishOilG  = Math.max(0.5, w * 0.1)
  const calciumG  = Math.min(w * 0.15, isCat ? 3 : Infinity)
  const taurineG  = isCat ? Math.max(0.05, Math.round(w * 0.025 * 100) / 100) : null
  const range = v => ({ min: Math.max(1, Math.round(v * 0.85)), max: Math.round(v * 1.15) })
  const totalMid  = proteinG + veggieG + carbG
  return {
    targetCalMin: der.min, targetCalMax: der.max,
    protein: range(proteinG), veggie: range(veggieG),
    carb: isCat ? { min: 0, max: 0 } : range(carbG),
    fishOil: Math.round(fishOilG * 10) / 10,
    calciumCarbonate: Math.round(calciumG * 10) / 10,
    taurine: taurineG,
    totalWeightMin: Math.round(totalMid * 0.85),
    totalWeightMax: Math.round(totalMid * 1.15),
  }
}

// ── 内联 buildConditionGuidance（与 lib/condition-prompt.ts 完全一致）─────────
function buildConditionGuidance(condition, species) {
  switch (condition) {
    case 'kidney':
      return `KIDNEY DISEASE DIETARY REQUIREMENTS:
- Use low-phosphorus ingredients. Target: phosphorus <1200 mg/1000kcal (dogs) / <1350 mg/1000kcal (cats).
- Avoid high-phosphorus foods: dairy, fish bones, legumes, organ meats in large amounts.
- Sardines/anchovies: use sparingly (≤20g) due to high phosphorus from bones.
- Omega-3 (EPA+DHA) is beneficial for kidney health — a small amount of fatty fish or fish oil is a useful option but not required every recipe.
- Do NOT restrict protein excessively for cats — risk of muscle wasting. Vary protein sources across recipes.
- Reference: Cline 2016 (ACVN); IRIS CKD Treatment Recommendations 2023`

    case 'pancreatitis':
      if (species === 'cat') {
        return `PANCREATITIS DIETARY REQUIREMENTS (CAT):
- Do NOT restrict fat for cats with pancreatitis — no scientific evidence supports fat restriction in cats.
- Focus on caloric density to prevent weight loss. Vary protein sources across recipes.
- High-quality animal protein is essential. Taurine supplementation is handled automatically.
- Reference: Forman et al, ACVIM Consensus Statement, JVIM 2021`
      }
      return `PANCREATITIS DIETARY REQUIREMENTS (DOG):
- Keep total recipe fat LOW. Target: fat <35g/1000kcal (approx. <15% dry matter).
- Avoid: duck, salmon, lamb, pork belly, added cooking oils, fatty organ meats.
- All other proteins are acceptable — rotate widely across recipes for variety (chicken, turkey, rabbit, venison, beef, white fish, and others all work within the fat limit).
- Include easily digestible vegetables and moderate fiber.
- Reference: Kathrani A, JAVMA 2024 (expert opinion)`

    case 'diabetes':
      if (species === 'cat') {
        return `DIABETES DIETARY REQUIREMENTS (CAT):
- MINIMIZE carbohydrates. Target: <12% of metabolizable energy = <30g carbs/1000kcal.
- HIGH PROTEIN diet. Target: ≥40% of ME from protein = ≥100g protein/1000kcal.
- Avoid grains, starchy vegetables, legumes entirely.
- Use any high-quality animal protein source — rotate widely across recipes for variety. No plant protein sources.
- Reference: AAHA Diabetes Management Guidelines 2018/2022`
      }
      return `DIABETES DIETARY REQUIREMENTS (DOG):
- Include HIGH FIBER vegetables — prioritize non-starchy, high-fiber options. Vary the vegetable selection across recipes.
- Avoid simple sugars, grains, and high-glycemic carbohydrates.
- Consistent portion size is critical — do not vary ingredient amounts significantly.
- Maintain adequate protein from varied sources. No specific carbohydrate target — fiber content matters most.
- Reference: AAHA Diabetes Management Guidelines 2018/2022`

    case 'obesity':
      return `WEIGHT MANAGEMENT DIETARY REQUIREMENTS:
- Calories are already reduced to 80% of maintenance (AAHA 2021 guideline).
- HIGH PROTEIN from varied animal protein sources — rotate across recipes to maintain interest and palatability.
- Include non-starchy, high-fiber vegetables for satiety. Vary vegetable selection across recipes.
- Avoid added oils and calorie-dense extras. No fat restriction on protein sources themselves.
- Minimize starchy vegetables (potato, sweet potato, pumpkin, corn).
- Reference: AAHA Nutrition and Weight Management Guidelines 2021`

    case 'allergy':
      return `FOOD ALLERGY / NOVEL PROTEIN REQUIREMENTS:
- Use NOVEL PROTEIN sources the pet has not been exposed to previously.
- Strictly avoid common allergens: chicken, beef, dairy, wheat, eggs, soy.
- Use a single protein source only — do not mix proteins.
- All ingredients must be whole, single-ingredient foods (no processed items).`

    default:
      return '' // healthy — no condition guidance needed
  }
}

// ── Prompt 构建（病症专版）────────────────────────────────────────────────────
function buildConditionPrompt(species, weightKg, ageMonths, condition) {
  const isCat   = species === 'cat'
  const g       = calculatePortionGuidance(weightKg, ageMonths, species, condition)
  const carbLine = isCat
    ? '- Carbs/grains: NOT recommended for cats (obligate carnivores)'
    : `- Carbs (rice/oatmeal): ${g.carb.min}–${g.carb.max}g`
  const taurineLine = g.taurine != null
    ? `- Taurine supplement: ${g.taurine}g (fixed, cats cannot synthesize taurine)`
    : ''
  const portionTxt = `Reference portions to hit calorie target ${g.targetCalMin}–${g.targetCalMax} kcal:
- Main protein (meat/fish): ${g.protein.min}–${g.protein.max}g
- Vegetables: ${g.veggie.min}–${g.veggie.max}g
${carbLine}
- Fish oil: ${g.fishOil}ml (fixed)
- Calcium carbonate: ${g.calciumCarbonate}g (fixed)
${taurineLine}
- Total food weight (excluding supplements): ${g.totalWeightMin}–${g.totalWeightMax}g
These are reference ranges. Adjust slightly to stay within calorie target.`

  const conditionGuidance = buildConditionGuidance(condition, species)
  const fatMin = Math.round((g.targetCalMin + g.targetCalMax) / 2 * 14 / 1000 / 9 * 10) / 10
  const fishOilMl = g.fishOil.toFixed(1)
  const taurineG  = g.taurine != null ? g.taurine.toFixed(2) : null

  return `You are an expert pet nutritionist creating a personalized home-cooked meal recipe.
Respond in Chinese (Simplified).

Pet: ${isCat ? 'Cat' : 'Dog'}, ${weightKg}kg, ${ageMonths} months (adult)
${portionTxt}

${conditionGuidance}

Choose a creative, varied protein source for today.

STRICTLY FORBIDDEN (toxic — NEVER use under any circumstances):
grapes, raisins, onions, garlic, chives, leeks, chocolate, cocoa, xylitol, macadamia nuts, avocado,
alcohol, caffeine, raw yeast dough, green tomatoes, raw potatoes, fruit seeds/pits
${isCat ? '\nCAT RULES: Obligate carnivore — protein >65% of calories, no grains/rice as main ingredient. Do NOT use spinach (high oxalates → urinary stones). Taurine MUST be present.' : ''}

FAT REQUIREMENT: Total recipe fat must be ≥ ${fatMin}g for this pet (unless pancreatitis dog restriction applies).

MANDATORY:
1. Calcium: ~${g.calciumCarbonate}g calcium carbonate
2. Omega-3: ~${fishOilMl}ml fish oil
${taurineG ? `3. Taurine: ~${taurineG}g taurine supplement\n4. Steps must NOT contain gram/weight numbers\n5. Steps must ONLY reference ingredients included in the ingredient list\n6. For each ingredient provide "dbName" in English snake_case` : `3. Steps must NOT contain gram/weight numbers\n4. Steps must ONLY reference ingredients included in the ingredient list\n5. For each ingredient provide "dbName" in English snake_case`}

Output JSON only (no markdown):
{
  "title": "title in Chinese (Simplified)",
  "ingredients": [{ "name": "ingredient name in Chinese (Simplified)", "dbName": "english_snake_case", "amountG": 50, "category": "protein|organ|veggie|carb|supplement|oil", "emoji": "🍗" }],
  "steps": ["Step 1", "Step 2", "Step 3", "Step 4"],
  "warnings": ["health-specific warnings if any"]
}`
}

// ── AI 调用 ───────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function callAI(prompt) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: MODEL, messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000, temperature: 0.9,
      })
      const content = completion.choices[0]?.message?.content || ''
      const match = content.match(/\{[\s\S]*\}/)
      if (!match) throw new Error(`No JSON in response: ${content.slice(0, 100)}`)
      return JSON.parse(match[0])
    } catch (e) {
      if (attempt >= 2) throw e
      const wait = e?.status === 429 ? 30000 : 5000
      await sleep(wait)
    }
  }
}

// ── 任务定义 ─────────────────────────────────────────────────────────────────
// 6 健康状况 × 2 物种 = 12 组合
const COMBOS = [
  { condition: 'healthy',      species: 'dog', label: '健康 🐕' },
  { condition: 'healthy',      species: 'cat', label: '健康 🐈' },
  { condition: 'kidney',       species: 'dog', label: '肾病 🐕' },
  { condition: 'kidney',       species: 'cat', label: '肾病 🐈' },
  { condition: 'pancreatitis', species: 'dog', label: '胰腺炎 🐕' },
  { condition: 'pancreatitis', species: 'cat', label: '胰腺炎 🐈' },
  { condition: 'diabetes',     species: 'dog', label: '糖尿病 🐕' },
  { condition: 'diabetes',     species: 'cat', label: '糖尿病 🐈' },
  { condition: 'obesity',      species: 'dog', label: '肥胖 🐕' },
  { condition: 'obesity',      species: 'cat', label: '肥胖 🐈' },
  { condition: 'allergy',      species: 'dog', label: '过敏 🐕' },
  { condition: 'allergy',      species: 'cat', label: '过敏 🐈' },
]

// 固定参数（简化：使用代表性中等体重成年宠物）
const PARAMS = { dog: { weightKg: 8, ageMonths: 36 }, cat: { weightKg: 4, ageMonths: 36 } }

// ── 并发池 ────────────────────────────────────────────────────────────────────
async function runPool(taskFns, concurrency) {
  let idx = 0
  const results = []
  async function worker() {
    while (idx < taskFns.length) {
      const i = idx++
      results[i] = await taskFns[i]()
      await sleep(300)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, taskFns.length) }, worker))
  return results
}

// ── 确认 ──────────────────────────────────────────────────────────────────────
async function confirm(q) {
  if (process.argv.includes('--yes')) return 'y'
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(r => rl.question(q, a => { rl.close(); r(a.trim().toLowerCase()) }))
}

// ── 主程序 ────────────────────────────────────────────────────────────────────
async function main() {
  const totalRecipes = COMBOS.length * RECIPES_PER_COMBO

  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║   PawChef 病症食谱 AI 真实生成测试                        ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log(`  组合数: ${COMBOS.length} (6 健康状况 × 2 物种)  |  每组 ${RECIPES_PER_COMBO} 条  |  共 ${totalRecipes} 条`)
  console.log(`  模型: ${MODEL}  (temperature=0.9，与生产 Pro 环境一致)`)
  console.log(`  预估费用: < $1 USD  |  预估时间: ~20 分钟`)
  console.log()
  console.log('  校验标准:')
  console.log('    健康:      定性检查（基础安全，无病症约束）')
  console.log('    肾病犬:    磷 < 1200 mg/1000kcal  [数值]')
  console.log('    肾病猫:    磷 < 1350 mg/1000kcal;  蛋白 ≥ 58 g/1000kcal  [数值]')
  console.log('    胰腺炎犬:  脂肪 < 35 g/1000kcal  [数值]')
  console.log('    胰腺炎猫:  无限制（ACVIM 2021）  [定性]')
  console.log('    糖尿病猫:  碳水 < 30 g/1000kcal;  蛋白 ≥ 100 g/1000kcal  [数值]')
  console.log('    糖尿病犬:  无高升糖食材  [定性]')
  console.log('    肥胖:      无额外食用油  [定性]')
  console.log('    过敏:      无常见过敏源（鸡/牛/乳/麦/蛋/豆）  [定性]')
  console.log()

  const ans = await confirm('  确认开始？(y/n): ')
  if (ans !== 'y' && ans !== 'yes') { console.log('  已取消。'); return }

  // 展开所有任务
  const tasks = []
  for (const combo of COMBOS) {
    for (let i = 0; i < RECIPES_PER_COMBO; i++) {
      tasks.push({ ...combo, recipeIdx: i + 1 })
    }
  }

  // 汇总统计
  const comboStats = {}
  for (const c of COMBOS) {
    comboStats[`${c.condition}-${c.species}`] = { label: c.label, pass: 0, fail: 0, redFlags: 0, total: 0 }
  }

  const t0 = Date.now()
  let done = 0

  const taskFns = tasks.map(task => async () => {
    const { condition, species, recipeIdx } = task
    const { weightKg, ageMonths } = PARAMS[species]
    const key = `${condition}-${species}`
    const prompt = buildConditionPrompt(species, weightKg, ageMonths, condition)

    let result, nutrients, condResult, redFlagHits, err = null

    try {
      result        = await callAI(prompt)
      nutrients     = estimateNutrients(result.ingredients ?? [])
      condResult    = nutrients.ok
        ? validateCondition(nutrients, species, condition)
        : { pass: null, failures: ['营养估算失败'] }
      redFlagHits   = qualityCheck(result.ingredients ?? [], species, condition)
    } catch (e) {
      err = e.message
      result = {}
      nutrients = { ok: false, msg: e.message, unknowns: [] }
      condResult = { pass: null, failures: [] }
      redFlagHits = []
    }

    done++
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0)

    // 判断整体通过
    const hasNumericTarget = Object.keys(CONDITION_STANDARDS[condition][species]).length > 0
    const numericPass  = !hasNumericTarget || condResult.pass === true
    const qualityPass  = redFlagHits.length === 0
    const overallPass  = !err && numericPass && qualityPass

    // 更新统计
    comboStats[key].total++
    if (!err) {
      overallPass ? comboStats[key].pass++ : comboStats[key].fail++
      if (!qualityPass) comboStats[key].redFlags++
    }

    // 控制台输出
    const statusIcon = err ? '💥' : overallPass ? '✅' : '⚠️'
    const numLabel = nutrients.ok
      ? `磷${nutrients.phosphorus}mg 脂${nutrients.fat}g 碳水${nutrients.carbs}g 蛋白${nutrients.protein}g`
      : '—估算失败—'
    console.log(
      `[${String(done).padStart(2)}/${tasks.length}] ${statusIcon} ` +
      `${task.label.padEnd(8)} #${recipeIdx}  ` +
      `${(result.title ?? 'ERROR').slice(0, 24).padEnd(26)}` +
      `  ${numLabel}` +
      (redFlagHits.length ? `  ← 红旗:${redFlagHits.length}` : '') +
      (condResult.failures?.length ? `  ← 失败:${condResult.failures.join('; ')}` : '')
    )
    if (nutrients.unknowns?.length) {
      console.log(`     ↳ 未知食材(用类别平均估算): ${nutrients.unknowns.join(', ')}`)
    }

    return { task, result, nutrients, condResult, redFlagHits, err, overallPass }
  })

  const allResults = await runPool(taskFns, CONCURRENCY)

  // ── 汇总报告 ──────────────────────────────────────────────────────────────
  console.log()
  console.log('═'.repeat(72))
  console.log(' 汇总报告')
  console.log('═'.repeat(72))
  console.log(`  健康状况          通过  失败  红旗  通过率  （N=${RECIPES_PER_COMBO}）`)
  console.log('  ' + '─'.repeat(58))

  let totalPass = 0, totalFail = 0, totalRedFlag = 0

  for (const combo of COMBOS) {
    const key   = `${combo.condition}-${combo.species}`
    const s     = comboStats[key]
    const rate  = s.total ? `${Math.round(s.pass / s.total * 100)}%` : '—'
    const icon  = s.fail === 0 && s.redFlags === 0 ? '✅' : s.pass > 0 ? '⚠️' : '❌'
    console.log(
      `  ${icon} ${s.label.padEnd(12)}  ${String(s.pass).padStart(3)}   ${String(s.fail).padStart(3)}   ` +
      `${String(s.redFlags).padStart(3)}   ${rate.padStart(4)}`
    )
    totalPass    += s.pass
    totalFail    += s.fail
    totalRedFlag += s.redFlags
  }

  console.log('  ' + '─'.repeat(58))
  const totalN = totalPass + totalFail
  console.log(
    `  合计              ${String(totalPass).padStart(3)}   ${String(totalFail).padStart(3)}   ` +
    `${String(totalRedFlag).padStart(3)}   ${totalN ? Math.round(totalPass / totalN * 100) + '%' : '—'}`
  )
  console.log()

  // 失败详情
  const failures = allResults.filter(r => r && !r.overallPass && !r.err)
  if (failures.length > 0) {
    console.log(' 失败详情:')
    for (const r of failures) {
      const { task, result, condResult, redFlagHits } = r
      console.log(`   ${task.label} #${task.recipeIdx}: ${result.title ?? '—'}`)
      for (const f of condResult.failures ?? []) console.log(`     • 数值: ${f}`)
      for (const f of redFlagHits) console.log(`     • ${f}`)
    }
    console.log()
  }

  // 保存 JSONL
  const ts    = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outF  = path.join(ROOT, `condition-test-${ts}.jsonl`)
  const lines = allResults.filter(Boolean).map(r =>
    JSON.stringify({
      condition: r.task.condition, species: r.task.species, recipeIdx: r.task.recipeIdx,
      title: r.result?.title,
      ingredients: r.result?.ingredients,
      nutrients: r.nutrients,
      conditionValidation: r.condResult,
      redFlags: r.redFlagHits,
      pass: r.overallPass,
      error: r.err,
    })
  )
  fs.writeFileSync(outF, lines.join('\n') + '\n')
  console.log(`  📄 详细结果已保存: ${outF}`)
  console.log()
  console.log('  注：营养值为内联简化数据库估算，未知食材用类别平均值代替。')
  console.log('      真实路由会通过 USDA API 查询精确数值并进行 AAFCO 全量校验。')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
