export interface NutrientPer100g {
  calories:   number   // kcal
  protein:    number   // g
  fat:        number   // g
  carbs:      number   // g
  calcium:    number   // mg
  phosphorus: number   // mg
  omega3:     number   // mg (鱼类为 EPA+DHA，植物为 ALA)
  taurine:    number   // mg (猫必需氨基酸；狗可自行合成，填0即可)
  vitaminA:   number   // IU
  vitaminD:   number   // IU
  zinc:       number   // mg
  iodine:     number   // mcg
}

export interface FoodItem {
  id:           string
  dbName:       string    // 固定英文 snake_case，AI 输出 JSON 中的查表 key
  names:        string[]  // 多语言别名（中英文为主），仅作模糊匹配兜底
  category:     'protein' | 'organ' | 'veggie' | 'carb' | 'supplement' | 'oil'
  nutrients:    NutrientPer100g
  dogSafe:      boolean
  catSafe:      boolean
  forbiddenFor: Array<'kidney' | 'pancreatitis' | 'diabetes' | 'obesity' | 'allergy'>
  cautionFor:   Array<'kidney' | 'pancreatitis' | 'diabetes' | 'obesity'>
  notes?:       string
}

export const NUTRITION_DB: FoodItem[] = [
  // ── 蛋白质类 ──
  {
    id: 'chicken_breast', dbName: 'chicken_breast',
    names: ['鸡胸肉', '去皮鸡胸肉', '鸡肉', '鸡', 'chicken breast', 'chicken', 'chicken meat', 'chicken_meat'],
    category: 'protein',
    nutrients: { calories: 165, protein: 31, fat: 3.6, carbs: 0, calcium: 15, phosphorus: 220, omega3: 60, taurine: 180, vitaminA: 21, vitaminD: 4, zinc: 1.0, iodine: 7 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: []
  },
  {
    id: 'beef_lean', dbName: 'beef_lean',
    names: ['瘦牛肉', '牛肉', '牛', 'lean beef', 'beef', 'beef meat', 'ground beef', 'minced beef'],
    category: 'protein',
    nutrients: { calories: 158, protein: 26, fat: 5.5, carbs: 0, calcium: 18, phosphorus: 198, omega3: 40, taurine: 360, vitaminA: 0, vitaminD: 0, zinc: 5.8, iodine: 8 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: ['pancreatitis']
  },
  {
    id: 'salmon', dbName: 'salmon',
    names: ['三文鱼', '鲑鱼', 'salmon'],
    category: 'protein',
    nutrients: { calories: 208, protein: 20, fat: 13, carbs: 0, calcium: 12, phosphorus: 260, omega3: 2260, taurine: 94, vitaminA: 50, vitaminD: 526, zinc: 0.8, iodine: 35 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: ['pancreatitis'],
    notes: '必须彻底煮熟，生三文鱼含寄生虫风险'
  },
  {
    id: 'turkey_breast', dbName: 'turkey_breast',
    names: ['火鸡胸肉', '火鸡肉', '火鸡', 'turkey breast', 'turkey', 'turkey meat', 'turkey_meat'],
    category: 'protein',
    nutrients: { calories: 135, protein: 30, fat: 1.5, carbs: 0, calcium: 14, phosphorus: 215, omega3: 30, taurine: 306, vitaminA: 0, vitaminD: 0, zinc: 1.5, iodine: 7 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: []
  },
  {
    id: 'duck_breast', dbName: 'duck_breast',
    names: ['鸭胸肉', '鸭肉', 'duck breast', 'duck'],
    category: 'protein',
    nutrients: { calories: 201, protein: 19, fat: 13, carbs: 0, calcium: 11, phosphorus: 203, omega3: 100, taurine: 150, vitaminA: 0, vitaminD: 0, zinc: 1.9, iodine: 6 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: ['pancreatitis']
  },
  {
    id: 'cod', dbName: 'cod',
    names: ['鳕鱼', 'cod', 'codfish'],
    category: 'protein',
    nutrients: { calories: 82, protein: 18, fat: 0.7, carbs: 0, calcium: 16, phosphorus: 203, omega3: 200, taurine: 150, vitaminA: 12, vitaminD: 44, zinc: 0.5, iodine: 170 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: []
  },
  {
    id: 'pork_lean', dbName: 'pork_lean',
    names: ['瘦猪肉', '猪肉', 'lean pork', 'pork'],
    category: 'protein',
    nutrients: { calories: 143, protein: 26, fat: 3.5, carbs: 0, calcium: 19, phosphorus: 246, omega3: 30, taurine: 50, vitaminA: 0, vitaminD: 0, zinc: 2.4, iodine: 7 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: ['pancreatitis']
  },
  {
    id: 'egg_cooked', dbName: 'egg_cooked',
    names: ['鸡蛋', '煮熟鸡蛋', 'egg', 'cooked egg', 'boiled egg'],
    category: 'protein',
    nutrients: { calories: 155, protein: 13, fat: 11, carbs: 1.1, calcium: 50, phosphorus: 172, omega3: 80, taurine: 0, vitaminA: 160, vitaminD: 87, zinc: 1.3, iodine: 25 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: ['pancreatitis'],
    notes: '必须全熟，生蛋白含抗生物素蛋白'
  },
  // ── Pro 扩展蛋白质类（防止 USDA API 返回错误值）──
  {
    id: 'beef_heart', dbName: 'beef_heart',
    names: ['牛心', '牛心肉', 'beef heart', 'heart'],
    category: 'protein',
    nutrients: { calories: 112, protein: 17, fat: 4.7, carbs: 0.1, calcium: 7, phosphorus: 212, omega3: 50, taurine: 65, vitaminA: 0, vitaminD: 0, zinc: 1.7, iodine: 5 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: [],
    notes: '富含牛磺酸和CoQ10，优质器官肉'
  },
  {
    id: 'rabbit_meat', dbName: 'rabbit_meat',
    names: ['兔肉', 'rabbit', 'rabbit meat'],
    category: 'protein',
    nutrients: { calories: 136, protein: 20, fat: 5.5, carbs: 0, calcium: 19, phosphorus: 199, omega3: 120, taurine: 30, vitaminA: 0, vitaminD: 0, zinc: 1.3, iodine: 6 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: []
  },
  {
    id: 'lamb_leg', dbName: 'lamb_leg',
    names: ['羊肉', '羊腿肉', 'lamb', 'lamb leg', 'lamb meat'],
    category: 'protein',
    nutrients: { calories: 195, protein: 21, fat: 12, carbs: 0, calcium: 18, phosphorus: 175, omega3: 100, taurine: 40, vitaminA: 0, vitaminD: 0, zinc: 3.4, iodine: 5 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: ['pancreatitis']
  },
  {
    id: 'sardines_canned', dbName: 'sardines_canned',
    names: ['沙丁鱼', '罐头沙丁鱼', 'sardines', 'sardine', 'sardines canned'],
    category: 'protein',
    nutrients: { calories: 208, protein: 25, fat: 11, carbs: 0, calcium: 382, phosphorus: 490, omega3: 1480, taurine: 100, vitaminA: 30, vitaminD: 193, zinc: 1.3, iodine: 40 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: ['pancreatitis', 'kidney'],
    notes: '钙磷极高，肾病慎用；选无盐款'
  },
  {
    id: 'mackerel', dbName: 'mackerel',
    names: ['鲭鱼', '青花鱼', 'mackerel'],
    category: 'protein',
    nutrients: { calories: 205, protein: 19, fat: 14, carbs: 0, calcium: 12, phosphorus: 217, omega3: 2670, taurine: 80, vitaminA: 50, vitaminD: 360, zinc: 0.8, iodine: 45 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: ['pancreatitis']
  },
  {
    id: 'venison', dbName: 'venison',
    names: ['鹿肉', 'venison', 'deer meat'],
    category: 'protein',
    nutrients: { calories: 158, protein: 26, fat: 5.0, carbs: 0, calcium: 6, phosphorus: 210, omega3: 80, taurine: 35, vitaminA: 0, vitaminD: 0, zinc: 2.8, iodine: 5 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: []
  },
  {
    id: 'quail_egg', dbName: 'quail_egg',
    names: ['鹌鹑蛋', 'quail egg', 'quail eggs'],
    category: 'protein',
    nutrients: { calories: 158, protein: 13, fat: 11, carbs: 0.4, calcium: 64, phosphorus: 226, omega3: 80, taurine: 0, vitaminA: 156, vitaminD: 80, zinc: 1.5, iodine: 22 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: ['pancreatitis'],
    notes: '必须全熟'
  },
  // ── Pro 扩展蔬菜类 ──
  {
    id: 'zucchini', dbName: 'zucchini',
    names: ['西葫芦', '节瓜', 'zucchini', 'courgette'],
    category: 'veggie',
    nutrients: { calories: 17, protein: 1.2, fat: 0.3, carbs: 3.1, calcium: 16, phosphorus: 38, omega3: 0, taurine: 0, vitaminA: 10, vitaminD: 0, zinc: 0.3, iodine: 3 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: []
  },
  {
    id: 'asparagus', dbName: 'asparagus',
    names: ['芦笋', 'asparagus'],
    category: 'veggie',
    nutrients: { calories: 20, protein: 2.2, fat: 0.1, carbs: 3.9, calcium: 24, phosphorus: 52, omega3: 0, taurine: 0, vitaminA: 38, vitaminD: 0, zinc: 0.5, iodine: 2 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: []
  },
  {
    id: 'blueberry', dbName: 'blueberry',
    names: ['蓝莓', 'blueberry', 'blueberries'],
    category: 'veggie',
    nutrients: { calories: 57, protein: 0.7, fat: 0.3, carbs: 14.5, calcium: 6, phosphorus: 12, omega3: 0, taurine: 0, vitaminA: 3, vitaminD: 0, zinc: 0.2, iodine: 1 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: ['diabetes']
  },
  {
    id: 'celery', dbName: 'celery',
    names: ['芹菜', 'celery'],
    category: 'veggie',
    nutrients: { calories: 14, protein: 0.7, fat: 0.2, carbs: 3.0, calcium: 40, phosphorus: 25, omega3: 0, taurine: 0, vitaminA: 22, vitaminD: 0, zinc: 0.1, iodine: 2 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: []
  },
  {
    id: 'green_beans', dbName: 'green_beans',
    names: ['四季豆', '绿豆角', 'green beans', 'string beans'],
    category: 'veggie',
    nutrients: { calories: 31, protein: 1.8, fat: 0.2, carbs: 7.0, calcium: 37, phosphorus: 38, omega3: 0, taurine: 0, vitaminA: 35, vitaminD: 0, zinc: 0.2, iodine: 3 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: []
  },
  // ── 内脏类 ──
  {
    id: 'chicken_liver', dbName: 'chicken_liver',
    names: ['鸡肝', 'chicken liver'],
    category: 'organ',
    nutrients: { calories: 119, protein: 17, fat: 4.5, carbs: 0.9, calcium: 8, phosphorus: 297, omega3: 50, taurine: 110, vitaminA: 11000, vitaminD: 50, zinc: 2.7, iodine: 12 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: ['kidney'],
    notes: '维生素A含量极高，每日用量不超过总食材10%'
  },
  {
    id: 'chicken_gizzard', dbName: 'chicken_gizzard',
    names: ['鸡胗', 'chicken gizzard'],
    category: 'organ',
    nutrients: { calories: 94, protein: 17.7, fat: 2.1, carbs: 0, calcium: 10, phosphorus: 162, omega3: 20, taurine: 60, vitaminA: 60, vitaminD: 0, zinc: 2.4, iodine: 5 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: []
  },
  // ── 蔬菜类 ──
  {
    id: 'carrot', dbName: 'carrot',
    names: ['胡萝卜', 'carrot'],
    category: 'veggie',
    nutrients: { calories: 41, protein: 0.9, fat: 0.2, carbs: 9.6, calcium: 33, phosphorus: 35, omega3: 0, taurine: 0, vitaminA: 835, vitaminD: 0, zinc: 0.2, iodine: 5 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: ['diabetes']
  },
  {
    id: 'broccoli', dbName: 'broccoli',
    names: ['西兰花', '花椰菜', 'broccoli'],
    category: 'veggie',
    nutrients: { calories: 34, protein: 2.8, fat: 0.4, carbs: 6.6, calcium: 47, phosphorus: 66, omega3: 0, taurine: 0, vitaminA: 31, vitaminD: 0, zinc: 0.4, iodine: 15 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: []
  },
  {
    id: 'pumpkin', dbName: 'pumpkin',
    names: ['南瓜', 'pumpkin'],
    category: 'veggie',
    nutrients: { calories: 26, protein: 1.0, fat: 0.1, carbs: 6.5, calcium: 21, phosphorus: 44, omega3: 0, taurine: 0, vitaminA: 426, vitaminD: 0, zinc: 0.3, iodine: 1 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: []
  },
  {
    id: 'sweet_potato', dbName: 'sweet_potato',
    names: ['红薯', '番薯', 'sweet potato'],
    category: 'veggie',
    nutrients: { calories: 86, protein: 1.6, fat: 0.1, carbs: 20, calcium: 30, phosphorus: 47, omega3: 0, taurine: 0, vitaminA: 961, vitaminD: 0, zinc: 0.3, iodine: 3 },
    dogSafe: true, catSafe: false,
    forbiddenFor: [], cautionFor: ['diabetes', 'obesity']
  },
  {
    id: 'spinach', dbName: 'spinach',
    names: ['菠菜', 'spinach'],
    category: 'veggie',
    nutrients: { calories: 23, protein: 2.9, fat: 0.4, carbs: 3.6, calcium: 99, phosphorus: 49, omega3: 0, taurine: 0, vitaminA: 469, vitaminD: 0, zinc: 0.5, iodine: 8 },
    dogSafe: true, catSafe: false,
    forbiddenFor: ['kidney'], cautionFor: ['kidney', 'obesity'],
    notes: '草酸含量高，肾病禁用；老年犬（>8岁）建议避免；catSafe=false（高草酸对猫有泌尿结石风险）'
  },
  {
    id: 'green_peas', dbName: 'green_peas',
    names: ['青豆', '豌豆', 'green peas', 'peas'],
    category: 'veggie',
    nutrients: { calories: 81, protein: 5.4, fat: 0.4, carbs: 14, calcium: 25, phosphorus: 108, omega3: 0, taurine: 0, vitaminA: 38, vitaminD: 0, zinc: 1.2, iodine: 3 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: ['kidney']
  },
  // ── 碳水类 ──
  {
    id: 'brown_rice_cooked', dbName: 'brown_rice_cooked',
    names: ['糙米', '煮熟糙米', 'brown rice', 'cooked brown rice'],
    category: 'carb',
    nutrients: { calories: 111, protein: 2.6, fat: 0.9, carbs: 23, calcium: 10, phosphorus: 83, omega3: 0, taurine: 0, vitaminA: 0, vitaminD: 0, zinc: 0.6, iodine: 1 },
    dogSafe: true, catSafe: false, forbiddenFor: [], cautionFor: ['diabetes', 'obesity']
  },
  {
    id: 'white_rice_cooked', dbName: 'white_rice_cooked',
    names: ['白米饭', '米饭', 'white rice', 'cooked rice', 'rice'],
    category: 'carb',
    nutrients: { calories: 130, protein: 2.7, fat: 0.3, carbs: 28, calcium: 10, phosphorus: 43, omega3: 0, taurine: 0, vitaminA: 0, vitaminD: 0, zinc: 0.4, iodine: 1 },
    dogSafe: true, catSafe: false, forbiddenFor: [], cautionFor: ['diabetes', 'obesity']
  },
  {
    id: 'oatmeal_cooked', dbName: 'oatmeal_cooked',
    names: ['燕麦', '麦片', 'oatmeal', 'oats'],
    category: 'carb',
    nutrients: { calories: 68, protein: 2.4, fat: 1.4, carbs: 12, calcium: 9, phosphorus: 77, omega3: 0, taurine: 0, vitaminA: 0, vitaminD: 0, zinc: 0.6, iodine: 1 },
    dogSafe: true, catSafe: false, forbiddenFor: [], cautionFor: ['diabetes']
  },
  // ── 补充剂/油脂类 ──
  {
    id: 'calcium_carbonate', dbName: 'calcium_carbonate',
    names: ['碳酸钙粉', '钙粉', 'calcium carbonate', 'calcium powder'],
    category: 'supplement',
    nutrients: { calories: 0, protein: 0, fat: 0, carbs: 0, calcium: 400, phosphorus: 0, omega3: 0, taurine: 0, vitaminA: 0, vitaminD: 0, zinc: 0, iodine: 0 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: []
  },
  {
    id: 'fish_oil', dbName: 'fish_oil',
    names: ['鱼油', '三文鱼油', 'fish oil', 'salmon oil'],
    category: 'oil',
    nutrients: { calories: 900, protein: 0, fat: 100, carbs: 0, calcium: 0, phosphorus: 0, omega3: 30000, taurine: 0, vitaminA: 0, vitaminD: 0, zinc: 0, iodine: 0 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: ['pancreatitis']
  },
  {
    id: 'taurine_supplement', dbName: 'taurine_supplement',
    names: ['牛磺酸补充剂', '牛磺酸', 'taurine supplement', 'taurine'],
    category: 'supplement',
    nutrients: { calories: 0, protein: 0, fat: 0, carbs: 0, calcium: 0, phosphorus: 0, omega3: 0, taurine: 1000, vitaminA: 0, vitaminD: 0, zinc: 0, iodine: 0 },
    dogSafe: true, catSafe: true, forbiddenFor: [], cautionFor: [],
    notes: '猫专用补充剂，狗可自行合成无需额外补充'
  },
]

/**
 * 查找食材
 * isDbName=true：精确匹配 dbName，失败即视为未知食材，不走模糊匹配
 * isDbName=false（默认）：精确匹配失败后继续走 names 模糊匹配
 */
export function findFood(nameOrDbName: string, isDbName = false): FoodItem | undefined {
  const normalized = nameOrDbName.trim().toLowerCase()
  const exactMatch = NUTRITION_DB.find(item => item.dbName === normalized)
  if (exactMatch) return exactMatch
  if (isDbName) return undefined
  return NUTRITION_DB.find(item =>
    item.names.some(n =>
      n.toLowerCase().includes(normalized) || normalized.includes(n.toLowerCase())
    )
  )
}

export function getForbiddenFoods(conditions: string[]): string[] {
  return NUTRITION_DB
    .filter(item => conditions.some(c => item.forbiddenFor.includes(c as any)))
    .map(item => item.dbName)
}

export function getAllowedFoodsByCategory(
  category: FoodItem['category'],
  conditions: string[],
  species: 'dog' | 'cat' = 'dog'
): FoodItem[] {
  return NUTRITION_DB.filter(item =>
    item.category === category &&
    (species === 'cat' ? item.catSafe : item.dogSafe) &&
    !conditions.some(c => item.forbiddenFor.includes(c as any))
  )
}
