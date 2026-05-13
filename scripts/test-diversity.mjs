/**
 * 多样性模拟测试
 * 模拟 Pro 用户连续生成食谱，验证蛋白质/蔬菜/碳水/内脏的多样性
 * 运行: node scripts/test-diversity.mjs
 */

// ── 食材池（与代码中的实际候选一致）──────────────────────────────────────────
const DOG_PROTEINS = [
  'chicken breast','beef','salmon','turkey','duck','pork','egg',
  'rabbit','lamb','sardines','mackerel','beef heart','venison',
  'trout','tuna','chicken thigh','pork shoulder'
]
const CAT_PROTEINS = [
  'chicken breast','beef','salmon','turkey','duck',
  'rabbit','lamb','sardines','mackerel','quail egg','trout','tuna'
]
const VEGGIES = [
  'carrot','broccoli','pumpkin','sweet_potato','spinach','green_peas',
  'zucchini','asparagus','blueberry','celery','green_beans','kale','cucumber'
]
const DOG_CARBS  = ['brown_rice','white_rice','oatmeal','quinoa','barley','millet','sweet_potato']
const ORGANS     = ['chicken_liver','chicken_gizzard','pork_liver','beef_liver']

// ── 复现代码中的 pickRecent 逻辑 ──────────────────────────────────────────────
function pickRecent(history, category, n) {
  return [...new Set(
    history
      .flatMap(r => r.ingredients)
      .filter(i => i.category === category)
      .map(i => i.name)
      .filter(Boolean)
  )].slice(0, n)
}

// ── 模拟 Claude 遵循 "avoid recent" 约束后的选择 ────────────────────────────────
function claudePick(pool, recentlyUsed) {
  const available = pool.filter(p =>
    !recentlyUsed.some(r =>
      r.toLowerCase().includes(p.toLowerCase()) ||
      p.toLowerCase().includes(r.toLowerCase())
    )
  )
  const pickFrom = available.length > 0 ? available : pool  // 兜底：全部可选
  return pickFrom[Math.floor(Math.random() * pickFrom.length)]
}

// ── 模拟一次食谱生成 ──────────────────────────────────────────────────────────
function generateRecipe(last5, isCat) {
  const proteinPool  = isCat ? CAT_PROTEINS : DOG_PROTEINS

  const recentProteins = pickRecent(last5, 'protein', 4)
  const recentVeggies  = pickRecent(last5, 'veggie',  5)
  const recentCarbs    = pickRecent(last5, 'carb',    2)
  const recentOrgans   = pickRecent(last5, 'organ',   2)

  const protein = claudePick(proteinPool, recentProteins)
  const veggie1 = claudePick(VEGGIES, recentVeggies)
  const veggie2 = claudePick(VEGGIES.filter(v => v !== veggie1), [...recentVeggies, veggie1])
  const carb    = isCat ? null : claudePick(DOG_CARBS, recentCarbs)
  // 内脏 50% 概率出现
  const organ   = Math.random() > 0.5 ? claudePick(ORGANS, recentOrgans) : null

  return {
    ingredients: [
      { name: protein, category: 'protein' },
      { name: veggie1, category: 'veggie'  },
      { name: veggie2, category: 'veggie'  },
      ...(carb  ? [{ name: carb,  category: 'carb'  }] : []),
      ...(organ ? [{ name: organ, category: 'organ' }] : []),
    ]
  }
}

// ── 统计 + 输出 ───────────────────────────────────────────────────────────────
function freq(arr) {
  const m = {}
  arr.forEach(v => { m[v] = (m[v] || 0) + 1 })
  return Object.entries(m).sort((a, b) => b[1] - a[1])
}

function bar(count, total, width = 20) {
  const filled = Math.round(count / total * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function runSimulation(n, isCat, label) {
  const history = []

  for (let i = 0; i < n; i++) {
    const recipe = generateRecipe(history.slice(-5), isCat)
    history.push(recipe)
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(` ${label}  (${n} 次生成)`)
  console.log('═'.repeat(60))

  // 蛋白质
  const proteins = history.map(r => r.ingredients.find(i => i.category === 'protein')?.name).filter(Boolean)
  const pFreq    = freq(proteins)
  console.log(`\n【蛋白质】 共 ${pFreq.length} 种不同选择`)
  pFreq.forEach(([name, cnt]) =>
    console.log(`  ${name.padEnd(18)} ${bar(cnt, n)} ${cnt}次 (${(cnt/n*100).toFixed(0)}%)`)
  )

  // 蔬菜
  const veggies = history.flatMap(r => r.ingredients.filter(i => i.category === 'veggie').map(i => i.name))
  const vFreq   = freq(veggies)
  console.log(`\n【蔬菜】 共 ${vFreq.length} 种不同选择`)
  vFreq.forEach(([name, cnt]) =>
    console.log(`  ${name.padEnd(18)} ${bar(cnt, veggies.length)} ${cnt}次`)
  )

  if (!isCat) {
    const carbs  = history.map(r => r.ingredients.find(i => i.category === 'carb')?.name).filter(Boolean)
    const cFreq  = freq(carbs)
    console.log(`\n【碳水】 共 ${cFreq.length} 种不同选择`)
    cFreq.forEach(([name, cnt]) =>
      console.log(`  ${name.padEnd(18)} ${bar(cnt, carbs.length)} ${cnt}次`)
    )
  }

  const organs = history.map(r => r.ingredients.find(i => i.category === 'organ')?.name).filter(Boolean)
  const oFreq  = freq(organs)
  console.log(`\n【内脏】 共 ${oFreq.length} 种不同选择 (${organs.length}次含内脏)`)
  oFreq.forEach(([name, cnt]) =>
    console.log(`  ${name.padEnd(18)} ${bar(cnt, organs.length)} ${cnt}次`)
  )

  // 前20次明细
  console.log('\n【前20次食谱明细】')
  history.slice(0, 20).forEach((r, i) => {
    const p = r.ingredients.find(i => i.category === 'protein')?.name ?? '?'
    const v = r.ingredients.filter(i => i.category === 'veggie').map(i => i.name).join('+')
    const c = r.ingredients.find(i => i.category === 'carb')?.name ?? '—'
    const o = r.ingredients.find(i => i.category === 'organ')?.name ?? '—'
    console.log(`  ${String(i+1).padStart(2)}. ${p.padEnd(16)} | ${v.padEnd(28)} | ${c.padEnd(12)} | ${o}`)
  })

  // 连续重复检测
  let consecutive = 0
  for (let i = 1; i < proteins.length; i++) {
    if (proteins[i] === proteins[i-1]) consecutive++
  }
  console.log(`\n  ⚠ 连续相同蛋白质次数: ${consecutive}/${n-1}`)
  console.log(`  ✓ 蛋白质种类覆盖率:   ${pFreq.length}/${isCat ? CAT_PROTEINS.length : DOG_PROTEINS.length} 种`)
}

// ── 执行 ──────────────────────────────────────────────────────────────────────
console.log('PawChef Pro 食谱多样性模拟测试')
console.log('说明：模拟 Claude 遵循 "避开近期食材" 约束后的选择')
console.log('（实际 Claude 可能有 10-20% 的概率忽略约束，结果仅供参考）')

runSimulation(100, false, '🐕 狗狗 Pro 食谱')
runSimulation(100, true,  '🐈 猫咪 Pro 食谱')
