/**
 * PawChef Pro 修复验证测试
 * ─────────────────────────────────────────────────────────────────────────────
 * 验证两处修复的效果：
 *   1. 胰腺炎 + 高脂鱼类（沙丁鱼/鲭鱼）：修复后应不再出现
 *   2. locale-based 蛋白质多样性：zh/en 蛋白质分布应有明显差异
 *
 * 测试规格：
 *   - 单一健康状态（全部6种循环）：猫+狗共 100 条
 *   - 胰腺炎专项（只用 pancreatitis）：猫+狗共 50 条
 *   - 多样性（zh 50 + en 50）：猫+狗共 100 条
 *   合计：250 条  |  ~$2.75 USD  |  ~20 分钟
 *
 * 运行：node scripts/test-pro-verify.mjs
 */

import fs       from 'fs'
import path     from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'
import OpenAI   from 'openai'
import { HttpsProxyAgent } from 'https-proxy-agent'

const __dir = path.dirname(fileURLToPath(import.meta.url))
const ROOT  = path.join(__dir, '..')

// ── 环境配置 ────────────────────────────────────────────────────────────────────
const envRaw = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const getEnv = k => envRaw.match(new RegExp(`^${k}=(.+)`, 'm'))?.[1]?.trim() ?? ''
const OPENROUTER_KEY = getEnv('OPENROUTER_API_KEY')
if (!OPENROUTER_KEY || OPENROUTER_KEY.includes('你的')) {
  console.error('❌  请先配置 OPENROUTER_API_KEY'); process.exit(1)
}

const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:10809')
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey:  OPENROUTER_KEY,
  defaultHeaders: { 'X-Title': 'PawChef-Verify' },
  httpAgent: proxyAgent,
})

const MODEL       = 'anthropic/claude-sonnet-4-5'
const CONCURRENCY = 3
const RETRY_MAX   = 2

// ── 完全复刻 route.ts 的计算函数（与 test-pro-real.mjs 一致）──────────────────
function calculateRER(w) { return Math.round(70 * Math.pow(w, 0.75)) }
function parseAgeMonths(a) {
  if (a === '<1yr') return 6; if (a === '12yr+') return 144; return parseInt(a) * 12
}
function calculateDER(w, ageMonths, species, conditions = []) {
  const rer = calculateRER(w), isCat = species === 'cat'
  let f = ageMonths < 12 ? (isCat ? 2.5 : ageMonths < 4 ? 3.0 : 2.0)
        : conditions.includes('obesity') ? (isCat ? 0.8 : 1.2)
        : (isCat ? 1.2 : 1.6)
  const t = Math.round(rer * f)
  return { min: Math.round(t * 0.9), max: Math.round(t * 1.1) }
}
function calculatePortionGuidance(w, ageMonths, species, conditions = []) {
  const der = calculateDER(w, ageMonths, species, conditions)
  const tc  = (der.min + der.max) / 2
  const isCat = species === 'cat', isPuppy = ageMonths < 12
  const pR = isCat ? (isPuppy ? 0.70 : 0.65) : (isPuppy ? 0.50 : 0.45)
  const vR = isPuppy ? 0.08 : 0.10
  const cR = isCat ? 0 : (isPuppy ? 0.20 : 0.25)
  const pG = tc * pR / 150 * 100, vG = tc * vR / 40 * 100, cG = isCat ? 0 : tc * cR / 120 * 100
  const fo = Math.max(0.5, w * 0.1)
  const ca = Math.min(Math.round(w * (isPuppy ? 0.35 : 0.15) * 10) / 10, isCat ? 3 : isPuppy ? (w < 25 ? 8 : 15) : Infinity)
  const tau = isCat ? Math.max(0.05, Math.round(w * 0.025 * 100) / 100) : null
  const rng = v => ({ min: Math.max(1, Math.round(v * 0.85)), max: Math.round(v * 1.15) })
  const tot = pG + vG + cG
  return { targetCalMin: der.min, targetCalMax: der.max, protein: rng(pG), veggie: rng(vG),
           carb: isCat ? {min:0,max:0} : rng(cG), fishOil: Math.round(fo*10)/10,
           calciumCarbonate: ca, taurine: tau,
           totalWeightMin: Math.round(tot*0.85), totalWeightMax: Math.round(tot*1.15) }
}
function formatPortionText(g, isCat) {
  return `Reference portions to hit calorie target ${g.targetCalMin}–${g.targetCalMax} kcal:
- Main protein (meat/fish): ${g.protein.min}–${g.protein.max}g
- Vegetables: ${g.veggie.min}–${g.veggie.max}g
${isCat ? '- Carbs/grains: NOT recommended for cats (obligate carnivores)' : `- Carbs (rice/oatmeal): ${g.carb.min}–${g.carb.max}g`}
- Fish oil: ${g.fishOil}ml (fixed)
- Calcium carbonate: ${g.calciumCarbonate}g (fixed)
${g.taurine != null ? `- Taurine supplement: ${g.taurine}g (fixed, cats cannot synthesize taurine)` : ''}
- Total food weight (excluding supplements): ${g.totalWeightMin}–${g.totalWeightMax}g
These are reference ranges. Adjust slightly to stay within calorie target.`
}

