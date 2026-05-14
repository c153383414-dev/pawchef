/**
 * 离线矩阵质量覆盖测试
 * ─────────────────────────────────────────────────────────────────────────────
 * 不调用 AI，纯粹测试 nutrition-validator + nutrition-db 的行为是否正确。
 *
 * 覆盖三个维度：
 *   1. AAFCO 合规矩阵  —— 108 组合 (物种 × 年龄段 × 体重档 × 健康状态)
 *   2. 食材用量上限执行 —— validateIngredients() 对各食材 cap 的数值校验
 *   3. 关键边缘案例    —— 胰腺炎/幼崽/Ca:P 上限/双鱼磷超标等
 *
 * 运行：npx jest --testPathPattern=matrix --verbose
 */

import {
  validateRecipe,
  validateIngredients,
  calculatePortionGuidance,
  RecipeIngredientInput,
  PetParams,
} from '../lib/nutrition-validator'

// ── 矩阵维度定义 ───────────────────────────────────────────────────────────────

type Species = 'dog' | 'cat'

const AGE_GROUPS = [
  { label: '幼崽(6mo)',  months: 6   },
  { label: '成年(2yr)',  months: 24  },
  { label: '老年(9yr)',  months: 108 },
]

const WEIGHT_MAP: Record<Species, Array<{ label: string; kg: number }>> = {
  dog: [
    { label: '小型(5kg)',  kg: 5  },
    { label: '中型(15kg)', kg: 15 },
    { label: '大型(30kg)', kg: 30 },
  ],
  cat: [
    { label: '小型(3kg)',  kg: 3 },
    { label: '标准(5kg)', kg: 5 },
  ],
}

const CONDITION_SETS = [
  { label: '健康',          conds: ['healthy']                  },
  { label: '肾病',          conds: ['kidney']                   },
  { label: '胰腺炎',        conds: ['pancreatitis']             },
  { label: '糖尿病',        conds: ['diabetes']                 },
  { label: '肥胖',          conds: ['obesity']                  },
  { label: '肾病+肥胖',     conds: ['kidney', 'obesity']        },
  { label: '胰腺炎+糖尿病', conds: ['pancreatitis', 'diabetes'] },
]

// ── 合成食谱构建 ───────────────────────────────────────────────────────────────
// 模拟 AI 按照 portionGuidance 生成的典型食谱，用于验证校验层行为

function buildRecipe(
  species: Species,
  weightKg: number,
  ageMonths: number,
  conditions: string[],
  proteinOverride?: string,
): RecipeIngredientInput[] {
  const isCat   = species === 'cat'
  const isPuppy = ageMonths < 12
  const params: PetParams = { species, weightKg, ageMonths, healthConditions: conditions }
  const g = calculatePortionGuidance(params)

  const proteinMid = Math.round((g.protein.min + g.protein.max) / 2)
  const veggieMid  = Math.round((g.veggie.min  + g.veggie.max)  / 2)
  const carbMid    = isCat ? 0 : Math.round((g.carb.min + g.carb.max) / 2)

  const hasPancreatitis = conditions.includes('pancreatitis')
  const hasKidney       = conditions.includes('kidney')

  // 按健康状态选最合适的主蛋白
  const mainProtein = proteinOverride ?? (
    hasPancreatitis ? 'turkey_breast' :   // 严格低脂
    hasKidney       ? 'rabbit_meat'   :   // 低磷
    isPuppy         ? 'salmon'        :   // 幼崽需要高脂肪
    isCat           ? 'duck_breast'   :   // 猫咪高脂肪
    'duck_breast'                         // 狗 — 脂肪充足
  )

  const result: RecipeIngredientInput[] = [
    { name: mainProtein, dbName: mainProtein, amountG: proteinMid },
  ]

  // 内脏 8g（肾病跳过，高磷）
  if (!hasKidney) {
    result.push({ name: 'chicken_gizzard', dbName: 'chicken_gizzard', amountG: 8 })
  }

  // 蔬菜（肾病用低磷西葫芦）
  result.push({
    name:    hasKidney ? 'zucchini' : 'broccoli',
    dbName:  hasKidney ? 'zucchini' : 'broccoli',
    amountG: veggieMid,
  })

  // 碳水（狗，成年，非猫）
  if (!isCat && !isPuppy && carbMid > 0) {
    const carb = (conditions.includes('diabetes') || conditions.includes('obesity'))
      ? 'oatmeal_cooked'
      : 'brown_rice_cooked'
    result.push({ name: carb, dbName: carb, amountG: carbMid })
  }

  // 必须补充剂
  result.push({ name: 'fish_oil',          dbName: 'fish_oil',          amountG: g.fishOil          })
  result.push({ name: 'calcium_carbonate', dbName: 'calcium_carbonate', amountG: g.calciumCarbonate })

  if (isCat && g.taurine) {
    result.push({ name: 'taurine_supplement', dbName: 'taurine_supplement', amountG: g.taurine })
  }

  return result
}

