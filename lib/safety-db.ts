export type SafetyLevel = 'safe' | 'caution' | 'danger'

export interface IngredientSafety {
  name: string
  aliases: string[]   // English + variant names for multi-language search
  level: SafetyLevel
  title: string
  message: string
  dogSafe: boolean
  catSafe: boolean
  kidneyWarning?: string
  pancreatitisWarning?: string
}

export const SAFETY_DB: Record<string, IngredientSafety> = {
  '洋葱': { name:'洋葱', aliases:['onion','onions','shallot','shallots','green onion','spring onion','chive'],
    level:'danger', title:'禁止喂食', dogSafe:false, catSafe:false,
    message:'含N-丙基二硫化物，破坏红细胞导致溶血性贫血。生/熟/粉末均有毒，猫狗均严格禁止。' },
  '大蒜': { name:'大蒜', aliases:['garlic','garlic powder','roasted garlic'],
    level:'danger', title:'禁止喂食', dogSafe:false, catSafe:false,
    message:'葱属植物，毒性是洋葱5倍。所有形态（包括大蒜粉）均有毒，猫咪尤其敏感。' },
  '韭菜': { name:'韭菜', aliases:['leek','leeks','chinese chive','chives'],
    level:'danger', title:'禁止喂食', dogSafe:false, catSafe:false,
    message:'葱属植物，同洋葱/大蒜级别毒性，严格禁止。' },
  '葡萄': { name:'葡萄', aliases:['grape','grapes','raisin','raisins','currant','currants'],
    level:'danger', title:'禁止喂食', dogSafe:false, catSafe:false,
    message:'可导致急性肾衰竭，即使极少量也有致死风险。葡萄干同等危险。' },
  '葡萄干': { name:'葡萄干', aliases:['raisin','raisins','dried grape','dried grapes'],
    level:'danger', title:'禁止喂食', dogSafe:false, catSafe:false,
    message:'与葡萄同等毒性，浓缩后毒性更强，严格禁止。' },
  '巧克力': { name:'巧克力', aliases:['chocolate','cocoa','cacao','dark chocolate','milk chocolate','white chocolate'],
    level:'danger', title:'禁止喂食', dogSafe:false, catSafe:false,
    message:'含可可碱和咖啡因，导致心律失常、癫痫甚至死亡。黑巧克力毒性最强。' },
  '木糖醇': { name:'木糖醇', aliases:['xylitol','birch sugar','xilitol'],
    level:'danger', title:'禁止喂食', dogSafe:false, catSafe:false,
    message:'常见于口香糖、某些花生酱，导致犬血糖骤降和肝衰竭，极其危险。' },
  '牛油果': { name:'牛油果', aliases:['avocado','avocados','aguacate'],
    level:'danger', title:'禁止喂食', dogSafe:false, catSafe:false,
    message:'含Persin毒素，果肉/核/皮/叶均有毒，ASPCA列明确有毒食材。' },
  '夏威夷果': { name:'夏威夷果', aliases:['macadamia','macadamia nut','macadamia nuts'],
    level:'danger', title:'禁止喂食', dogSafe:false, catSafe:false,
    message:'导致虚弱/高温/呕吐，ASPCA列明确有毒食材，严格禁止。' },
  '咖啡': { name:'咖啡', aliases:['coffee','caffeine','espresso','tea','green tea'],
    level:'danger', title:'禁止喂食', dogSafe:false, catSafe:false,
    message:'含咖啡因，心动过速/癫痫/死亡，所有含咖啡因食物均禁止。' },
  '酒精': { name:'酒精', aliases:['alcohol','beer','wine','liquor','ethanol'],
    level:'danger', title:'禁止喂食', dogSafe:false, catSafe:false,
    message:'极低剂量即可造成肝脏损害，所有形式禁止。' },
  '食盐': { name:'食盐', aliases:['salt','sodium','sea salt','table salt','soy sauce'],
    level:'danger', title:'禁止添加', dogSafe:false, catSafe:false,
    message:'过量导致钠离子中毒，所有宠物食物严格不加盐。' },
  '樱桃': { name:'樱桃', aliases:['cherry','cherries','wild cherry'],
    level:'danger', title:'禁止喂食（含核）', dogSafe:false, catSafe:false,
    message:'核/茎/叶含氰化物，建议整体避免喂食。' },
  '鸡胸肉': { name:'鸡胸肉', aliases:['chicken','chicken breast','chicken meat','cooked chicken','boiled chicken'],
    level:'safe', title:'安全可喂食', dogSafe:true, catSafe:true,
    message:'优质蛋白质来源，煮熟去皮去骨即可。不可调味，禁止加盐/葱/蒜。',
    kidneyWarning:'肾病需控制蛋白质总量，可少量食用' },
  '鸡腿肉': { name:'鸡腿肉', aliases:['chicken thigh','chicken leg','chicken drumstick'],
    level:'safe', title:'安全可喂食', dogSafe:true, catSafe:true,
    message:'蛋白质来源，脂肪略高于胸肉，必须去皮去骨煮熟，不可调味。',
    pancreatitisWarning:'脂肪较高，胰腺炎需去皮控量' },
  '牛肉': { name:'牛肉', aliases:['beef','ground beef','lean beef','minced beef'],
    level:'safe', title:'安全可喂食', dogSafe:true, catSafe:true,
    message:'高蛋白铁来源，煮熟食用，不可调味，过肥部分去除。',
    kidneyWarning:'磷含量较高，肾病需限量' },
  '羊肉': { name:'羊肉', aliases:['lamb','mutton','lamb meat'],
    level:'safe', title:'安全可喂食', dogSafe:true, catSafe:true,
    message:'适合对鸡肉/牛肉过敏的宠物，去除多余脂肪后煮熟食用。',
    pancreatitisWarning:'脂肪较高，选瘦切控量' },
  '兔肉': { name:'兔肉', aliases:['rabbit','rabbit meat'],
    level:'safe', title:'安全可喂食', dogSafe:true, catSafe:true,
    message:'极低脂高蛋白，低过敏原，适合食物过敏宠物，骨骼需去除。',
    kidneyWarning:'低磷低钾，肾病友好选项' },
  '三文鱼': { name:'三文鱼', aliases:['salmon','atlantic salmon','cooked salmon'],
    level:'caution', title:'慎用（需熟食）', dogSafe:true, catSafe:true,
    message:'富含Omega-3，但必须完全煮熟！生三文鱼对狗有鲑鱼中毒风险。',
    kidneyWarning:'磷含量适中，肾病可低量食用' },
  '沙丁鱼': { name:'沙丁鱼', aliases:['sardine','sardines'],
    level:'safe', title:'安全可喂食', dogSafe:true, catSafe:true,
    message:'高Omega-3，选水浸无盐罐头，避免盐水/番茄汁罐头。',
    kidneyWarning:'钾/磷较高，肾病需控量' },
  '鳕鱼': { name:'鳕鱼', aliases:['cod','cod fish','white fish','pollock'],
    level:'safe', title:'安全可喂食', dogSafe:true, catSafe:true,
    message:'极低脂高蛋白，刺多需小心，煮熟后去刺喂食，不可调味。',
    kidneyWarning:'低磷低钾，肾病友好' },
  '鸡蛋': { name:'鸡蛋', aliases:['egg','eggs','chicken egg','boiled egg','scrambled egg'],
    level:'safe', title:'安全可喂食', dogSafe:true, catSafe:true,
    message:'完全蛋白质来源，必须完全煮熟（生蛋白含卵白素），每周2-3个为宜。',
    kidneyWarning:'磷含量中等，肾病需控量' },
  '鸡心': { name:'鸡心', aliases:['chicken heart','heart'],
    level:'safe', title:'安全可喂食', dogSafe:true, catSafe:true,
    message:'猫必需牛磺酸来源之一，煮熟后少量喂食，建议占饮食不超过10%。',
    kidneyWarning:'磷较高，肾病需控量' },
  '鸡肝': { name:'鸡肝', aliases:['chicken liver','liver','beef liver'],
    level:'caution', title:'慎用（限量）', dogSafe:true, catSafe:true,
    message:'极高维生素A，过量导致中毒。每周不超过总食量的5%，不可日常大量喂食。',
    kidneyWarning:'磷/铜过高，肾病严格限制',
    pancreatitisWarning:'高脂高铜，胰腺炎慎用' },
  '胡萝卜': { name:'胡萝卜', aliases:['carrot','carrots'],
    level:'safe', title:'安全可喂食', dogSafe:true, catSafe:true,
    message:'β胡萝卜素丰富，低热量零食，蒸熟或少量生食均可。' },
  '南瓜': { name:'南瓜', aliases:['pumpkin','squash','butternut squash'],
    level:'safe', title:'安全可喂食', dogSafe:true, catSafe:true,
    message:'低磷低钾，富含纤维，有助调节肠道，煮熟去皮去籽，避免含糖罐头。',
    kidneyWarning:'低磷低钾，肾病友好型蔬菜' },
  '甘薯': { name:'甘薯', aliases:['sweet potato','yam','sweet potatoes'],
    level:'caution', title:'慎用', dogSafe:true, catSafe:false,
    message:'含草酸，煮熟去皮，不宜过量，猫咪不推荐。',
    kidneyWarning:'钾和磷含量较高，肾病需控量' },
  '菠菜': { name:'菠菜', aliases:['spinach'],
    level:'caution', title:'慎用', dogSafe:false, catSafe:false,
    message:'草酸含量高，肾结石/泌尿问题宠物禁用。健康宠物极少量偶尔可用。',
    kidneyWarning:'草酸高，肾病禁用' },
  '西兰花': { name:'西兰花', aliases:['broccoli','brocoli'],
    level:'caution', title:'慎用（限量）', dogSafe:true, catSafe:true,
    message:'含异硫氰酸酯，大量摄入对犬有毒性，仅作点心不超过总食量10%。' },
  '白米': { name:'白米', aliases:['rice','white rice','cooked rice','plain rice'],
    level:'safe', title:'安全可喂食', dogSafe:true, catSafe:true,
    message:'易消化碳水来源，腹泻恢复期推荐，需完全煮熟，不宜作主食长期依赖。',
    kidneyWarning:'低磷低钾，肾病相对安全' },
  '燕麦': { name:'燕麦', aliases:['oat','oats','oatmeal','rolled oats'],
    level:'safe', title:'安全可喂食', dogSafe:true, catSafe:true,
    message:'可溶性纤维，煮熟无调味无糖无奶，调节血糖和胆固醇。',
    kidneyWarning:'磷含量中等，肾病需控量' },
  '蓝莓': { name:'蓝莓', aliases:['blueberry','blueberries'],
    level:'safe', title:'安全可喂食', dogSafe:true, catSafe:true,
    message:'天然抗氧化剂，少量作零食，勿过量（高糖）。' },
  '苹果': { name:'苹果', aliases:['apple','apples'],
    level:'caution', title:'慎用（去核去籽）', dogSafe:true, catSafe:true,
    message:'苹果籽含氰化物，必须彻底去核去籽，果皮清洗干净再喂食。' },
  '香蕉': { name:'香蕉', aliases:['banana','bananas'],
    level:'caution', title:'慎用', dogSafe:true, catSafe:false,
    message:'钾含量高，肾病宠物严格限制，糖尿病/肥胖宠物禁用，猫不推荐。',
    kidneyWarning:'钾含量高，肾病禁忌' },
  '西瓜': { name:'西瓜', aliases:['watermelon'],
    level:'caution', title:'慎用（去皮去籽）', dogSafe:true, catSafe:true,
    message:'补水零食，必须去皮去籽，钾含量较高肾病需控量。',
    kidneyWarning:'钾含量较高，肾病需控量' },
  '鱼油': { name:'鱼油', aliases:['fish oil','omega-3','omega 3'],
    level:'safe', title:'安全（控量）', dogSafe:true, catSafe:true,
    message:'EPA/DHA来源，剂量严格按体重计算，过量导致腹泻，购买宠物专用级别。' },
  '橄榄油': { name:'橄榄油', aliases:['olive oil'],
    level:'caution', title:'慎用（少量）', dogSafe:true, catSafe:true,
    message:'少量润滑肠道，过量导致腹泻。',
    pancreatitisWarning:'高脂肪，胰腺炎禁止' },
}

export function searchIngredient(query: string): IngredientSafety | null {
  const q = query.trim().toLowerCase()
  if (!q) return null

  // 1. Exact match by key (Chinese)
  if (SAFETY_DB[q]) return SAFETY_DB[q]

  for (const entry of Object.values(SAFETY_DB)) {
    // 2. Exact match by name (Chinese)
    if (entry.name.toLowerCase() === q) return entry

    // 3. Exact match by any alias (English)
    if (entry.aliases.some(a => a.toLowerCase() === q)) return entry
  }

  for (const entry of Object.values(SAFETY_DB)) {
    // 4. Partial match: query contains Chinese name or vice versa
    if (entry.name.toLowerCase().includes(q) || q.includes(entry.name.toLowerCase())) return entry

    // 5. Partial match: query contains alias or alias contains query
    if (entry.aliases.some(a => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()))) return entry
  }

  return null
}
