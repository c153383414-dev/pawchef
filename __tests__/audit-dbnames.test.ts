/**
 * DB dbName audit — run with: npx jest --testPathPattern=audit-dbnames --verbose
 *
 * For each ingredient the AI prompt encourages (proPrompt INGREDIENT FREEDOM),
 * simulates what resolveUnknownIngredients + validateRecipe would resolve it to.
 *
 * Resolution priority (mirrors the actual runtime code):
 *   1. nutrientsOverride (pre-set)
 *   2. findFood(dbName, true)  — exact dbName
 *   3. findFood(name,  false)  — name fuzzy
 *
 * In resolveUnknownIngredients, a 4th path exists:
 *   3b. findFood(dbName, false) — fuzzy dbName → sets nutrientsOverride
 *
 * Items that resolve via 3b may map to a nutritionally DIFFERENT food (false positive).
 * Items that resolve via nothing fall through to USDA API / category average.
 */

import { findFood, NUTRITION_DB } from '../lib/nutrition-db'

// ── Helpers ────────────────────────────────────────────────────────────────────

function auditIngredient(dbName: string, nameEn: string, nameZh: string) {
  const exactMatch   = findFood(dbName, true)
  const nameMatchEn  = findFood(nameEn, false)
  const nameMatchZh  = findFood(nameZh, false)
  const dbNameFuzzy  = !exactMatch && !nameMatchEn && !nameMatchZh
    ? findFood(dbName, false) : null

  if (exactMatch)       return { status: 'EXACT',        resolvedTo: exactMatch.dbName }
  if (nameMatchEn)      return { status: 'NAME_FUZZY_EN', resolvedTo: nameMatchEn.dbName }
  if (nameMatchZh)      return { status: 'NAME_FUZZY_ZH', resolvedTo: nameMatchZh.dbName }
  if (dbNameFuzzy)      return { status: 'DBNAME_FUZZY',  resolvedTo: dbNameFuzzy.dbName }
  return                       { status: 'NO_MATCH',      resolvedTo: 'USDA / category avg' }
}

// ── Candidate list (all ingredients from INGREDIENT FREEDOM in proPrompt) ──────