// ── 健康状态注释（含胰腺炎修复）────────────────────────────────────────────────
const HEALTH_NOTES = {
  kidney:       '- Kidney disease: avoid high-phosphorus foods (spinach, legumes, excess organ meat, high-phosphorus fish). Fat must still reach ≥14g/1000kcal — use fish oil or fatty fish.',
  // ↓ 修复：明确列出沙丁鱼、鲭鱼、鲱鱼
  pancreatitis: '- Pancreatitis: STRICTLY LOW FAT — avoid salmon, sardines, mackerel, herring, duck, pork, egg yolk, any fatty fish or meat. Fish oil max 0.1g/kg. Use only lean proteins: chicken breast, turkey breast, venison, rabbit, cod.',
  diabetes:     '- Diabetes: low glycemic — avoid white rice, sweet potato excess, sugary foods.',
  obesity:      '- Obesity: low calorie — significantly reduce carbohydrates and oils.',
  allergy:      '- Food allergy: avoid all known allergens. Use novel protein sources when uncertain.',
}
function buildHealthNote(conditions) {
  const safe = conditions.filter(c => c !== 'healthy')
  return safe.length === 0
    ? 'No restrictions — healthy pet, all safe ingredients allowed.'
    : `Health condition restrictions:\n${safe.map(c => HEALTH_NOTES[c]||'').filter(Boolean).join('\n')}`
}

// ── locale-based 蛋白质建议（修复后）────────────────────────────────────────────
function proteinSuggestions(locale) {
  if (locale === 'zh')
    return 'duck, pork shoulder, chicken thigh, salmon, mackerel, sardines, quail egg, lamb, tuna, trout'
  if (locale === 'ja' || locale === 'ko')
    return 'salmon, mackerel, tuna, duck, chicken thigh, pork, egg, sardines, lamb, trout'
  // en/es/fr 西方市场
  return 'turkey, lamb, salmon, duck, mackerel, sardines, chicken thigh, pork shoulder, egg, rabbit'
}