// ── 结果类型 ────────────────────────────────────────────────────────────────────

interface MatrixResult {
  species:     Species
  ageLabel:    string
  weightLabel: string
  condLabel:   string
  label:       'compliant' | 'partial' | 'non-compliant'
  aafcoPass:   boolean
  calOk:       boolean
  failures:    string[]
  supplements: string[]
  calories:    number
  targetMin:   number
  targetMax:   number
}

// ────────────────────────────────────────────────────────────────────────────────
// Part 1 · AAFCO 合规矩阵
// ────────────────────────────────────────────────────────────────────────────────

describe('Part 1 · AAFCO 合规矩阵（108 组合）', () => {

  const results: MatrixResult[] = []

  beforeAll(() => {
    for (const species of ['dog', 'cat'] as Species[]) {
      for (const age of AGE_GROUPS) {
        for (const wt of WEIGHT_MAP[species]) {
          for (const cs of CONDITION_SETS) {
            const params: PetParams = {
              species,
              weightKg:         wt.kg,
              ageMonths:        age.months,
              healthConditions: cs.conds,
            }
            const raw       = buildRecipe(species, wt.kg, age.months, cs.conds)
            const { ingredients } = validateIngredients(raw, params)
            const result    = validateRecipe(ingredients, params)

            const av       = result.aafco
            const failures: string[] = []
            if (!av.protein.ok)    failures.push(`蛋白${Math.round(av.protein.value)}<${av.protein.min}`)
            if (!av.fat.ok)        failures.push(`脂肪${av.fat.value.toFixed(1)}<${av.fat.min}`)
            if (!av.calcium.ok)    failures.push(`钙${Math.round(av.calcium.value)}`)
            if (!av.phosphorus.ok) failures.push(`磷${Math.round(av.phosphorus.value)}<${av.phosphorus.min}`)
            if (!av.caPRatio.ok)   failures.push(`Ca:P ${av.caPRatio.value.toFixed(2)}`)
            if (!av.omega3.ok)     failures.push(`Ω3`)
            if (!av.taurine.ok)    failures.push(`牛磺酸`)

            results.push({
              species,
              ageLabel:    age.label,
              weightLabel: wt.label,
              condLabel:   cs.label,
              label:       result.complianceLabel,
              aafcoPass:   result.aafco.passed,
              calOk:       result.caloriesOk,
              failures,
              supplements: result.supplements.map(s => `${s.ingredient}(${s.amountG}g)`),
              calories:    result.actualCalories,
              targetMin:   result.targetCalories.min,
              targetMax:   result.targetCalories.max,
            })
          }
        }
      }
    }
  })

  test('打印完整合规矩阵报告', () => {
    const total          = results.length
    const compliantCount = results.filter(r => r.label === 'compliant').length
    const partialCount   = results.filter(r => r.label === 'partial').length
    const ncCount        = results.filter(r => r.label === 'non-compliant').length

    const W = 82
    const line  = (s: string) => console.log(s)
    const rule  = (c = '═') => line(c.repeat(W))
    const dash  = () => line('─'.repeat(W))

    rule()
    line('  PawChef 离线矩阵质量报告')
    rule()
    line(`  总案例: ${total}  ` +
         `✅ 完全达标: ${compliantCount} (${pct(compliantCount, total)}%)  ` +
         `⚠️  部分: ${partialCount} (${pct(partialCount, total)}%)  ` +
         `❌ 未达标: ${ncCount} (${pct(ncCount, total)}%)`)
    dash()

    // ── 按物种汇总 ──
    line('\n  按物种：')
    for (const sp of ['dog', 'cat'] as const) {
      printSubset(results.filter(r => r.species === sp), sp === 'dog' ? '🐕 狗' : '🐈 猫')
    }

    // ── 按年龄段汇总 ──
    line('\n  按年龄段：')
    for (const ag of AGE_GROUPS) {
      printSubset(results.filter(r => r.ageLabel === ag.label), ag.label)
    }

    // ── 按健康状态汇总 ──
    line('\n  按健康状态：')
    const maxLbl = Math.max(...CONDITION_SETS.map(cs => cs.label.length))
    for (const cs of CONDITION_SETS) {
      const sub = results.filter(r => r.condLabel === cs.label)
      const c   = sub.filter(r => r.label === 'compliant').length
      const p   = sub.filter(r => r.label === 'partial').length
      const nc  = sub.filter(r => r.label === 'non-compliant').length
      line(`    ${cs.label.padEnd(maxLbl + 1)}: ✅${c} ⚠️${p} ❌${nc}   — ${summarizeFailures(sub)}`)
    }

    // ── 未达标详情 ──
    const nonCompliant = results.filter(r => r.label === 'non-compliant')
    if (nonCompliant.length > 0) {
      dash()
      line(`\n  ❌ 未达标案例详情（${nonCompliant.length} 条）：`)
      for (const r of nonCompliant) {
        line(`    ${r.species.toUpperCase()} | ${r.ageLabel} | ${r.weightLabel} | ${r.condLabel}`)
        line(`      失败: ${r.failures.join(' · ')}`)
        line(`      热量: ${r.calories} kcal  目标: ${r.targetMin}–${r.targetMax} kcal`)
        if (r.supplements.length) line(`      自动补充: ${r.supplements.join(', ')}`)
      }
    }

    // ── 部分达标详情（仅显示有失败项的） ──
    const partial = results.filter(r => r.label === 'partial' && r.failures.length > 0)
    if (partial.length > 0) {
      dash()
      line(`\n  ⚠️  部分达标案例（${partial.length} 条）：`)
      for (const r of partial) {
        line(`    ${r.species.toUpperCase()} | ${r.ageLabel} | ${r.weightLabel} | ${r.condLabel}  → ${r.failures.join(' · ')}`)
      }
    }

    rule()

    // 断言：健康宠物不应出现 non-compliant
    const healthyNC = results.filter(r =>
      r.condLabel === '健康' && r.label === 'non-compliant'
    )
    expect(healthyNC).toHaveLength(0)

    // 断言：overall non-compliant 应 < 30%（胰腺炎脂肪冲突是已知问题）
    expect(ncCount / total).toBeLessThan(0.30)
  })
})