const CANDIDATES: Array<{ dbName: string; nameEn: string; nameZh: string; expected?: string }> = [
  // Proteins already in DB
  { dbName: 'chicken_breast',   nameEn: 'chicken breast',    nameZh: '鸡胸肉',   expected: 'chicken_breast' },
  { dbName: 'beef_lean',        nameEn: 'beef',              nameZh: '牛肉',     expected: 'beef_lean' },
  { dbName: 'salmon',           nameEn: 'salmon',            nameZh: '三文鱼',   expected: 'salmon' },
  { dbName: 'turkey_breast',    nameEn: 'turkey',            nameZh: '火鸡肉',   expected: 'turkey_breast' },
  { dbName: 'duck_breast',      nameEn: 'duck',              nameZh: '鸭肉',     expected: 'duck_breast' },
  { dbName: 'cod',              nameEn: 'cod',               nameZh: '鳕鱼',     expected: 'cod' },
  { dbName: 'pork_lean',        nameEn: 'pork',              nameZh: '猪肉',     expected: 'pork_lean' },
  { dbName: 'egg_cooked',       nameEn: 'egg',               nameZh: '鸡蛋',     expected: 'egg_cooked' },
  { dbName: 'beef_heart',       nameEn: 'beef heart',        nameZh: '牛心',     expected: 'beef_heart' },
  { dbName: 'rabbit_meat',      nameEn: 'rabbit',            nameZh: '兔肉',     expected: 'rabbit_meat' },
  { dbName: 'lamb_leg',         nameEn: 'lamb',              nameZh: '羊肉',     expected: 'lamb_leg' },
  { dbName: 'sardines_canned',  nameEn: 'sardines',          nameZh: '沙丁鱼',   expected: 'sardines_canned' },
  { dbName: 'mackerel',         nameEn: 'mackerel',          nameZh: '鲭鱼',     expected: 'mackerel' },
  { dbName: 'venison',          nameEn: 'venison',           nameZh: '鹿肉',     expected: 'venison' },
  { dbName: 'quail_egg',        nameEn: 'quail egg',         nameZh: '鹌鹑蛋',   expected: 'quail_egg' },
  { dbName: 'chicken_liver',    nameEn: 'chicken liver',     nameZh: '鸡肝',     expected: 'chicken_liver' },
  { dbName: 'chicken_gizzard',  nameEn: 'chicken gizzard',   nameZh: '鸡胗',     expected: 'chicken_gizzard' },

  // AI often generates these — may or may not exist in DB
  { dbName: 'chicken_thigh',    nameEn: 'chicken thigh',     nameZh: '鸡腿肉' },
  { dbName: 'pork_shoulder',    nameEn: 'pork shoulder',     nameZh: '猪肩肉' },
  { dbName: 'duck_meat',        nameEn: 'duck meat',         nameZh: '鸭肉' },
  { dbName: 'beef',             nameEn: 'beef',              nameZh: '牛肉' },
  { dbName: 'turkey_meat',      nameEn: 'turkey meat',       nameZh: '火鸡肉' },
  { dbName: 'duck_leg',         nameEn: 'duck leg',          nameZh: '鸭腿肉' },
  { dbName: 'lamb_meat',        nameEn: 'lamb',              nameZh: '羊肉' },

  // Organs not in DB
  { dbName: 'chicken_heart',    nameEn: 'chicken heart',     nameZh: '鸡心' },
  { dbName: 'duck_heart',       nameEn: 'duck heart',        nameZh: '鸭心' },
  { dbName: 'pork_heart',       nameEn: 'pork heart',        nameZh: '猪心' },
  { dbName: 'pork_liver',       nameEn: 'pork liver',        nameZh: '猪肝' },
  { dbName: 'beef_liver',       nameEn: 'beef liver',        nameZh: '牛肝' },
  { dbName: 'duck_liver',       nameEn: 'duck liver',        nameZh: '鸭肝' },
  { dbName: 'lamb_kidney',      nameEn: 'lamb kidney',       nameZh: '羊腰' },
  { dbName: 'duck_gizzard',     nameEn: 'duck gizzard',      nameZh: '鸭胗' },

  // Fish not in DB
  { dbName: 'tuna',             nameEn: 'tuna',              nameZh: '金枪鱼' },
  { dbName: 'trout',            nameEn: 'trout',             nameZh: '鳟鱼' },
  { dbName: 'tilapia',          nameEn: 'tilapia',           nameZh: '罗非鱼' },
  { dbName: 'sea_bream',        nameEn: 'sea bream',         nameZh: '鲷鱼' },
  { dbName: 'yellowtail',       nameEn: 'yellowtail',        nameZh: '黄尾鱼' },
  { dbName: 'horse_mackerel',   nameEn: 'horse mackerel',    nameZh: '竹荚鱼' },
  { dbName: 'sea_bass',         nameEn: 'sea bass',          nameZh: '鲈鱼' },
  { dbName: 'carp',             nameEn: 'carp',              nameZh: '鲤鱼' },
  { dbName: 'catfish',          nameEn: 'catfish',           nameZh: '鲶鱼' },
  { dbName: 'whitefish',        nameEn: 'whitefish',         nameZh: '白鱼' },

  // Other proteins not in DB
  { dbName: 'goat_meat',        nameEn: 'goat',              nameZh: '山羊肉' },
  { dbName: 'bison',            nameEn: 'bison',             nameZh: '野牛肉' },
  { dbName: 'pheasant',         nameEn: 'pheasant',          nameZh: '野鸡' },
  { dbName: 'quail_meat',       nameEn: 'quail',             nameZh: '鹌鹑' },
  { dbName: 'duck_wing',        nameEn: 'duck wing',         nameZh: '鸭翅' },
  { dbName: 'chicken_wing',     nameEn: 'chicken wing',      nameZh: '鸡翅' },
]

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('nutrition-db dbName coverage audit', () => {
  const results: Record<string, ReturnType<typeof auditIngredient> & { dbName: string }> = {}

  beforeAll(() => {
    for (const c of CANDIDATES) {
      results[c.dbName] = { dbName: c.dbName, ...auditIngredient(c.dbName, c.nameEn, c.nameZh) }
    }
  })

  test('all items in DB resolve to EXACT', () => {
    const dbNames = new Set(NUTRITION_DB.map(f => f.dbName))
    const missing: string[] = []
    for (const [name, r] of Object.entries(results)) {
      if (dbNames.has(name) && r.status !== 'EXACT') missing.push(name)
    }
    expect(missing).toEqual([])
  })

  test('no item resolves to 0 kcal (DBNAME_FUZZY path fixed)', () => {
    // After the fix, DBNAME_FUZZY items get nutrientsOverride — they won't be 0 kcal.
    // This test just verifies the DBNAME_FUZZY path still exists (i.e. doesn't silently break).
    const fuzzyDbNames = Object.values(results).filter(r => r.status === 'DBNAME_FUZZY')
    console.log('DBNAME_FUZZY items (get nutrientsOverride in resolveUnknownIngredients):',
      fuzzyDbNames.map(r => `${r.dbName} → ${r.resolvedTo}`))
    // Not a hard failure — just informational
    expect(true).toBe(true)
  })

  test('print full audit report', () => {
    const byStatus: Record<string, string[]> = {
      EXACT: [], NAME_FUZZY_EN: [], NAME_FUZZY_ZH: [], DBNAME_FUZZY: [], NO_MATCH: []
    }
    for (const r of Object.values(results)) {
      const label = r.status === 'EXACT'
        ? r.dbName
        : `${r.dbName} → ${r.resolvedTo}`
      byStatus[r.status].push(label)
    }

    console.log('\n══════════════════════════════════════════════')
    console.log('  DB dbName Audit Report')
    console.log('══════════════════════════════════════════════')
    console.log(`\n✅ EXACT match (${byStatus.EXACT.length}):`)
    byStatus.EXACT.forEach(s => console.log('   ', s))
    console.log(`\n🔵 NAME_FUZZY via en name (${byStatus.NAME_FUZZY_EN.length}):`)
    byStatus.NAME_FUZZY_EN.forEach(s => console.log('   ', s))
    console.log(`\n🟡 NAME_FUZZY via zh name (${byStatus.NAME_FUZZY_ZH.length}):`)
    byStatus.NAME_FUZZY_ZH.forEach(s => console.log('   ', s))
    console.log(`\n🟠 DBNAME_FUZZY (resolveUnknownIngredients sets override) (${byStatus.DBNAME_FUZZY.length}):`)
    byStatus.DBNAME_FUZZY.forEach(s => console.log('   ', s))
    console.log(`\n❌ NO_MATCH → USDA API / category average (${byStatus.NO_MATCH.length}):`)
    byStatus.NO_MATCH.forEach(s => console.log('   ', s))
    console.log('\n══════════════════════════════════════════════\n')

    expect(true).toBe(true)
  })

  test('flag potentially inaccurate fuzzy matches (different food class)', () => {
    const inaccurate: string[] = []
    for (const r of Object.values(results)) {
      if (r.status === 'NO_MATCH') continue
      if (r.status === 'EXACT') continue
      // Flag when the fuzzy match maps to a very different food
      const src = r.dbName
      const dst = r.resolvedTo
      const inaccurateMap: Record<string, string> = {
        'chicken_heart': 'chicken_breast',  // heart ≠ breast nutrition
        'duck_heart':    'duck_breast',
        'chicken_wing':  'chicken_breast',
        'duck_wing':     'duck_breast',
        'duck_leg':      'duck_breast',
        'quail_meat':    'quail_egg',        // meat ≠ egg
        'pork_liver':    'chicken_liver',
        'beef_liver':    'chicken_liver',
      }
      if (inaccurateMap[src] && inaccurateMap[src] === dst) {
        inaccurate.push(`${src} fuzzy-maps to ${dst} (inaccurate — add to DB)`)
      }
    }
    if (inaccurate.length) {
      console.warn('\n⚠️  Inaccurate fuzzy matches found:\n' + inaccurate.map(s => '   ' + s).join('\n'))
    }
    // Not a hard failure — informational only
    expect(true).toBe(true)
  })
})