// ── 构建 Pro Prompt（与修复后的 route.ts 完全一致）────────────────────────────
function buildProPrompt(species, weight, ageMonths, conditions, locale = 'zh') {
  const isCat   = species === 'cat', isPuppy = ageMonths < 12
  const g       = calculatePortionGuidance(weight, ageMonths, species, conditions)
  const portTxt = formatPortionText(g, isCat)
  const hlthTxt = buildHealthNote(conditions)
  const fatMin  = Math.round((g.targetCalMin + g.targetCalMax) / 2 * (isPuppy ? 21 : 14) / 1000 / 9 * 10) / 10
  const langMap = { zh:'Chinese (Simplified)', en:'English', ja:'Japanese', ko:'Korean', es:'Spanish', fr:'French' }
  const lang    = langMap[locale] || 'Chinese (Simplified)'

  return `You are an expert pet nutritionist creating a personalized home-cooked meal recipe.
Respond in ${lang}.

Pet: ${isCat ? 'Cat' : 'Dog'}, ${weight}kg, ${ageMonths} months ${isPuppy ? `(${isCat ? 'KITTEN' : 'PUPPY'})` : '(adult)'}
${portTxt}
${hlthTxt}

Choose a creative, varied protein source for today.

INGREDIENT FREEDOM — Be creative. You may use ANY safe, nutritious pet food ingredients. Consider:
- Proteins: ${proteinSuggestions(locale)}
- Vegetables: zucchini, asparagus, blueberries, butternut squash, celery, green beans, beet
- Vary ingredients every time — do not repeat the same combination.

CARB RULE (CRITICAL): Total carbs from ALL sources combined < 20% of recipe calories.
Fruits (blueberry, cranberry) and starchy veg (sweet potato, pumpkin, carrot) count toward carb limit.

STRICTLY FORBIDDEN (toxic — NEVER use):
grapes, raisins, onions, garlic, chives, leeks, chocolate, cocoa, xylitol, macadamia nuts, avocado,
alcohol, caffeine, raw yeast dough, green tomatoes, raw potatoes, fruit seeds/pits
${isCat ? '\nCAT RULES: Obligate carnivore — protein >65% of calories. Do NOT use spinach. Taurine MUST be present.' : ''}
${!isCat && ageMonths >= 96 ? '\nSENIOR DOG (>8 years): Avoid spinach.' : ''}
${isPuppy && !isCat ? '\nPUPPY FAT REQUIREMENT: ≥21g fat per 1000kcal. Use salmon, duck, or egg.' : ''}
FAT REQUIREMENT: Total recipe fat ≥ ${fatMin}g for this pet.

MANDATORY:
1. Calcium: ~${g.calciumCarbonate}g calcium carbonate
2. Omega-3: ~${g.fishOil}ml fish oil
${isCat ? `3. Taurine: ~${g.taurine}g taurine supplement\n4. Steps: no gram numbers, only listed ingredients\n5. dbName: English snake_case` : `3. Steps: no gram numbers, only listed ingredients\n4. dbName: English snake_case`}

Output JSON only (no markdown):
{
  "title": "title in ${lang}",
  "ingredients": [{"name":"中文名","dbName":"snake_case","amountG":50,"category":"protein|organ|veggie|carb|supplement|oil","emoji":"🍗"}],
  "steps": ["Step 1","Step 2","Step 3","Step 4"],
  "warnings": ["health warnings if any"]
}`
}

// ── AI 调用 ─────────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function callAI(prompt) {
  let delay = 5000
  for (let i = 0; i <= RETRY_MAX; i++) {
    try {
      const c = await openai.chat.completions.create({
        model: MODEL, messages: [{ role:'user', content: prompt }],
        max_tokens: 2000, temperature: 0.9,
      })
      const txt   = c.choices[0]?.message?.content || ''
      const match = txt.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON in response')
      return JSON.parse(match[0])
    } catch (e) {
      if (i >= RETRY_MAX) throw e
      await sleep(delay); delay = Math.min(delay * 2, 30000)
    }
  }
}

// ── 随机参数 ─────────────────────────────────────────────────────────────────────
const AGE_OPTIONS = ['<1yr','1yr','2yr','3yr','4yr','5yr','6yr','7yr','8yr','9yr','10yr','11yr','12yr','12yr+']
const rnd  = arr => arr[Math.floor(Math.random() * arr.length)]
const rndF = (min, max, d=1) => parseFloat((Math.random()*(max-min)+min).toFixed(d))
function randomParams(species) {
  return { weight: rndF(1, species==='cat'?15:100, 1), age: rnd(AGE_OPTIONS) }
}

