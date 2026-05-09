export type SafetyLevel = 'safe' | 'caution' | 'danger'

export interface IngredientSafety {
  name: string
  aliases: string[]   // English + multilingual aliases for search
  level: SafetyLevel
  title: string
  message: string        // Chinese content
  messageEn: string      // English content
  dogSafe: boolean
  catSafe: boolean
  kidneyWarning?: string
  kidneyWarningEn?: string
  pancreatitisWarning?: string
  pancreatitisWarningEn?: string
}

export const SAFETY_DB: Record<string, IngredientSafety> = {
  '洋葱': {
    name: '洋葱',
    aliases: ['onion','onions','shallot','shallots','green onion','spring onion','chive',
              'oignon','oignons','échalote',       // French
              'cebolla','cebollas','chalote',       // Spanish
              '玉ねぎ','ネギ','葱',                 // Japanese
              '양파','파','쪽파'],                   // Korean
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message: '含N-丙基二硫化物，破坏红细胞导致溶血性贫血。生/熟/粉末均有毒，猫狗均严格禁止。',
    messageEn: 'Contains N-propyl disulfide which destroys red blood cells causing hemolytic anemia. Raw, cooked, and powdered forms are all toxic. Strictly forbidden for both dogs and cats.',
  },
  '大蒜': {
    name: '大蒜',
    aliases: ['garlic','garlic powder','roasted garlic','garlic clove',
              'ail','ail en poudre',                // French
              'ajo','ajo en polvo',                 // Spanish
              'にんにく','ガーリック',               // Japanese
              '마늘'],                              // Korean
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message: '葱属植物，毒性是洋葱5倍。所有形态（包括大蒜粉）均有毒，猫咪尤其敏感。',
    messageEn: 'Allium plant — 5× more toxic than onion. All forms including garlic powder are toxic. Cats are especially sensitive.',
  },
  '韭菜': {
    name: '韭菜',
    aliases: ['leek','leeks','chinese chive','chives','scallion',
              'poireau','ciboulette',               // French
              'puerro','cebollino',                 // Spanish
              'ニラ','ネギ',                         // Japanese
              '부추','파'],                          // Korean
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message: '葱属植物，同洋葱/大蒜级别毒性，严格禁止。',
    messageEn: 'Allium plant with the same toxicity as onion and garlic. Strictly forbidden.',
  },
  '葡萄': {
    name: '葡萄',
    aliases: ['grape','grapes','raisin','raisins','currant','currants','sultana','sultanas',
              'raisin','raisins','cassis',          // French (raisin = grape in French!)
              'uva','uvas','pasa','pasas',          // Spanish
              'ぶどう','レーズン',                   // Japanese
              '포도','건포도'],                      // Korean
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message: '可导致急性肾衰竭，即使极少量也有致死风险。葡萄干同等危险。',
    messageEn: 'Can cause acute kidney failure — even tiny amounts can be lethal. Raisins are equally dangerous.',
  },
  '葡萄干': {
    name: '葡萄干',
    aliases: ['raisin','raisins','dried grape','dried grapes','sultana','currant',
              'raisin sec','raisins secs',          // French
              'uva pasa','pasas',                   // Spanish
              'レーズン','干しぶどう',               // Japanese
              '건포도'],                            // Korean
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message: '与葡萄同等毒性，浓缩后毒性更强，严格禁止。',
    messageEn: 'Same toxicity as grapes — more concentrated and even more dangerous. Strictly forbidden.',
  },
  '巧克力': {
    name: '巧克力',
    aliases: ['chocolate','cocoa','cacao','dark chocolate','milk chocolate','white chocolate','choc',
              'chocolat','cacao',                   // French
              'chocolate','cacao',                  // Spanish (same)
              'チョコレート','ショコラ','カカオ',     // Japanese
              '초콜릿','카카오'],                    // Korean
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message: '含可可碱和咖啡因，导致心律失常、癫痫甚至死亡。黑巧克力毒性最强。',
    messageEn: 'Contains theobromine and caffeine which cause cardiac arrhythmia, seizures, and death. Dark chocolate is the most toxic form.',
  },
  '木糖醇': {
    name: '木糖醇',
    aliases: ['xylitol','birch sugar','xilitol','e967',
              'xylitol','sucre de bouleau',         // French
              'xilitol',                            // Spanish
              'キシリトール',                        // Japanese
              '자일리톨'],                           // Korean
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message: '常见于口香糖、某些花生酱，导致犬血糖骤降和肝衰竭，极其危险。',
    messageEn: 'Found in gum and some peanut butters. Causes severe blood sugar crash and liver failure in dogs. Extremely dangerous.',
  },
  '牛油果': {
    name: '牛油果',
    aliases: ['avocado','avocados','aguacate',
              'avocat','avocats',                   // French
              'aguacate','palta',                   // Spanish
              'アボカド',                            // Japanese
              '아보카도'],                           // Korean
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message: '含Persin毒素，果肉/核/皮/叶均有毒，ASPCA列明确有毒食材。',
    messageEn: 'Contains Persin toxin. Flesh, pit, skin, and leaves are all toxic. Listed as clearly toxic by ASPCA.',
  },
  '夏威夷果': {
    name: '夏威夷果',
    aliases: ['macadamia','macadamia nut','macadamia nuts','hawaii nut',
              'noix de macadamia',                  // French
              'nuez de macadamia',                  // Spanish
              'マカダミアナッツ',                    // Japanese
              '마카다미아'],                         // Korean
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message: '导致虚弱/高温/呕吐，ASPCA列明确有毒食材，严格禁止。',
    messageEn: 'Causes weakness, high fever, and vomiting. Listed as clearly toxic by ASPCA. Strictly forbidden.',
  },
  '咖啡': {
    name: '咖啡',
    aliases: ['coffee','caffeine','espresso','tea','green tea','coffee bean','coffee grounds',
              'café','caféine','thé',               // French
              'café','cafeína','té',                // Spanish
              'コーヒー','カフェイン','お茶',         // Japanese
              '커피','카페인','차'],                 // Korean
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message: '含咖啡因，心动过速/癫痫/死亡，所有含咖啡因食物均禁止。',
    messageEn: 'Contains caffeine causing heart palpitations, seizures, and death. All caffeinated foods are forbidden.',
  },
  '酒精': {
    name: '酒精',
    aliases: ['alcohol','beer','wine','liquor','ethanol','spirits','sake',
              'alcool','bière','vin',               // French
              'alcohol','cerveza','vino',           // Spanish
              'アルコール','ビール','ワイン','酒',   // Japanese
              '알코올','맥주','와인','술'],           // Korean
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message: '极低剂量即可造成肝脏损害，所有形式禁止。',
    messageEn: 'Even tiny doses can cause liver damage. All forms are forbidden.',
  },
  '食盐': {
    name: '食盐',
    aliases: ['salt','sodium','sea salt','table salt','soy sauce','salt seasoning',
              'sel','sauce soja',                   // French
              'sal','salsa de soja',                // Spanish
              '塩','食塩','醤油',                   // Japanese
              '소금','간장'],                       // Korean
    level: 'danger', title: '禁止添加', dogSafe: false, catSafe: false,
    message: '过量导致钠离子中毒，所有宠物食物严格不加盐。',
    messageEn: 'Excess sodium causes sodium ion toxicity. Strictly no added salt in any pet food.',
  },
  '樱桃': {
    name: '樱桃',
    aliases: ['cherry','cherries','wild cherry','maraschino cherry',
              'cerise','cerises',                   // French
              'cereza','cerezas',                   // Spanish
              'さくらんぼ','チェリー',               // Japanese
              '체리'],                              // Korean
    level: 'danger', title: '禁止喂食（含核）', dogSafe: false, catSafe: false,
    message: '核/茎/叶含氰化物，建议整体避免喂食。',
    messageEn: 'Pits, stems, and leaves contain cyanide. Best to avoid feeding entirely.',
  },
  '鸡胸肉': {
    name: '鸡胸肉',
    aliases: ['chicken','chicken breast','chicken meat','cooked chicken','boiled chicken','chicken fillet',
              'poulet','blanc de poulet','filet de poulet', // French
              'pollo','pechuga de pollo',            // Spanish
              '鶏肉','鶏胸肉','チキン',              // Japanese
              '닭고기','닭가슴살','치킨'],            // Korean
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message: '优质蛋白质来源，煮熟去皮去骨即可。不可调味，禁止加盐/葱/蒜。',
    messageEn: 'Excellent protein source. Cook thoroughly, remove skin and bones. No seasoning — no salt, onion, or garlic.',
    kidneyWarning: '肾病需控制蛋白质总量，可少量食用',
    kidneyWarningEn: 'Kidney disease: control total protein intake, feed in small amounts only.',
  },
  '鸡腿肉': {
    name: '鸡腿肉',
    aliases: ['chicken thigh','chicken leg','chicken drumstick','dark meat chicken',
              'cuisse de poulet','pilon de poulet', // French
              'muslo de pollo','contramuslo',       // Spanish
              '鶏もも肉','鶏肉',                    // Japanese
              '닭다리살','닭허벅지'],               // Korean
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message: '蛋白质来源，脂肪略高于胸肉，必须去皮去骨煮熟，不可调味。',
    messageEn: 'Good protein source with slightly more fat than breast meat. Must be skinned, deboned, and cooked thoroughly. No seasoning.',
    pancreatitisWarning: '脂肪较高，胰腺炎需去皮控量',
    pancreatitisWarningEn: 'Higher fat content — remove skin and limit quantity for pancreatitis.',
  },
  '牛肉': {
    name: '牛肉',
    aliases: ['beef','ground beef','lean beef','minced beef','steak','hamburger','boeuf','bœuf',
              'bœuf','viande de bœuf','steak',      // French
              'ternera','carne de res','vaca',       // Spanish
              '牛肉','ビーフ',                       // Japanese
              '소고기','쇠고기','비프'],             // Korean
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message: '高蛋白铁来源，煮熟食用，不可调味，过肥部分去除。',
    messageEn: 'High protein and iron source. Cook thoroughly, remove fatty parts, and use no seasoning.',
    kidneyWarning: '磷含量较高，肾病需限量',
    kidneyWarningEn: 'Higher phosphorus — limit quantity for kidney disease.',
  },
  '羊肉': {
    name: '羊肉',
    aliases: ['lamb','mutton','lamb meat','lamb chop',
              'agneau','mouton',                    // French
              'cordero','carne de cordero',         // Spanish
              'ラム肉','マトン',                     // Japanese
              '양고기','어린양고기'],               // Korean
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message: '适合对鸡肉/牛肉过敏的宠物，去除多余脂肪后煮熟食用。',
    messageEn: 'Good for pets allergic to chicken or beef. Remove excess fat and cook thoroughly.',
    pancreatitisWarning: '脂肪较高，选瘦切控量',
    pancreatitisWarningEn: 'Higher fat — choose lean cuts and limit quantity for pancreatitis.',
  },
  '兔肉': {
    name: '兔肉',
    aliases: ['rabbit','rabbit meat','bunny meat',
              'lapin','viande de lapin',            // French
              'conejo','carne de conejo',           // Spanish
              'ウサギ肉','ラビット',                 // Japanese
              '토끼고기'],                          // Korean
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message: '极低脂高蛋白，低过敏原，适合食物过敏宠物，骨骼需去除。',
    messageEn: 'Very low fat, high protein, hypoallergenic. Great for food-sensitive pets. Remove all bones.',
    kidneyWarning: '低磷低钾，肾病友好选项',
    kidneyWarningEn: 'Low phosphorus and potassium — a kidney-friendly protein option.',
  },
  '三文鱼': {
    name: '三文鱼',
    aliases: ['salmon','atlantic salmon','cooked salmon','smoked salmon',
              'saumon','saumon atlantique',         // French
              'salmón','salmon',                   // Spanish
              'サーモン','鮭','サケ',               // Japanese
              '연어'],                              // Korean
    level: 'caution', title: '慎用（需熟食）', dogSafe: true, catSafe: true,
    message: '富含Omega-3，但必须完全煮熟！生三文鱼对狗有鲑鱼中毒风险。',
    messageEn: 'Rich in Omega-3, but must be fully cooked! Raw salmon carries salmon poisoning risk for dogs.',
    kidneyWarning: '磷含量适中，肾病可低量食用',
    kidneyWarningEn: 'Moderate phosphorus — kidney disease pets can eat small amounts.',
  },
  '沙丁鱼': {
    name: '沙丁鱼',
    aliases: ['sardine','sardines','canned sardine',
              'sardine','sardines',                 // French (same)
              'sardina','sardinas',                 // Spanish
              'イワシ','サーディン',                 // Japanese
              '정어리'],                            // Korean
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message: '高Omega-3，选水浸无盐罐头，避免盐水/番茄汁罐头。',
    messageEn: 'High Omega-3. Choose water-packed unsalted canned sardines — avoid brine or tomato sauce cans.',
    kidneyWarning: '钾/磷较高，肾病需控量',
    kidneyWarningEn: 'Higher potassium and phosphorus — limit quantity for kidney disease.',
  },
  '鳕鱼': {
    name: '鳕鱼',
    aliases: ['cod','cod fish','white fish','pollock','haddock',
              'cabillaud','morue',                  // French
              'bacalao','merluza',                  // Spanish
              'タラ','鱈','コッド',                  // Japanese
              '대구','명태'],                       // Korean
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message: '极低脂高蛋白，刺多需小心，煮熟后去刺喂食，不可调味。',
    messageEn: 'Very low fat, high protein. Many small bones — cook thoroughly and remove all bones. No seasoning.',
    kidneyWarning: '低磷低钾，肾病友好',
    kidneyWarningEn: 'Low phosphorus and potassium — kidney-friendly.',
  },
  '鸡蛋': {
    name: '鸡蛋',
    aliases: ['egg','eggs','chicken egg','boiled egg','scrambled egg','cooked egg',
              'œuf','oeuf','oeufs',                // French
              'huevo','huevos',                    // Spanish
              '卵','たまご','エッグ',               // Japanese
              '달걀','계란'],                       // Korean
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message: '完全蛋白质来源，必须完全煮熟（生蛋白含卵白素），每周2-3个为宜。',
    messageEn: 'Complete protein source. Must be fully cooked — raw egg white contains avidin. 2–3 per week recommended.',
    kidneyWarning: '磷含量中等，肾病需控量',
    kidneyWarningEn: 'Moderate phosphorus — limit quantity for kidney disease.',
  },
  '鸡心': {
    name: '鸡心',
    aliases: ['chicken heart','heart','chicken hearts',
              'cœur de poulet','cœurs',            // French
              'corazón de pollo',                  // Spanish
              '鶏ハツ','ハート',                    // Japanese
              '닭 심장','닭 하트'],                 // Korean
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message: '猫必需牛磺酸来源之一，煮熟后少量喂食，建议占饮食不超过10%。',
    messageEn: 'Key taurine source for cats. Feed cooked in small amounts — no more than 10% of total diet.',
    kidneyWarning: '磷较高，肾病需控量',
    kidneyWarningEn: 'Higher phosphorus — limit quantity for kidney disease.',
  },
  '鸡肝': {
    name: '鸡肝',
    aliases: ['chicken liver','liver','beef liver','liver meat',
              'foie de poulet','foie',             // French
              'hígado de pollo','hígado',          // Spanish
              '鶏レバー','レバー',                  // Japanese
              '닭 간','간'],                       // Korean
    level: 'caution', title: '慎用（限量）', dogSafe: true, catSafe: true,
    message: '极高维生素A，过量导致中毒。每周不超过总食量的5%，不可日常大量喂食。',
    messageEn: 'Extremely high in vitamin A — excess causes toxicity. No more than 5% of total diet per week. Not for daily large-scale feeding.',
    kidneyWarning: '磷/铜过高，肾病严格限制',
    kidneyWarningEn: 'Too high in phosphorus and copper — strictly limited for kidney disease.',
    pancreatitisWarning: '高脂高铜，胰腺炎慎用',
    pancreatitisWarningEn: 'High fat and copper — use with great caution in pancreatitis.',
  },
  '胡萝卜': {
    name: '胡萝卜',
    aliases: ['carrot','carrots','baby carrot',
              'carotte','carottes',                // French
              'zanahoria','zanahorias',            // Spanish
              'にんじん','ニンジン',                 // Japanese
              '당근'],                             // Korean
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message: 'β胡萝卜素丰富，低热量零食，蒸熟或少量生食均可。',
    messageEn: 'Rich in beta-carotene, low-calorie treat. Can be steamed or eaten lightly raw in small amounts.',
  },
  '南瓜': {
    name: '南瓜',
    aliases: ['pumpkin','squash','butternut squash','pumpkin puree',
              'courge','citrouille','potiron',     // French
              'calabaza','zapallo',                // Spanish
              'かぼちゃ','パンプキン',              // Japanese
              '호박'],                             // Korean
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message: '低磷低钾，富含纤维，有助调节肠道，煮熟去皮去籽，避免含糖罐头。',
    messageEn: 'Low phosphorus and potassium, high fiber, aids digestion. Cook and remove skin and seeds — avoid sugary canned pumpkin.',
    kidneyWarning: '低磷低钾，肾病友好型蔬菜',
    kidneyWarningEn: 'Low phosphorus and potassium — a kidney-friendly vegetable.',
  },
  '甘薯': {
    name: '甘薯',
    aliases: ['sweet potato','yam','sweet potatoes','kumara',
              'patate douce',                      // French
              'batata','camote',                   // Spanish
              'さつまいも','スイートポテト',         // Japanese
              '고구마'],                           // Korean
    level: 'caution', title: '慎用', dogSafe: true, catSafe: false,
    message: '含草酸，煮熟去皮，不宜过量，猫咪不推荐。',
    messageEn: 'Contains oxalic acid. Cook and peel thoroughly. Not recommended for cats or in large quantities.',
    kidneyWarning: '钾和磷含量较高，肾病需控量',
    kidneyWarningEn: 'Higher potassium and phosphorus — limit quantity for kidney disease.',
  },
  '菠菜': {
    name: '菠菜',
    aliases: ['spinach','baby spinach',
              'épinard','épinards',                // French
              'espinaca','espinacas',              // Spanish
              'ほうれん草','ほうれんそう',           // Japanese
              '시금치'],                           // Korean
    level: 'caution', title: '慎用', dogSafe: false, catSafe: false,
    message: '草酸含量高，肾结石/泌尿问题宠物禁用。健康宠物极少量偶尔可用。',
    messageEn: 'High oxalate content — forbidden for pets with kidney stones or urinary issues. Healthy pets may have tiny amounts occasionally.',
    kidneyWarning: '草酸高，肾病禁用',
    kidneyWarningEn: 'High oxalate — forbidden for kidney disease.',
  },
  '西兰花': {
    name: '西兰花',
    aliases: ['broccoli','brocoli','broccoli floret',
              'brocoli','brocolis',                // French
              'brócoli','brócoles',               // Spanish
              'ブロッコリー',                       // Japanese
              '브로콜리'],                         // Korean
    level: 'caution', title: '慎用（限量）', dogSafe: true, catSafe: true,
    message: '含异硫氰酸酯，大量摄入对犬有毒性，仅作点心不超过总食量10%。',
    messageEn: 'Contains isothiocyanates — large amounts are toxic for dogs. Use as treat only, under 10% of total diet.',
  },
  '白米': {
    name: '白米',
    aliases: ['rice','white rice','cooked rice','plain rice','jasmine rice',
              'riz','riz blanc',                   // French
              'arroz','arroz blanco',              // Spanish
              '白米','お米','ごはん',               // Japanese
              '쌀','흰쌀','밥'],                   // Korean
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message: '易消化碳水来源，腹泻恢复期推荐，需完全煮熟，不宜作主食长期依赖。',
    messageEn: 'Easily digestible carbohydrate — recommended for diarrhea recovery. Must be fully cooked. Not suitable as the sole staple long-term.',
    kidneyWarning: '低磷低钾，肾病相对安全',
    kidneyWarningEn: 'Low phosphorus and potassium — relatively safe for kidney disease.',
  },
  '燕麦': {
    name: '燕麦',
    aliases: ['oat','oats','oatmeal','rolled oats','porridge',
              'avoine','flocons davoine',          // French
              'avena','copos de avena',            // Spanish
              'オーツ','燕麦','オートミール',        // Japanese
              '귀리','오트밀'],                    // Korean
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message: '可溶性纤维，煮熟无调味无糖无奶，调节血糖和胆固醇。',
    messageEn: 'Soluble fiber. Cook without seasoning, sugar, or milk. Helps regulate blood sugar and cholesterol.',
    kidneyWarning: '磷含量中等，肾病需控量',
    kidneyWarningEn: 'Moderate phosphorus — limit quantity for kidney disease.',
  },
  '蓝莓': {
    name: '蓝莓',
    aliases: ['blueberry','blueberries','wild blueberry',
              'myrtille','myrtilles','bleuet',     // French
              'arándano','arándanos',              // Spanish
              'ブルーベリー',                       // Japanese
              '블루베리'],                         // Korean
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message: '天然抗氧化剂，少量作零食，勿过量（高糖）。',
    messageEn: 'Natural antioxidant. Use as a small treat — do not overfeed (high sugar content).',
  },
  '苹果': {
    name: '苹果',
    aliases: ['apple','apples','green apple','red apple',
              'pomme','pommes',                    // French
              'manzana','manzanas',               // Spanish
              'りんご','リンゴ',                    // Japanese
              '사과'],                             // Korean
    level: 'caution', title: '慎用（去核去籽）', dogSafe: true, catSafe: true,
    message: '苹果籽含氰化物，必须彻底去核去籽，果皮清洗干净再喂食。',
    messageEn: 'Apple seeds contain cyanide — thoroughly remove core and all seeds. Wash skin carefully before feeding.',
  },
  '香蕉': {
    name: '香蕉',
    aliases: ['banana','bananas','plantain',
              'banane','bananes',                  // French
              'plátano','banana','banano',         // Spanish
              'バナナ',                             // Japanese
              '바나나'],                           // Korean
    level: 'caution', title: '慎用', dogSafe: true, catSafe: false,
    message: '钾含量高，肾病宠物严格限制，糖尿病/肥胖宠物禁用，猫不推荐。',
    messageEn: 'High potassium — strictly limited for kidney disease. Forbidden for diabetic or obese pets. Not recommended for cats.',
    kidneyWarning: '钾含量高，肾病禁忌',
    kidneyWarningEn: 'High potassium — contraindicated for kidney disease.',
  },
  '西瓜': {
    name: '西瓜',
    aliases: ['watermelon','watermelons','seedless watermelon',
              'pastèque',                          // French
              'sandía','melón de agua',            // Spanish
              'スイカ','すいか',                    // Japanese
              '수박'],                             // Korean
    level: 'caution', title: '慎用（去皮去籽）', dogSafe: true, catSafe: true,
    message: '补水零食，必须去皮去籽，钾含量较高肾病需控量。',
    messageEn: 'Hydrating treat. Must remove rind and all seeds. Higher potassium — kidney disease pets should limit intake.',
    kidneyWarning: '钾含量较高，肾病需控量',
    kidneyWarningEn: 'Higher potassium — limit quantity for kidney disease.',
  },
  '鱼油': {
    name: '鱼油',
    aliases: ['fish oil','omega-3','omega 3','fish oil supplement',
              'huile de poisson','oméga-3',        // French
              'aceite de pescado','omega-3',       // Spanish
              'フィッシュオイル','魚油','オメガ3',   // Japanese
              '생선 기름','어유','오메가3'],         // Korean
    level: 'safe', title: '安全（控量）', dogSafe: true, catSafe: true,
    message: 'EPA/DHA来源，剂量严格按体重计算，过量导致腹泻，购买宠物专用级别。',
    messageEn: 'EPA/DHA source. Dose strictly by weight — excess causes diarrhea. Use pet-grade products only.',
  },
  '橄榄油': {
    name: '橄榄油',
    aliases: ['olive oil','extra virgin olive oil','evoo',
              'huile dolive','huile d\'olive',     // French
              'aceite de oliva',                   // Spanish
              'オリーブオイル','オリーブ油',         // Japanese
              '올리브 오일','올리브유'],             // Korean
    level: 'caution', title: '慎用（少量）', dogSafe: true, catSafe: true,
    message: '少量润滑肠道，过量导致腹泻。',
    messageEn: 'Small amounts help lubricate digestion — excess causes diarrhea.',
    pancreatitisWarning: '高脂肪，胰腺炎禁止',
    pancreatitisWarningEn: 'High fat — forbidden for pancreatitis.',
  },
}

export function searchIngredient(query: string): IngredientSafety | null {
  const q = query.trim().toLowerCase()
  if (!q) return null

  // 1. Exact match by key (Chinese)
  if (SAFETY_DB[q]) return SAFETY_DB[q]

  for (const entry of Object.values(SAFETY_DB)) {
    // 2. Exact match by name
    if (entry.name.toLowerCase() === q) return entry

    // 3. Exact match by any alias (includes English + multilingual)
    if (entry.aliases.some(a => a.toLowerCase() === q)) return entry
  }

  for (const entry of Object.values(SAFETY_DB)) {
    // 4. Partial match: Chinese name
    if (entry.name.toLowerCase().includes(q) || q.includes(entry.name.toLowerCase())) return entry

    // 5. Partial match: alias (English + multilingual)
    if (entry.aliases.some(a => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()))) return entry
  }

  return null
}