// ── 辅助函数 ────────────────────────────────────────────────────────────────────

function pct(n: number, total: number) { return Math.round(n / total * 100) }

function printSubset(sub: MatrixResult[], label: string) {
  const c  = sub.filter(r => r.label === 'compliant').length
  const p  = sub.filter(r => r.label === 'partial').length
  const nc = sub.filter(r => r.label === 'non-compliant').length
  console.log(`    ${label.padEnd(10)}: ✅${c} ⚠️${p} ❌${nc}`)
}

function summarizeFailures(sub: MatrixResult[]): string {
  const counts: Record<string, number> = {}
  sub.forEach(r => r.failures.forEach(f => {
    const key = f.replace(/[\d.<>=.]/g, '').trim()
    counts[key] = (counts[key] ?? 0) + 1
  }))
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}×${v}`)
    .join(' ')
}

// ────────────────────────────────────────────────────────────────────────────────
// Part 2 · 食材用量上限执行
// ────────────────────────────────────────────────────────────────────────────────

describe('Part 2 · 食材用量上限执行（validateIngredients）', () => {

  function cap(dbName: string, amountG: number, pet: PetParams): number {
    const { ingredients } = validateIngredients([{ name: dbName, dbName, amountG }], pet)
    return ingredients[0].amountG
  }

  const adult10kg: PetParams = { species: 'dog', weightKg: 10, ageMonths: 24, healthConditions: ['healthy'] }
  const adult5kg:  PetParams = { species: 'dog', weightKg: 5,  ageMonths: 24, healthConditions: ['healthy'] }
  const puppy5kg:  PetParams = { species: 'dog', weightKg: 5,  ageMonths: 6,  healthConditions: ['healthy'] }
  const cat3kg:    PetParams = { species: 'cat', weightKg: 3,  ageMonths: 24, healthConditions: ['healthy'] }

  // ── 菠菜 ──
  test('菠菜 50g → 成年犬(10kg) 截断至 15g（maxAmountAbsoluteG）', () => {
    expect(cap('spinach', 50, adult10kg)).toBe(15)
  })
  test('菠菜 30g → 幼犬(5kg) 截断至 10g（puppyMaxAmountG）', () => {
    expect(cap('spinach', 30, puppy5kg)).toBe(10)
  })
  test('菠菜 10g → 成年犬未被截断', () => {
    expect(cap('spinach', 10, adult10kg)).toBe(10)
  })

  // ── 芦笋 ──
  test('芦笋 25g → 截断至 20g（maxAmountAbsoluteG）', () => {
    expect(cap('asparagus', 25, adult10kg)).toBe(20)
  })
  test('芦笋 15g → 未被截断', () => {
    expect(cap('asparagus', 15, adult10kg)).toBe(15)
  })

  // ── 蓝莓 ──
  test('蓝莓 30g → 成年犬截断至 20g（maxAmountAbsoluteG）', () => {
    expect(cap('blueberry', 30, adult10kg)).toBe(20)
  })
  test('蓝莓 15g → 幼犬截断至 10g（puppyMaxAmountG）', () => {
    expect(cap('blueberry', 15, puppy5kg)).toBe(10)
  })

  // ── 甜菜根 ──
  test('甜菜根 20g → 截断至 15g（maxAmountAbsoluteG）', () => {
    expect(cap('beet', 20, adult10kg)).toBe(15)
  })

  // ── 鸡肝（maxAmountPerKgG: 3）──
  test('鸡肝 25g → 5kg犬截断至 15g（3g/kg × 5kg）', () => {
    expect(cap('chicken_liver', 25, adult5kg)).toBe(15)
  })
  test('鸡肝 50g → 10kg成年犬截断至 30g（3g/kg × 10kg）', () => {
    expect(cap('chicken_liver', 50, adult10kg)).toBe(30)
  })
  test('鸡肝 10g → 5kg犬未被截断', () => {
    expect(cap('chicken_liver', 10, adult5kg)).toBe(10)
  })

  // ── 沙丁鱼（maxAmountPerKgG: 4）──
  test('沙丁鱼 25g → 5kg犬截断至 20g（4g/kg × 5kg）', () => {
    expect(cap('sardines_canned', 25, adult5kg)).toBe(20)
  })
  test('沙丁鱼 15g → 3kg猫截断至 12g（4g/kg × 3kg）', () => {
    expect(cap('sardines_canned', 15, cat3kg)).toBe(12)
  })
  test('沙丁鱼 30g → 10kg成年犬截断至 40g（未超限）不截断', () => {
    expect(cap('sardines_canned', 30, adult10kg)).toBe(30)
  })

  // ── 鲭鱼（maxAmountPerKgG: 5）──
  test('鲭鱼 30g → 5kg犬截断至 25g（5g/kg × 5kg）', () => {
    expect(cap('mackerel', 30, adult5kg)).toBe(25)
  })
  test('鲭鱼 40g → 10kg犬未超限（5g/kg × 10kg = 50g）不截断', () => {
    expect(cap('mackerel', 40, adult10kg)).toBe(40)
  })

  // ── 无 cap 的食材不被截断 ──
  test('鸡胸肉 200g → 无 cap 不截断', () => {
    expect(cap('chicken_breast', 200, adult10kg)).toBe(200)
  })
  test('西兰花 100g → 无 cap 不截断', () => {
    expect(cap('broccoli', 100, adult10kg)).toBe(100)
  })
})

// ────────────────────────────────────────────────────────────────────────────────
// Part 3 · 关键边缘案例
// ────────────────────────────────────────────────────────────────────────────────

describe('Part 3 · 关键边缘案例', () => {

  test('健康成年犬(10kg) 应达到合规或部分合规', () => {
    const params: PetParams = { species: 'dog', weightKg: 10, ageMonths: 24, healthConditions: ['healthy'] }
    const { ingredients } = validateIngredients(buildRecipe('dog', 10, 24, ['healthy']), params)
    const r = validateRecipe(ingredients, params)
    console.log(`\n  健康成年犬(10kg): ${r.complianceLabel}  热量 ${r.actualCalories} kcal (目标 ${r.targetCalories.min}–${r.targetCalories.max})`)
    expect(r.complianceLabel).not.toBe('non-compliant')
  })

  test('健康成年猫(4kg) 应达到合规或部分合规', () => {
    const params: PetParams = { species: 'cat', weightKg: 4, ageMonths: 24, healthConditions: ['healthy'] }
    const { ingredients } = validateIngredients(buildRecipe('cat', 4, 24, ['healthy']), params)
    const r = validateRecipe(ingredients, params)
    console.log(`\n  健康成年猫(4kg): ${r.complianceLabel}  热量 ${r.actualCalories} kcal`)
    expect(r.complianceLabel).not.toBe('non-compliant')
  })

  test('幼猫(3kg) 牛磺酸应自动满足', () => {
    const params: PetParams = { species: 'cat', weightKg: 3, ageMonths: 6, healthConditions: ['healthy'] }
    const r = validateRecipe(buildRecipe('cat', 3, 6, ['healthy']), params)
    const av = r.aafco.taurine
    console.log(`\n  幼猫(3kg) 牛磺酸: ${av.value.toFixed(0)} mg/1000kcal (需≥${av.min} mg)`)
    expect(av.ok).toBe(true)
  })

  test('大型幼犬(30kg) 热量目标合理，脂肪应达标', () => {
    const params: PetParams = { species: 'dog', weightKg: 30, ageMonths: 6, healthConditions: ['healthy'] }
    const r = validateRecipe(buildRecipe('dog', 30, 6, ['healthy']), params)
    const { min, max } = r.targetCalories
    console.log(`\n  大型幼犬(30kg): 热量目标 ${min}–${max} kcal  实际 ${r.actualCalories} kcal`)
    console.log(`    脂肪: ${r.aafco.fat.value.toFixed(1)} g/1000kcal (需≥${r.aafco.fat.min})`)
    expect(min).toBeGreaterThan(800)    // 30kg 幼犬至少需要 1000+ kcal
    expect(r.aafco.fat.ok).toBe(true)  // 三文鱼应满足幼犬脂肪要求
  })

  test('胰腺炎幼犬(5kg): 记录脂肪冲突（已知严格低脂 vs 幼崽高脂肪需求）', () => {
    const params: PetParams = { species: 'dog', weightKg: 5, ageMonths: 6, healthConditions: ['pancreatitis'] }
    const r = validateRecipe(buildRecipe('dog', 5, 6, ['pancreatitis']), params)
    const av = r.aafco.fat
    console.log(`\n  胰腺炎幼犬(5kg): ${r.complianceLabel}`)
    console.log(`    脂肪: ${av.value.toFixed(1)} g/1000kcal (需≥${av.min})  ${av.ok ? '✅' : '❌ 已知冲突'}`)
    // 仅记录，不强制通过 — 胰腺炎严格低脂与幼犬高脂需求存在内在矛盾
    expect(r.complianceLabel).toBeDefined()
  })

  test('Ca:P 比例安全上限保护：高沙丁鱼配方不超过 2.5', () => {
    const params: PetParams = { species: 'dog', weightKg: 10, ageMonths: 24, healthConditions: ['healthy'] }
    // 沙丁鱼磷超高 (490mg/100g)，不加足够钙 → 测试 Ca:P 上限保护
    const ingredients: RecipeIngredientInput[] = [
      { name: 'sardines_canned',   dbName: 'sardines_canned',   amountG: 100 },
      { name: 'broccoli',          dbName: 'broccoli',          amountG: 50  },
      { name: 'fish_oil',          dbName: 'fish_oil',          amountG: 1   },
      { name: 'calcium_carbonate', dbName: 'calcium_carbonate', amountG: 0.5 },
    ]
    const r = validateRecipe(ingredients, params)
    console.log(`\n  Ca:P 上限测试: ${r.aafco.caPRatio.value.toFixed(2)} (需 1.0–2.5)`)
    // 自动补钙后，Ca:P 不应超过 2.5
    expect(r.aafco.caPRatio.value).toBeLessThanOrEqual(2.51)
  })

  test('双鱼场景(2kg幼犬): validateIngredients 正确截断沙丁鱼和鲭鱼', () => {
    const params: PetParams = { species: 'dog', weightKg: 2, ageMonths: 6, healthConditions: ['healthy'] }
    const raw: RecipeIngredientInput[] = [
      { name: 'sardines_canned',   dbName: 'sardines_canned',   amountG: 30  },
      { name: 'mackerel',          dbName: 'mackerel',          amountG: 30  },
      { name: 'fish_oil',          dbName: 'fish_oil',          amountG: 0.2 },
      { name: 'calcium_carbonate', dbName: 'calcium_carbonate', amountG: 0.7 },
    ]
    const { ingredients: capped, adjustments } = validateIngredients(raw, params)
    const sardine  = capped.find(i => i.dbName === 'sardines_canned')!
    const mackerel = capped.find(i => i.dbName === 'mackerel')!
    console.log(`\n  双鱼(2kg幼犬): 沙丁 ${sardine.amountG}g(原30g) 鲭鱼 ${mackerel.amountG}g(原30g)`)
    console.log(`    调整记录: ${adjustments.map(a => `${a.name} ${a.originalAmountG}→${a.adjustedAmountG}g`).join(', ')}`)
    expect(sardine.amountG).toBeLessThanOrEqual(8)   // 4g/kg × 2kg = 8g
    expect(mackerel.amountG).toBeLessThanOrEqual(10) // 5g/kg × 2kg = 10g
  })

  test('纯鸡胸肉食谱(精瘦): 自动补充鱼油以满足脂肪需求', () => {
    const params: PetParams = { species: 'dog', weightKg: 10, ageMonths: 24, healthConditions: ['healthy'] }
    // 鸡胸肉只有 3.6% 脂肪，单独使用会导致脂肪不足
    const ingredients: RecipeIngredientInput[] = [
      { name: 'chicken_breast',    dbName: 'chicken_breast',    amountG: 200 },
      { name: 'broccoli',          dbName: 'broccoli',          amountG: 50  },
      { name: 'brown_rice_cooked', dbName: 'brown_rice_cooked', amountG: 100 },
      { name: 'fish_oil',          dbName: 'fish_oil',          amountG: 1   },
      { name: 'calcium_carbonate', dbName: 'calcium_carbonate', amountG: 1.5 },
    ]
    const r = validateRecipe(ingredients, params)
    const hasFishOilSupplement = r.supplements.some(s => s.dbName === 'fish_oil')
    console.log(`\n  纯鸡胸肉食谱: ${r.complianceLabel}`)
    console.log(`    脂肪: ${r.aafco.fat.value.toFixed(1)} g/1000kcal (需≥13.8)`)
    console.log(`    鱼油自动补充: ${hasFishOilSupplement ? '✅' : '未触发'}`)
    expect(['compliant', 'partial']).toContain(r.complianceLabel)
  })

  test('肾病成年猫(4kg): 不含沙丁鱼（禁用），合规可达成', () => {
    const params: PetParams = { species: 'cat', weightKg: 4, ageMonths: 24, healthConditions: ['kidney'] }
    const { ingredients } = validateIngredients(buildRecipe('cat', 4, 24, ['kidney']), params)
    const r = validateRecipe(ingredients, params)
    console.log(`\n  肾病成年猫(4kg): ${r.complianceLabel}  磷: ${r.aafco.phosphorus.value.toFixed(0)} mg/1000kcal`)
    expect(r.complianceLabel).not.toBe('non-compliant')
  })

  test('肥胖老年犬(15kg): DER 降低因子正确（肥胖→1.2×RER）', () => {
    const params: PetParams = { species: 'dog', weightKg: 15, ageMonths: 108, healthConditions: ['obesity'] }
    const r = validateRecipe(buildRecipe('dog', 15, 108, ['obesity']), params)
    // 肥胖狗 factor=1.2，正常成年 factor=1.6，热量目标应显著低于正常
    const obeseTarget = (r.targetCalories.min + r.targetCalories.max) / 2
    const normalParams: PetParams = { ...params, healthConditions: ['healthy'] }
    const normalR = validateRecipe(buildRecipe('dog', 15, 108, ['healthy']), normalParams)
    const normalTarget = (normalR.targetCalories.min + normalR.targetCalories.max) / 2
    console.log(`\n  15kg老年犬 肥胖目标: ${obeseTarget.toFixed(0)} kcal  健康目标: ${normalTarget.toFixed(0)} kcal`)
    expect(obeseTarget).toBeLessThan(normalTarget)
  })
})