// ── 高脂鱼类检测（胰腺炎验证核心）──────────────────────────────────────────────
const FATTY_FISH = ['salmon','三文鱼','sardine','沙丁鱼','mackerel','鲭鱼','herring','鲱鱼','tuna in oil']
function detectFattyFish(ingredients = []) {
  return ingredients.filter(i => {
    const n = `${i.name||''} ${i.dbName||''}`.toLowerCase()
    return FATTY_FISH.some(f => n.includes(f.toLowerCase()))
  }).map(i => i.name)
}

// ── 所有健康状态定义 ─────────────────────────────────────────────────────────────
const SINGLE_SETS = [
  ['healthy'],['kidney'],['pancreatitis'],['diabetes'],['obesity'],['allergy']
]

// ── 构建三类任务 ─────────────────────────────────────────────────────────────────
function buildTasks() {
  const tasks = []

  // ① 单一健康状态 100 条：猫+狗各 50，6 种条件循环
  for (const species of ['dog','cat']) {
    for (let i = 0; i < 50; i++) {
      tasks.push({ group:'single', species, conditions: SINGLE_SETS[i % 6], locale:'zh' })
    }
  }

  // ② 胰腺炎专项 50 条：猫+狗各 25，只用 pancreatitis
  for (const species of ['dog','cat']) {
    for (let i = 0; i < 25; i++) {
      tasks.push({ group:'pancreatitis', species, conditions:['pancreatitis'], locale:'zh' })
    }
  }

  // ③ 多样性验证 100 条：50 zh + 50 en，猫狗各半，随机单一条件
  for (let i = 0; i < 50; i++) {
    const species = i % 2 === 0 ? 'dog' : 'cat'
    const cond    = SINGLE_SETS[i % 6]
    tasks.push({ group:'diversity-zh', species, conditions: cond, locale:'zh' })
  }
  for (let i = 0; i < 50; i++) {
    const species = i % 2 === 0 ? 'dog' : 'cat'
    const cond    = SINGLE_SETS[i % 6]
    tasks.push({ group:'diversity-en', species, conditions: cond, locale:'en' })
  }

  // 打乱顺序
  for (let i = tasks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tasks[i], tasks[j]] = [tasks[j], tasks[i]]
  }
  return tasks
}

// ── 并发执行 ─────────────────────────────────────────────────────────────────────
async function runPool(taskDefs, concurrency, onResult) {
  let idx = 0
  async function worker() {
    while (idx < taskDefs.length) {
      const i = idx++
      onResult(i, await taskDefs[i]())
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, taskDefs.length) }, worker))
}

// ── 用户确认 ─────────────────────────────────────────────────────────────────────
async function confirm(q) {
  if (process.argv.includes('--yes')) return 'y'
  const rl = readline.createInterface({ input:process.stdin, output:process.stdout })
  return new Promise(r => rl.question(q, a => { rl.close(); r(a.trim().toLowerCase()) }))
}

// ── 主程序 ────────────────────────────────────────────────────────────────────────
async function main() {
  const tasks = buildTasks()
  const total = tasks.length

  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║   PawChef Pro 修复验证测试  (Claude Sonnet 4.5)           ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log()
  console.log(`  总条数: ${total} 条`)
  console.log(`    ├ 单一健康状态（6种循环）: 100 条`)
  console.log(`    ├ 胰腺炎专项验证:          50 条`)
  console.log(`    └ locale 多样性（zh/en）: 100 条`)
  console.log(`  预估费用: ~$${(total * 0.011).toFixed(2)} USD`)
  console.log(`  预估时间: ~${Math.ceil(total / CONCURRENCY * 7 / 60)} 分钟`)
  console.log()

  const ans = await confirm('  确认开始？(y/n): ')
  if (ans !== 'y' && ans !== 'yes') { console.log('已取消。'); return }

  const ts      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outTxt  = path.join(ROOT, `verify-${ts}.txt`)
  const outJsonl = path.join(ROOT, `verify-${ts}.jsonl`)
  const txtWS   = fs.createWriteStream(outTxt)
  const jsonlWS = fs.createWriteStream(outJsonl)
  txtWS.write(`PawChef Pro 修复验证报告\n生成时间: ${new Date().toLocaleString()}\n总计: ${total} 条\n`)

  // 按组分别统计
  const stats = {
    single:       { done:0, err:0, proteins:{} },
    pancreatitis: { done:0, err:0, fattyFishHits:0, fattyFishList:[] },
    'diversity-zh': { done:0, err:0, proteins:{} },
    'diversity-en': { done:0, err:0, proteins:{} },
  }

  const t0 = Date.now()
  let done = 0
  const allResults     = new Array(total).fill(null)
  const allJsonlLines  = new Array(total).fill(null)

  await runPool(
    tasks.map((def, idx) => async () => {
      const { group, species, conditions, locale } = def
      const { weight, age } = randomParams(species)
      const ageMonths       = parseAgeMonths(age)
      const num             = idx + 1
      let result, errMsg = null

      try {
        result = await callAI(buildProPrompt(species, weight, ageMonths, conditions, locale))
      } catch(e) {
        errMsg = e.message; result = {}
      }

      const st = stats[group]
      done++; st.done++
      if (errMsg) { st.err++; }

      // 提取主蛋白（第一个 protein 类食材）
      const mainProtein = (result.ingredients || []).find(i => i.category === 'protein')
      const proteinName = mainProtein?.name || mainProtein?.dbName || '?'

      // 蛋白质频率统计
      if (!errMsg && st.proteins) {
        st.proteins[proteinName] = (st.proteins[proteinName] || 0) + 1
      }

      // 胰腺炎专项：检测高脂鱼类
      let fattyHit = []
      if (group === 'pancreatitis' && !errMsg) {
        fattyHit = detectFattyFish(result.ingredients || [])
        if (fattyHit.length > 0) {
          st.fattyFishHits++
          st.fattyFishList.push(`#${num} ${species} ${weight}kg [${conditions.join('+')}] → ${fattyHit.join(', ')}`)
        }
      }

      const elapsed = ((Date.now()-t0)/1000).toFixed(0)
      const mark = errMsg ? '💥ERR' : (fattyHit.length > 0 ? `⚠️高脂鱼: ${fattyHit.join(',')}` : '')
      console.log(
        `[${String(done).padStart(3)}/${total}] ${species==='cat'?'🐈':'🐕'} ` +
        `${String(weight).padEnd(5)}kg ${age.padEnd(5)} [${group.padEnd(14)}] [${locale}] ` +
        `→ ${(result.title||errMsg||'?').slice(0,25).padEnd(27)} ${mark}  (${elapsed}s)`
      )

      // 写入文本
      const line = errMsg
        ? `\n#${num} ERROR ${group} ${species} ${conditions.join('+')} ${locale}: ${errMsg}`
        : `\n#${num} [${group}] [${locale}] ${species} ${weight}kg ${age} [${conditions.join('+')}]\n  标题: ${result.title}\n  蛋白: ${proteinName}  |  食材: ${(result.ingredients||[]).map(i=>i.name).join(', ')}\n  警告: ${(result.warnings||[]).join('; ')||'（无）'}${fattyHit.length>0?`\n  ⚠️ 高脂鱼类: ${fattyHit.join(', ')}`:''}${(result.warnings||[]).length>0?'\n  AI警告: '+(result.warnings||[]).join('; '):''}`
      allResults[idx] = line

      // 写入 JSONL（每行一个完整 JSON 对象）
      allJsonlLines[idx] = JSON.stringify({
        num, group, locale, species, weightKg: weight, age,
        conditions, error: errMsg || null,
        title:       result.title       || null,
        ingredients: result.ingredients || [],
        steps:       result.steps       || [],
        warnings:    result.warnings    || [],
        fattyFishDetected: fattyHit,
        mainProtein: proteinName,
      })
    }),
    CONCURRENCY,
    () => {}
  )

  // 写入文件
  for (const r of allResults)     if (r) txtWS.write(r + '\n')
  for (const j of allJsonlLines)  if (j) jsonlWS.write(j + '\n')

  // ── 汇总报告 ──────────────────────────────────────────────────────────────────
  const sep = '═'.repeat(65)

  // 1. 胰腺炎修复验证
  const pa = stats['pancreatitis']
  const paTotal = pa.done - pa.err
  console.log(`\n${sep}`)
  console.log(' 【验证1】胰腺炎 + 高脂鱼类修复')
  console.log(sep)
  console.log(`  有效样本: ${paTotal} 条 / 失败: ${pa.err} 条`)
  console.log(`  出现高脂鱼类: ${pa.fattyFishHits} 条 (${(pa.fattyFishHits/paTotal*100).toFixed(1)}%)`)
  console.log(pa.fattyFishHits === 0
    ? '  ✅ 完全通过 — 胰腺炎食谱中未出现沙丁鱼/鲭鱼/三文鱼'
    : `  ❌ 仍有问题 — 出现了高脂鱼类：`)
  pa.fattyFishList.forEach(l => console.log(`    ${l}`))

  // 2. 多样性对比（zh vs en）
  const zh = stats['diversity-zh'], en = stats['diversity-en']
  const top = (proteins, n=5) =>
    Object.entries(proteins).sort((a,b)=>b[1]-a[1]).slice(0,n)
      .map(([name,cnt]) => `${name}×${cnt}`).join('  ')

  console.log(`\n${sep}`)
  console.log(' 【验证2】locale 蛋白质多样性对比')
  console.log(sep)
  console.log(`  zh locale (${zh.done-zh.err}条有效) 前5蛋白: ${top(zh.proteins)}`)
  console.log(`  en locale (${en.done-en.err}条有效) 前5蛋白: ${top(en.proteins)}`)
  const zhVenison = zh.proteins['venison'] || zh.proteins['鹿肉'] || 0
  const enVenison = en.proteins['venison'] || en.proteins['鹿肉'] || 0
  const zhTotal   = zh.done - zh.err, enTotal = en.done - en.err
  console.log(`  zh 鹿肉占比: ${(zhVenison/zhTotal*100).toFixed(1)}%  (修复前: 85.5%)`)
  console.log(`  en 鹿肉占比: ${(enVenison/enTotal*100).toFixed(1)}%`)
  console.log(zhVenison/zhTotal < 0.2
    ? '  ✅ 多样性修复通过 — zh 鹿肉占比显著下降'
    : '  ⚠️  zh 鹿肉仍偏高，建议进一步调整 Prompt')

  // 3. 单一状态总览
  const si = stats['single']
  console.log(`\n${sep}`)
  console.log(' 【验证3】单一健康状态整体蛋白质分布')
  console.log(sep)
  console.log(`  有效样本: ${si.done-si.err} 条`)
  console.log(`  蛋白质分布 (前8): ${top(si.proteins, 8)}`)

  // 写摘要到文件
  txtWS.write(`\n${sep}\n汇总摘要\n${sep}\n`)
  txtWS.write(`胰腺炎+高脂鱼: ${pa.fattyFishHits}/${paTotal} (${(pa.fattyFishHits/paTotal*100).toFixed(1)}%)\n`)
  txtWS.write(`zh鹿肉占比: ${(zhVenison/zhTotal*100).toFixed(1)}% (修复前85.5%)\n`)
  txtWS.write(`en鹿肉占比: ${(enVenison/enTotal*100).toFixed(1)}%\n`)
  txtWS.write(`zh蛋白Top5: ${top(zh.proteins)}\nen蛋白Top5: ${top(en.proteins)}\n`)

  await Promise.all([
    new Promise(r => txtWS.end(r)),
    new Promise(r => jsonlWS.end(r)),
  ])
  console.log(`\n  📄 报告 (txt):  ${outTxt}`)
  console.log(`  📦 数据 (jsonl): ${outJsonl}`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
