export type SafetyLevel = 'safe' | 'caution' | 'danger'

interface LocaleText {
  message?: string
  kidneyWarning?: string
  pancreatitisWarning?: string
}

export interface IngredientSafety {
  name: string
  aliases: string[]
  level: SafetyLevel
  title: string
  message: string          // zh
  messageEn: string        // en
  dogSafe: boolean
  catSafe: boolean
  kidneyWarning?: string
  kidneyWarningEn?: string
  pancreatitisWarning?: string
  pancreatitisWarningEn?: string
  translations?: { fr?: LocaleText; es?: LocaleText; ja?: LocaleText; ko?: LocaleText }
}

export const SAFETY_DB: Record<string, IngredientSafety> = {

  /* ─── DANGER ─────────────────────────────────────────────────────────── */

  '洋葱': {
    name: '洋葱',
    aliases: ['onion','onions','shallot','shallots','green onion','spring onion','chive',
              'oignon','oignons','échalote',
              'cebolla','cebollas','chalote',
              '玉ねぎ','ネギ','葱',
              '양파','파','쪽파'],
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message:   '含N-丙基二硫化物，破坏红细胞导致溶血性贫血。生/熟/粉末均有毒，猫狗均严格禁止。',
    messageEn: 'Contains N-propyl disulfide which destroys red blood cells causing hemolytic anemia. Raw, cooked, and powdered forms are all toxic. Strictly forbidden for both dogs and cats.',
    translations: {
      fr: { message: "Contient du N-propyl disulfure qui détruit les globules rouges et provoque une anémie hémolytique. Toutes les formes (cru, cuit, en poudre) sont toxiques. Strictement interdit aux chiens et aux chats." },
      es: { message: "Contiene N-propil disulfuro que destruye los glóbulos rojos causando anemia hemolítica. Todas las formas (crudo, cocido, en polvo) son tóxicas. Estrictamente prohibido para perros y gatos." },
      ja: { message: "N-プロピルジスルフィドを含み、赤血球を破壊して溶血性貧血を引き起こします。生・加熱・粉末すべての形態が有毒です。犬・猫ともに絶対に与えてはいけません。" },
      ko: { message: "N-프로필 디설파이드를 함유하여 적혈구를 파괴하고 용혈성 빈혈을 유발합니다. 날것, 익힌 것, 분말 모두 독성이 있습니다. 개와 고양이 모두에게 절대 금지입니다." },
    },
  },

  '大蒜': {
    name: '大蒜',
    aliases: ['garlic','garlic powder','roasted garlic','garlic clove',
              'ail','ail en poudre',
              'ajo','ajo en polvo',
              'にんにく','ガーリック',
              '마늘'],
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message:   '葱属植物，毒性是洋葱5倍。所有形态（包括大蒜粉）均有毒，猫咪尤其敏感。',
    messageEn: 'Allium plant — 5× more toxic than onion. All forms including garlic powder are toxic. Cats are especially sensitive.',
    translations: {
      fr: { message: "Plante allium, 5 fois plus toxique que l'oignon. Toutes les formes (y compris la poudre) sont toxiques. Les chats sont particulièrement sensibles." },
      es: { message: "Planta aliácea, 5 veces más tóxica que la cebolla. Todas las formas (incluido el polvo de ajo) son tóxicas. Los gatos son especialmente sensibles." },
      ja: { message: "ネギ科植物で、タマネギの5倍の毒性があります。ガーリックパウダーを含むすべての形態が有毒です。猫は特に敏感です。" },
      ko: { message: "파속 식물로 양파보다 5배 독성이 강합니다. 마늘 분말을 포함한 모든 형태가 독성이 있습니다. 고양이는 특히 민감합니다." },
    },
  },

  '韭菜': {
    name: '韭菜',
    aliases: ['leek','leeks','chinese chive','chives','scallion',
              'poireau','ciboulette',
              'puerro','cebollino',
              'ニラ','ネギ',
              '부추','파'],
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message:   '葱属植物，同洋葱/大蒜级别毒性，严格禁止。',
    messageEn: 'Allium plant with the same toxicity as onion and garlic. Strictly forbidden.',
    translations: {
      fr: { message: "Plante allium avec la même toxicité que l'oignon et l'ail. Strictement interdit." },
      es: { message: "Planta aliácea con la misma toxicidad que la cebolla y el ajo. Estrictamente prohibida." },
      ja: { message: "ネギ科植物で、タマネギ・ニンニクと同等の毒性があります。絶対に与えてはいけません。" },
      ko: { message: "파속 식물로 양파·마늘과 동등한 독성이 있습니다. 절대 금지입니다." },
    },
  },

  '葡萄': {
    name: '葡萄',
    aliases: ['grape','grapes','raisin','raisins','currant','currants','sultana','sultanas',
              'raisin','raisins sec','cassis',
              'uva','uvas','pasa','pasas',
              'ぶどう','レーズン',
              '포도','건포도'],
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message:   '可导致急性肾衰竭，即使极少量也有致死风险。葡萄干同等危险。',
    messageEn: 'Can cause acute kidney failure — even tiny amounts can be lethal. Raisins are equally dangerous.',
    translations: {
      fr: { message: "Peut provoquer une insuffisance rénale aiguë — même de très petites quantités peuvent être mortelles. Les raisins secs sont tout aussi dangereux." },
      es: { message: "Puede causar insuficiencia renal aguda — incluso cantidades mínimas pueden ser letales. Las pasas son igualmente peligrosas." },
      ja: { message: "急性腎不全を引き起こす可能性があり、ごく少量でも致命的になり得ます。レーズン（干しぶどう）も同様に危険です。" },
      ko: { message: "급성 신부전을 유발할 수 있으며 아주 적은 양으로도 치명적일 수 있습니다. 건포도도 마찬가지로 위험합니다." },
    },
  },

  '葡萄干': {
    name: '葡萄干',
    aliases: ['raisin','raisins','dried grape','dried grapes','sultana','currant',
              'raisin sec','raisins secs',
              'uva pasa','pasas',
              'レーズン','干しぶどう',
              '건포도'],
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message:   '与葡萄同等毒性，浓缩后毒性更强，严格禁止。',
    messageEn: 'Same toxicity as grapes — more concentrated and even more dangerous. Strictly forbidden.',
    translations: {
      fr: { message: "Même toxicité que les raisins frais — encore plus concentrée et donc plus dangereuse. Strictement interdit." },
      es: { message: "Misma toxicidad que las uvas — más concentrada y por lo tanto más peligrosa. Estrictamente prohibidas." },
      ja: { message: "ブドウと同じ毒性があり、凝縮されているためさらに危険です。絶対に与えてはいけません。" },
      ko: { message: "포도와 동일한 독성을 가지며, 농축되어 있어 더욱 위험합니다. 절대 금지입니다." },
    },
  },

  '巧克力': {
    name: '巧克力',
    aliases: ['chocolate','cocoa','cacao','dark chocolate','milk chocolate','white chocolate','choc',
              'chocolat','cacao',
              'chocolate','cacao',
              'チョコレート','ショコラ','カカオ',
              '초콜릿','카카오'],
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message:   '含可可碱和咖啡因，导致心律失常、癫痫甚至死亡。黑巧克力毒性最强。',
    messageEn: 'Contains theobromine and caffeine which cause cardiac arrhythmia, seizures, and death. Dark chocolate is the most toxic form.',
    translations: {
      fr: { message: "Contient de la théobromine et de la caféine provoquant des arythmies cardiaques, des convulsions et la mort. Le chocolat noir est la forme la plus toxique." },
      es: { message: "Contiene teobromina y cafeína que provocan arritmias cardíacas, convulsiones y muerte. El chocolate negro es la forma más tóxica." },
      ja: { message: "テオブロミンとカフェインを含み、不整脈、けいれん、死亡を引き起こします。ダークチョコレートが最も毒性が高い形態です。" },
      ko: { message: "테오브로민과 카페인을 함유하여 부정맥, 경련, 사망을 유발합니다. 다크초콜릿이 가장 독성이 강합니다." },
    },
  },

  '木糖醇': {
    name: '木糖醇',
    aliases: ['xylitol','birch sugar','xilitol','e967',
              'xylitol','sucre de bouleau',
              'xilitol',
              'キシリトール',
              '자일리톨'],
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message:   '常见于口香糖、某些花生酱，导致犬血糖骤降和肝衰竭，极其危险。',
    messageEn: 'Found in gum and some peanut butters. Causes severe blood sugar crash and liver failure in dogs. Extremely dangerous.',
    translations: {
      fr: { message: "Présent dans les chewing-gums et certains beurres de cacahuète. Provoque une chute de glycémie sévère et une insuffisance hépatique chez le chien. Extrêmement dangereux." },
      es: { message: "Presente en chicles y algunas mantequillas de maní. Causa una caída brusca de azúcar en sangre e insuficiencia hepática en perros. Extremadamente peligroso." },
      ja: { message: "ガムや一部のピーナッツバターに含まれています。犬の血糖値を急激に下げ、肝不全を引き起こします。非常に危険です。" },
      ko: { message: "껌과 일부 땅콩버터에 포함되어 있습니다. 개의 혈당을 급격히 떨어뜨리고 간부전을 유발합니다. 매우 위험합니다." },
    },
  },

  '牛油果': {
    name: '牛油果',
    aliases: ['avocado','avocados','aguacate',
              'avocat','avocats',
              'aguacate','palta',
              'アボカド',
              '아보카도'],
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message:   '含Persin毒素，果肉/核/皮/叶均有毒，ASPCA列明确有毒食材。',
    messageEn: 'Contains Persin toxin. Flesh, pit, skin, and leaves are all toxic. Listed as clearly toxic by ASPCA.',
    translations: {
      fr: { message: "Contient de la persine, une toxine. La chair, le noyau, la peau et les feuilles sont tous toxiques. Clairement listé comme toxique par l'ASPCA." },
      es: { message: "Contiene persina, una toxina. La pulpa, el hueso, la piel y las hojas son todos tóxicos. Claramente listado como tóxico por la ASPCA." },
      ja: { message: "ペルシンという毒素を含みます。果肉、種、皮、葉のすべてが有毒です。ASPCAが有毒食材として明確にリストアップしています。" },
      ko: { message: "퍼신(Persin) 독소를 함유합니다. 과육, 씨, 껍질, 잎 모두 독성이 있습니다. ASPCA가 명확한 독성 식품으로 등록했습니다." },
    },
  },

  '夏威夷果': {
    name: '夏威夷果',
    aliases: ['macadamia','macadamia nut','macadamia nuts','hawaii nut',
              'noix de macadamia',
              'nuez de macadamia',
              'マカダミアナッツ',
              '마카다미아'],
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message:   '导致虚弱/高温/呕吐，ASPCA列明确有毒食材，严格禁止。',
    messageEn: 'Causes weakness, high fever, and vomiting. Listed as clearly toxic by ASPCA. Strictly forbidden.',
    translations: {
      fr: { message: "Provoque faiblesse, forte fièvre et vomissements. Clairement listé comme toxique par l'ASPCA. Strictement interdit." },
      es: { message: "Provoca debilidad, fiebre alta y vómitos. Claramente listado como tóxico por la ASPCA. Estrictamente prohibida." },
      ja: { message: "脱力感、高熱、嘔吐を引き起こします。ASPCAが有毒食材として明確にリストアップしています。絶対に与えてはいけません。" },
      ko: { message: "무력감, 고열, 구토를 유발합니다. ASPCA가 명확한 독성 식품으로 등록했습니다. 절대 금지입니다." },
    },
  },

  '咖啡': {
    name: '咖啡',
    aliases: ['coffee','caffeine','espresso','tea','green tea','coffee bean','coffee grounds',
              'café','caféine','thé',
              'café','cafeína','té',
              'コーヒー','カフェイン','お茶',
              '커피','카페인','차'],
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message:   '含咖啡因，心动过速/癫痫/死亡，所有含咖啡因食物均禁止。',
    messageEn: 'Contains caffeine causing heart palpitations, seizures, and death. All caffeinated foods are forbidden.',
    translations: {
      fr: { message: "Contient de la caféine provoquant des palpitations cardiaques, des convulsions et la mort. Tous les aliments contenant de la caféine sont interdits." },
      es: { message: "Contiene cafeína que provoca palpitaciones cardíacas, convulsiones y muerte. Todos los alimentos con cafeína están prohibidos." },
      ja: { message: "カフェインを含み、動悸、けいれん、死亡を引き起こします。カフェインを含むすべての食品が禁止です。" },
      ko: { message: "카페인을 함유하여 심계항진, 경련, 사망을 유발합니다. 카페인이 함유된 모든 식품이 금지입니다." },
    },
  },

  '酒精': {
    name: '酒精',
    aliases: ['alcohol','beer','wine','liquor','ethanol','spirits','sake',
              'alcool','bière','vin',
              'alcohol','cerveza','vino',
              'アルコール','ビール','ワイン','酒',
              '알코올','맥주','와인','술'],
    level: 'danger', title: '禁止喂食', dogSafe: false, catSafe: false,
    message:   '极低剂量即可造成肝脏损害，所有形式禁止。',
    messageEn: 'Even tiny doses can cause liver damage. All forms are forbidden.',
    translations: {
      fr: { message: "Même de très petites doses peuvent causer des dommages hépatiques. Toutes les formes sont interdites." },
      es: { message: "Incluso dosis muy pequeñas pueden causar daño hepático. Todas las formas están prohibidas." },
      ja: { message: "ごく少量でも肝臓にダメージを与えます。すべての形態が禁止です。" },
      ko: { message: "극소량으로도 간 손상을 유발할 수 있습니다. 모든 형태가 금지입니다." },
    },
  },

  '食盐': {
    name: '食盐',
    aliases: ['salt','sodium','sea salt','table salt','soy sauce',
              'sel','sauce soja',
              'sal','salsa de soja',
              '塩','食塩','醤油',
              '소금','간장'],
    level: 'danger', title: '禁止添加', dogSafe: false, catSafe: false,
    message:   '过量导致钠离子中毒，所有宠物食物严格不加盐。',
    messageEn: 'Excess sodium causes sodium ion toxicity. Strictly no added salt in any pet food.',
    translations: {
      fr: { message: "Un excès provoque une intoxication aux ions sodium. Strictement pas de sel ajouté dans la nourriture pour animaux de compagnie." },
      es: { message: "El exceso provoca intoxicación por iones de sodio. Estrictamente prohibido añadir sal a la comida para mascotas." },
      ja: { message: "過剰摂取でナトリウムイオン中毒を引き起こします。すべてのペットフードへの塩の添加は絶対に禁止です。" },
      ko: { message: "과다 섭취 시 나트륨 이온 독성을 유발합니다. 모든 반려동물 음식에 소금 첨가는 절대 금지입니다." },
    },
  },

  '樱桃': {
    name: '樱桃',
    aliases: ['cherry','cherries','wild cherry','maraschino cherry',
              'cerise','cerises',
              'cereza','cerezas',
              'さくらんぼ','チェリー',
              '체리'],
    level: 'danger', title: '禁止喂食（含核）', dogSafe: false, catSafe: false,
    message:   '核/茎/叶含氰化物，建议整体避免喂食。',
    messageEn: 'Pits, stems, and leaves contain cyanide. Best to avoid feeding entirely.',
    translations: {
      fr: { message: "Les noyaux, tiges et feuilles contiennent du cyanure. Il vaut mieux éviter d'en donner entièrement." },
      es: { message: "Los huesos, tallos y hojas contienen cianuro. Es mejor evitar darlas por completo." },
      ja: { message: "種、茎、葉にシアン化物が含まれています。全体的に給与を避けることをお勧めします。" },
      ko: { message: "씨, 줄기, 잎에 시안화물이 포함되어 있습니다. 전체적으로 급여를 피하는 것이 좋습니다." },
    },
  },

  /* ─── SAFE ───────────────────────────────────────────────────────────── */

  '鸡胸肉': {
    name: '鸡胸肉',
    aliases: ['chicken','chicken breast','chicken meat','cooked chicken','boiled chicken','chicken fillet',
              'poulet','blanc de poulet','filet de poulet',
              'pollo','pechuga de pollo',
              '鶏肉','鶏胸肉','チキン',
              '닭고기','닭가슴살','치킨'],
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message:   '优质蛋白质来源，煮熟去皮去骨即可。不可调味，禁止加盐/葱/蒜。',
    messageEn: 'Excellent protein source. Cook thoroughly, remove skin and bones. No seasoning — no salt, onion, or garlic.',
    kidneyWarning:   '肾病需控制蛋白质总量，可少量食用',
    kidneyWarningEn: 'Kidney disease: control total protein intake, feed in small amounts only.',
    translations: {
      fr: {
        message: "Excellente source de protéines. Cuire complètement, retirer la peau et les os. Pas d'assaisonnement — ni sel, ni oignon, ni ail.",
        kidneyWarning: "Maladie rénale : contrôler l'apport total en protéines, ne donner qu'en petites quantités.",
      },
      es: {
        message: "Excelente fuente de proteínas. Cocinar completamente, quitar piel y huesos. Sin condimentos — sin sal, cebolla ni ajo.",
        kidneyWarning: "Enfermedad renal: controlar la ingesta total de proteínas, dar solo en pequeñas cantidades.",
      },
      ja: {
        message: "優れたタンパク質源です。完全に加熱し、皮と骨を取り除いてください。調味料は一切使わず、塩・玉ねぎ・にんにくは禁止です。",
        kidneyWarning: "腎臓病：タンパク質総量を管理し、少量のみ給与可能です。",
      },
      ko: {
        message: "훌륭한 단백질 공급원입니다. 완전히 익히고 껍질과 뼈를 제거하세요. 조미료 금지 — 소금, 양파, 마늘 금지입니다.",
        kidneyWarning: "신장 질환: 단백질 총 섭취량을 조절하고 소량만 급여하세요.",
      },
    },
  },

  '鸡腿肉': {
    name: '鸡腿肉',
    aliases: ['chicken thigh','chicken leg','chicken drumstick','dark meat chicken',
              'cuisse de poulet','pilon de poulet',
              'muslo de pollo','contramuslo',
              '鶏もも肉',
              '닭다리살','닭허벅지'],
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message:   '蛋白质来源，脂肪略高于胸肉，必须去皮去骨煮熟，不可调味。',
    messageEn: 'Good protein source, slightly more fat than breast. Must be skinned, deboned, and cooked. No seasoning.',
    pancreatitisWarning:   '脂肪较高，胰腺炎需去皮控量',
    pancreatitisWarningEn: 'Higher fat — remove skin and limit quantity for pancreatitis.',
    translations: {
      fr: {
        message: "Bonne source de protéines, légèrement plus grasse que le blanc. Doit être débarrassée de la peau, désossée et bien cuite. Pas d'assaisonnement.",
        pancreatitisWarning: "Teneur en graisses plus élevée — retirer la peau et limiter la quantité en cas de pancréatite.",
      },
      es: {
        message: "Buena fuente de proteínas, algo más grasa que la pechuga. Quitar piel, deshuesar y cocinar bien. Sin condimentos.",
        pancreatitisWarning: "Mayor contenido en grasas — quitar la piel y limitar la cantidad en pancreatitis.",
      },
      ja: {
        message: "良質なタンパク質源ですが、胸肉よりやや脂肪が多いです。必ず皮と骨を取り除き、完全に加熱してください。調味料は使用しないでください。",
        pancreatitisWarning: "脂肪が多いため、膵炎の場合は皮を取り除き量を制限してください。",
      },
      ko: {
        message: "좋은 단백질 공급원이지만 가슴살보다 지방이 약간 많습니다. 껍질과 뼈를 제거하고 완전히 익혀야 합니다. 조미료는 사용하지 마세요.",
        pancreatitisWarning: "지방 함량이 높으므로 췌장염의 경우 껍질을 제거하고 양을 제한하세요.",
      },
    },
  },

  '牛肉': {
    name: '牛肉',
    aliases: ['beef','ground beef','lean beef','minced beef','steak','hamburger',
              'boeuf','bœuf','viande de bœuf',
              'ternera','carne de res','vaca',
              '牛肉','ビーフ',
              '소고기','쇠고기','비프'],
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message:   '高蛋白铁来源，煮熟食用，不可调味，过肥部分去除。',
    messageEn: 'High protein and iron source. Cook thoroughly, remove fatty parts, and use no seasoning.',
    kidneyWarning:   '磷含量较高，肾病需限量',
    kidneyWarningEn: 'Higher phosphorus — limit quantity for kidney disease.',
    translations: {
      fr: {
        message: "Riche en protéines et en fer. Cuire complètement, retirer les parties grasses, pas d'assaisonnement.",
        kidneyWarning: "Phosphore élevé — limiter la quantité en cas de maladie rénale.",
      },
      es: {
        message: "Rico en proteínas y hierro. Cocinar completamente, retirar las partes grasas, sin condimentos.",
        kidneyWarning: "Fósforo elevado — limitar la cantidad en enfermedad renal.",
      },
      ja: {
        message: "高タンパク・鉄分が豊富です。完全に加熱し、脂肪分を取り除き、調味料は一切使用しないでください。",
        kidneyWarning: "リンが多いため、腎臓病の場合は量を制限してください。",
      },
      ko: {
        message: "고단백, 철분이 풍부합니다. 완전히 익히고 지방 부분을 제거하며 조미료는 사용하지 마세요.",
        kidneyWarning: "인 함량이 높으므로 신장 질환의 경우 양을 제한하세요.",
      },
    },
  },

  '羊肉': {
    name: '羊肉',
    aliases: ['lamb','mutton','lamb meat','lamb chop',
              'agneau','mouton',
              'cordero','carne de cordero',
              'ラム肉','マトン',
              '양고기','어린양고기'],
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message:   '适合对鸡肉/牛肉过敏的宠物，去除多余脂肪后煮熟食用。',
    messageEn: 'Good for pets allergic to chicken or beef. Remove excess fat and cook thoroughly.',
    pancreatitisWarning:   '脂肪较高，选瘦切控量',
    pancreatitisWarningEn: 'Higher fat — choose lean cuts and limit quantity for pancreatitis.',
    translations: {
      fr: {
        message: "Bon pour les animaux allergiques au poulet ou au bœuf. Retirer l'excès de graisse et bien cuire.",
        pancreatitisWarning: "Teneur en graisses plus élevée — choisir des morceaux maigres et limiter la quantité en cas de pancréatite.",
      },
      es: {
        message: "Buena opción para mascotas alérgicas al pollo o la ternera. Retirar el exceso de grasa y cocinar bien.",
        pancreatitisWarning: "Mayor contenido en grasas — elegir cortes magros y limitar la cantidad en pancreatitis.",
      },
      ja: {
        message: "鶏肉・牛肉アレルギーのペットに適しています。余分な脂肪を取り除き、完全に加熱してください。",
        pancreatitisWarning: "脂肪が多いため、膵炎の場合は赤身を選び量を制限してください。",
      },
      ko: {
        message: "닭고기나 소고기 알레르기가 있는 반려동물에게 좋습니다. 여분의 지방을 제거하고 완전히 익혀주세요.",
        pancreatitisWarning: "지방 함량이 높으므로 췌장염의 경우 살코기를 선택하고 양을 제한하세요.",
      },
    },
  },

  '兔肉': {
    name: '兔肉',
    aliases: ['rabbit','rabbit meat','bunny meat',
              'lapin','viande de lapin',
              'conejo','carne de conejo',
              'ウサギ肉','ラビット',
              '토끼고기'],
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message:   '极低脂高蛋白，低过敏原，适合食物过敏宠物，骨骼需去除。',
    messageEn: 'Very low fat, high protein, hypoallergenic. Great for food-sensitive pets. Remove all bones.',
    kidneyWarning:   '低磷低钾，肾病友好选项',
    kidneyWarningEn: 'Low phosphorus and potassium — a kidney-friendly protein option.',
    translations: {
      fr: {
        message: "Très peu de graisses, riche en protéines, hypoallergénique. Idéal pour les animaux sensibles. Retirer tous les os.",
        kidneyWarning: "Faible en phosphore et potassium — option favorable aux reins.",
      },
      es: {
        message: "Muy bajo en grasas, alto en proteínas, hipoalergénico. Ideal para mascotas con sensibilidades alimentarias. Retirar todos los huesos.",
        kidneyWarning: "Bajo en fósforo y potasio — opción favorable para los riñones.",
      },
      ja: {
        message: "極低脂肪・高タンパク・低アレルゲン。食物アレルギーのあるペットに最適です。すべての骨を取り除いてください。",
        kidneyWarning: "低リン・低カリウムで、腎臓に優しい選択肢です。",
      },
      ko: {
        message: "매우 낮은 지방, 고단백, 저알레르겐. 식품 민감성이 있는 반려동물에게 이상적입니다. 뼈를 모두 제거하세요.",
        kidneyWarning: "인과 칼륨이 낮아 신장 친화적인 단백질 선택입니다.",
      },
    },
  },

  '三文鱼': {
    name: '三文鱼',
    aliases: ['salmon','atlantic salmon','cooked salmon','smoked salmon',
              'saumon','saumon atlantique',
              'salmón','salmon',
              'サーモン','鮭','サケ',
              '연어'],
    level: 'caution', title: '慎用（需熟食）', dogSafe: true, catSafe: true,
    message:   '富含Omega-3，但必须完全煮熟！生三文鱼对狗有鲑鱼中毒风险。',
    messageEn: 'Rich in Omega-3, but must be fully cooked! Raw salmon carries salmon poisoning risk for dogs.',
    kidneyWarning:   '磷含量适中，肾病可低量食用',
    kidneyWarningEn: 'Moderate phosphorus — kidney disease pets can eat small amounts.',
    translations: {
      fr: {
        message: "Riche en Oméga-3, mais doit être entièrement cuit ! Le saumon cru présente un risque d'empoisonnement chez le chien.",
        kidneyWarning: "Phosphore modéré — les animaux malades des reins peuvent en manger en petites quantités.",
      },
      es: {
        message: "Rico en Omega-3, pero debe cocinarse completamente. El salmón crudo representa un riesgo de envenenamiento para los perros.",
        kidneyWarning: "Fósforo moderado — las mascotas con enfermedad renal pueden comer pequeñas cantidades.",
      },
      ja: {
        message: "オメガ3が豊富ですが、必ず完全に加熱してください！生のサーモンは犬にサーモン中毒のリスクがあります。",
        kidneyWarning: "リンは中程度で、腎臓病のペットは少量なら食べられます。",
      },
      ko: {
        message: "오메가3가 풍부하지만 반드시 완전히 익혀야 합니다! 생연어는 개에게 연어 중독 위험이 있습니다.",
        kidneyWarning: "인 함량이 보통 수준으로, 신장 질환 반려동물은 소량 섭취 가능합니다.",
      },
    },
  },

  '沙丁鱼': {
    name: '沙丁鱼',
    aliases: ['sardine','sardines','canned sardine',
              'sardine','sardines',
              'sardina','sardinas',
              'イワシ','サーディン',
              '정어리'],
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message:   '高Omega-3，选水浸无盐罐头，避免盐水/番茄汁罐头。',
    messageEn: 'High Omega-3. Choose water-packed unsalted canned sardines — avoid brine or tomato sauce cans.',
    kidneyWarning:   '钾/磷较高，肾病需控量',
    kidneyWarningEn: 'Higher potassium and phosphorus — limit quantity for kidney disease.',
    translations: {
      fr: {
        message: "Riche en Oméga-3. Choisir des conserves à l'eau sans sel — éviter la saumure ou la sauce tomate.",
        kidneyWarning: "Potassium et phosphore élevés — limiter les quantités en cas de maladie rénale.",
      },
      es: {
        message: "Alto en Omega-3. Elegir conservas en agua sin sal — evitar salmuera o salsa de tomate.",
        kidneyWarning: "Potasio y fósforo elevados — limitar las cantidades en enfermedad renal.",
      },
      ja: {
        message: "オメガ3が豊富です。食塩無添加の水煮缶詰を選び、塩水・トマトソース缶は避けてください。",
        kidneyWarning: "カリウムとリンが多いため、腎臓病の場合は量を制限してください。",
      },
      ko: {
        message: "오메가3가 풍부합니다. 무염 수침 통조림을 선택하고 소금물이나 토마토소스 통조림은 피하세요.",
        kidneyWarning: "칼륨과 인이 높으므로 신장 질환의 경우 양을 제한하세요.",
      },
    },
  },

  '鳕鱼': {
    name: '鳕鱼',
    aliases: ['cod','cod fish','white fish','pollock','haddock',
              'cabillaud','morue',
              'bacalao','merluza',
              'タラ','鱈','コッド',
              '대구','명태'],
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message:   '极低脂高蛋白，刺多需小心，煮熟后去刺喂食，不可调味。',
    messageEn: 'Very low fat, high protein. Many small bones — cook thoroughly and remove all bones. No seasoning.',
    kidneyWarning:   '低磷低钾，肾病友好',
    kidneyWarningEn: 'Low phosphorus and potassium — kidney-friendly.',
    translations: {
      fr: {
        message: "Très peu de graisses, riche en protéines. De nombreuses arêtes — bien cuire et retirer toutes les arêtes. Pas d'assaisonnement.",
        kidneyWarning: "Faible en phosphore et potassium — favorable aux reins.",
      },
      es: {
        message: "Muy bajo en grasas, alto en proteínas. Muchas espinas — cocinar bien y retirar todas las espinas. Sin condimentos.",
        kidneyWarning: "Bajo en fósforo y potasio — favorable para los riñones.",
      },
      ja: {
        message: "極低脂肪・高タンパクです。小骨が多いので完全に加熱し、すべての骨を取り除いてください。調味料は使用しないでください。",
        kidneyWarning: "低リン・低カリウムで、腎臓に優しい食材です。",
      },
      ko: {
        message: "매우 낮은 지방, 고단백입니다. 잔뼈가 많으므로 완전히 익히고 모든 뼈를 제거하세요. 조미료 금지입니다.",
        kidneyWarning: "인과 칼륨이 낮아 신장에 친화적입니다.",
      },
    },
  },

  '鸡蛋': {
    name: '鸡蛋',
    aliases: ['egg','eggs','chicken egg','boiled egg','scrambled egg','cooked egg',
              'œuf','oeuf','oeufs',
              'huevo','huevos',
              '卵','たまご','エッグ',
              '달걀','계란'],
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message:   '完全蛋白质来源，必须完全煮熟（生蛋白含卵白素），每周2-3个为宜。',
    messageEn: 'Complete protein source. Must be fully cooked — raw egg white contains avidin. 2–3 per week recommended.',
    kidneyWarning:   '磷含量中等，肾病需控量',
    kidneyWarningEn: 'Moderate phosphorus — limit quantity for kidney disease.',
    translations: {
      fr: {
        message: "Source complète de protéines. Doit être entièrement cuit — le blanc d'œuf cru contient de l'avidine. 2 à 3 œufs par semaine recommandés.",
        kidneyWarning: "Phosphore modéré — limiter les quantités en cas de maladie rénale.",
      },
      es: {
        message: "Fuente completa de proteínas. Debe cocinarse completamente — la clara cruda contiene avidina. Se recomiendan 2-3 huevos por semana.",
        kidneyWarning: "Fósforo moderado — limitar las cantidades en enfermedad renal.",
      },
      ja: {
        message: "完全なタンパク質源です。必ず完全に加熱してください（生の卵白にはアビジンが含まれます）。週2〜3個が目安です。",
        kidneyWarning: "リンが中程度のため、腎臓病の場合は量を制限してください。",
      },
      ko: {
        message: "완전한 단백질 공급원입니다. 반드시 완전히 익혀야 합니다(생 달걀 흰자에는 아비딘이 포함됨). 주 2~3개 권장합니다.",
        kidneyWarning: "인 함량이 보통 수준으로 신장 질환의 경우 양을 제한하세요.",
      },
    },
  },

  '鸡心': {
    name: '鸡心',
    aliases: ['chicken heart','heart','chicken hearts',
              'cœur de poulet','cœurs de poulet',
              'corazón de pollo',
              '鶏ハツ','ハート',
              '닭 심장'],
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message:   '猫必需牛磺酸来源之一，煮熟后少量喂食，建议占饮食不超过10%。',
    messageEn: 'Key taurine source for cats. Feed cooked in small amounts — no more than 10% of total diet.',
    kidneyWarning:   '磷较高，肾病需控量',
    kidneyWarningEn: 'Higher phosphorus — limit quantity for kidney disease.',
    translations: {
      fr: {
        message: "Source clé de taurine pour les chats. Donner cuit en petites quantités — pas plus de 10 % de l'alimentation totale.",
        kidneyWarning: "Phosphore élevé — limiter les quantités en cas de maladie rénale.",
      },
      es: {
        message: "Fuente clave de taurina para gatos. Dar cocido en pequeñas cantidades — no más del 10% de la dieta total.",
        kidneyWarning: "Fósforo elevado — limitar las cantidades en enfermedad renal.",
      },
      ja: {
        message: "猫にとって重要なタウリン源の一つです。加熱後少量給与し、食事全体の10%以内を目安にしてください。",
        kidneyWarning: "リンが多いため、腎臓病の場合は量を制限してください。",
      },
      ko: {
        message: "고양이의 중요한 타우린 공급원입니다. 익혀서 소량 급여하며, 전체 식사의 10% 이하로 유지하세요.",
        kidneyWarning: "인 함량이 높으므로 신장 질환의 경우 양을 제한하세요.",
      },
    },
  },

  '鸡肝': {
    name: '鸡肝',
    aliases: ['chicken liver','liver','beef liver','liver meat',
              'foie de poulet','foie',
              'hígado de pollo','hígado',
              '鶏レバー','レバー',
              '닭 간','간'],
    level: 'caution', title: '慎用（限量）', dogSafe: true, catSafe: true,
    message:   '极高维生素A，过量导致中毒。每周不超过总食量的5%，不可日常大量喂食。',
    messageEn: 'Extremely high in vitamin A — excess causes toxicity. No more than 5% of total diet per week.',
    kidneyWarning:   '磷/铜过高，肾病严格限制',
    kidneyWarningEn: 'Too high in phosphorus and copper — strictly limited for kidney disease.',
    pancreatitisWarning:   '高脂高铜，胰腺炎慎用',
    pancreatitisWarningEn: 'High fat and copper — use with great caution in pancreatitis.',
    translations: {
      fr: {
        message: "Extrêmement riche en vitamine A — l'excès provoque une intoxication. Pas plus de 5 % de l'alimentation totale par semaine.",
        kidneyWarning: "Phosphore et cuivre trop élevés — strictement limité en cas de maladie rénale.",
        pancreatitisWarning: "Riche en graisses et en cuivre — à utiliser avec grande prudence en cas de pancréatite.",
      },
      es: {
        message: "Extremadamente rico en vitamina A — el exceso provoca toxicidad. No más del 5% de la dieta total por semana.",
        kidneyWarning: "Fósforo y cobre demasiado altos — estrictamente limitado en enfermedad renal.",
        pancreatitisWarning: "Alto en grasas y cobre — usar con gran precaución en pancreatitis.",
      },
      ja: {
        message: "ビタミンAが非常に豊富で、過剰摂取は中毒を引き起こします。週に全食事量の5%以内に抑えてください。",
        kidneyWarning: "リンと銅が過剰に高く、腎臓病では厳しく制限が必要です。",
        pancreatitisWarning: "脂肪と銅が多く、膵炎では十分に注意して使用してください。",
      },
      ko: {
        message: "비타민 A가 매우 풍부하여 과다 섭취 시 독성을 유발합니다. 주당 전체 식사량의 5% 이하로 제한하세요.",
        kidneyWarning: "인과 구리 함량이 매우 높아 신장 질환에서는 엄격히 제한해야 합니다.",
        pancreatitisWarning: "지방과 구리 함량이 높아 췌장염에서는 매우 신중하게 사용하세요.",
      },
    },
  },

  '胡萝卜': {
    name: '胡萝卜',
    aliases: ['carrot','carrots','baby carrot',
              'carotte','carottes',
              'zanahoria','zanahorias',
              'にんじん','ニンジン',
              '당근'],
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message:   'β胡萝卜素丰富，低热量零食，蒸熟或少量生食均可。',
    messageEn: 'Rich in beta-carotene, low-calorie treat. Can be steamed or eaten lightly raw in small amounts.',
    translations: {
      fr: { message: "Riche en bêta-carotène, en-cas peu calorique. Peut être cuit à la vapeur ou consommé cru en petites quantités." },
      es: { message: "Rico en betacaroteno, merienda de pocas calorías. Se puede cocinar al vapor o comer crudo en pequeñas cantidades." },
      ja: { message: "β-カロテンが豊富な低カロリーのおやつです。蒸したり少量生で食べさせることも可能です。" },
      ko: { message: "베타카로틴이 풍부한 저칼로리 간식입니다. 쪄서 주거나 소량 날것으로 주어도 됩니다." },
    },
  },

  '南瓜': {
    name: '南瓜',
    aliases: ['pumpkin','squash','butternut squash','pumpkin puree',
              'courge','citrouille','potiron',
              'calabaza','zapallo',
              'かぼちゃ','パンプキン',
              '호박'],
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message:   '低磷低钾，富含纤维，有助调节肠道，煮熟去皮去籽，避免含糖罐头。',
    messageEn: 'Low phosphorus and potassium, high fiber, aids digestion. Cook and remove skin and seeds — avoid sugary canned pumpkin.',
    kidneyWarning:   '低磷低钾，肾病友好型蔬菜',
    kidneyWarningEn: 'Low phosphorus and potassium — a kidney-friendly vegetable.',
    translations: {
      fr: {
        message: "Faible en phosphore et potassium, riche en fibres, aide la digestion. Cuire et retirer la peau et les graines — éviter les conserves sucrées.",
        kidneyWarning: "Faible en phosphore et potassium — légume favorable aux reins.",
      },
      es: {
        message: "Bajo en fósforo y potasio, rico en fibra, ayuda la digestión. Cocinar y retirar piel y semillas — evitar conservas azucaradas.",
        kidneyWarning: "Bajo en fósforo y potasio — vegetal favorable para los riñones.",
      },
      ja: {
        message: "低リン・低カリウムで食物繊維が豊富、腸内環境の調整に役立ちます。加熱して皮と種を取り除き、砂糖入り缶詰は避けてください。",
        kidneyWarning: "低リン・低カリウムで腎臓に優しい野菜です。",
      },
      ko: {
        message: "저인, 저칼륨, 식이섬유가 풍부하여 소화에 도움이 됩니다. 익혀서 껍질과 씨를 제거하고, 설탕이 든 통조림은 피하세요.",
        kidneyWarning: "인과 칼륨이 낮아 신장에 친화적인 채소입니다.",
      },
    },
  },

  '甘薯': {
    name: '甘薯',
    aliases: ['sweet potato','yam','sweet potatoes','kumara',
              'patate douce',
              'batata','camote',
              'さつまいも','スイートポテト',
              '고구마'],
    level: 'caution', title: '慎用', dogSafe: true, catSafe: false,
    message:   '含草酸，煮熟去皮，不宜过量，猫咪不推荐。',
    messageEn: 'Contains oxalic acid. Cook and peel thoroughly. Not recommended for cats or in large quantities.',
    kidneyWarning:   '钾和磷含量较高，肾病需控量',
    kidneyWarningEn: 'Higher potassium and phosphorus — limit quantity for kidney disease.',
    translations: {
      fr: {
        message: "Contient de l'acide oxalique. Cuire et peler soigneusement. Pas recommandé pour les chats ni en grandes quantités.",
        kidneyWarning: "Potassium et phosphore élevés — limiter les quantités en cas de maladie rénale.",
      },
      es: {
        message: "Contiene ácido oxálico. Cocinar y pelar bien. No recomendado para gatos ni en grandes cantidades.",
        kidneyWarning: "Potasio y fósforo elevados — limitar las cantidades en enfermedad renal.",
      },
      ja: {
        message: "シュウ酸を含みます。完全に加熱して皮をむいてください。猫や過剰摂取にはお勧めしません。",
        kidneyWarning: "カリウムとリンが多いため、腎臓病の場合は量を制限してください。",
      },
      ko: {
        message: "수산이 함유되어 있습니다. 완전히 익히고 껍질을 벗겨주세요. 고양이나 과다 섭취에는 권장하지 않습니다.",
        kidneyWarning: "칼륨과 인이 높으므로 신장 질환의 경우 양을 제한하세요.",
      },
    },
  },

  '菠菜': {
    name: '菠菜',
    aliases: ['spinach','baby spinach',
              'épinard','épinards',
              'espinaca','espinacas',
              'ほうれん草','ほうれんそう',
              '시금치'],
    level: 'caution', title: '慎用', dogSafe: false, catSafe: false,
    message:   '草酸含量高，肾结石/泌尿问题宠物禁用。健康宠物极少量偶尔可用。',
    messageEn: 'High oxalate content — forbidden for pets with kidney stones or urinary issues. Healthy pets may have tiny amounts occasionally.',
    kidneyWarning:   '草酸高，肾病禁用',
    kidneyWarningEn: 'High oxalate — forbidden for kidney disease.',
    translations: {
      fr: {
        message: "Teneur élevée en oxalates — interdit aux animaux ayant des calculs rénaux ou des problèmes urinaires. Les animaux en bonne santé peuvent en avoir de très petites quantités occasionnellement.",
        kidneyWarning: "Riche en oxalates — interdit en cas de maladie rénale.",
      },
      es: {
        message: "Alto contenido de oxalatos — prohibido para mascotas con cálculos renales o problemas urinarios. Las mascotas sanas pueden tener cantidades muy pequeñas ocasionalmente.",
        kidneyWarning: "Alto en oxalatos — prohibido en enfermedad renal.",
      },
      ja: {
        message: "シュウ酸含量が高く、尿路結石・泌尿器疾患のあるペットには禁止です。健康なペットはごく少量を時々与えても問題ありません。",
        kidneyWarning: "シュウ酸が高く、腎臓病には禁止です。",
      },
      ko: {
        message: "수산 함량이 높아 신장 결석이나 비뇨기 문제가 있는 반려동물에게는 금지입니다. 건강한 반려동물은 가끔 극소량만 가능합니다.",
        kidneyWarning: "수산 함량이 높아 신장 질환에는 금지입니다.",
      },
    },
  },

  '西兰花': {
    name: '西兰花',
    aliases: ['broccoli','brocoli','broccoli floret',
              'brocoli','brocolis',
              'brócoli','brócoles',
              'ブロッコリー',
              '브로콜리'],
    level: 'caution', title: '慎用（限量）', dogSafe: true, catSafe: true,
    message:   '含异硫氰酸酯，大量摄入对犬有毒性，仅作点心不超过总食量10%。',
    messageEn: 'Contains isothiocyanates — large amounts are toxic for dogs. Use as treat only, under 10% of total diet.',
    translations: {
      fr: { message: "Contient des isothiocyanates — les grandes quantités sont toxiques pour les chiens. À utiliser uniquement comme friandise, moins de 10 % de l'alimentation totale." },
      es: { message: "Contiene isotiocianatos — las grandes cantidades son tóxicas para los perros. Usar solo como premio, menos del 10% de la dieta total." },
      ja: { message: "イソチオシアン酸塩を含み、大量摂取は犬に毒性を示します。おやつとしてのみ使用し、全食事量の10%以内に抑えてください。" },
      ko: { message: "이소티오시아네이트를 함유하여 대량 섭취 시 개에게 독성을 보입니다. 간식으로만 사용하고 전체 식사의 10% 이하로 제한하세요." },
    },
  },

  '白米': {
    name: '白米',
    aliases: ['rice','white rice','cooked rice','plain rice','jasmine rice',
              'riz','riz blanc',
              'arroz','arroz blanco',
              '白米','お米','ごはん',
              '쌀','흰쌀','밥'],
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message:   '易消化碳水来源，腹泻恢复期推荐，需完全煮熟，不宜作主食长期依赖。',
    messageEn: 'Easily digestible carbohydrate — recommended for diarrhea recovery. Must be fully cooked. Not suitable as the sole staple long-term.',
    kidneyWarning:   '低磷低钾，肾病相对安全',
    kidneyWarningEn: 'Low phosphorus and potassium — relatively safe for kidney disease.',
    translations: {
      fr: {
        message: "Glucide facilement digestible — recommandé en cas de diarrhée. Doit être entièrement cuit. Ne pas utiliser comme seul aliment à long terme.",
        kidneyWarning: "Faible en phosphore et potassium — relativement sûr pour la maladie rénale.",
      },
      es: {
        message: "Carbohidrato de fácil digestión — recomendado durante la recuperación de diarrea. Debe cocinarse completamente. No como único alimento a largo plazo.",
        kidneyWarning: "Bajo en fósforo y potasio — relativamente seguro en enfermedad renal.",
      },
      ja: {
        message: "消化しやすい炭水化物で、下痢回復期に推奨されます。完全に炊き、主食として長期依存するのは避けてください。",
        kidneyWarning: "低リン・低カリウムで、腎臓病には比較的安全です。",
      },
      ko: {
        message: "소화하기 쉬운 탄수화물로, 설사 회복기에 권장됩니다. 완전히 익혀야 하며 장기간 주식으로만 사용하는 것은 피하세요.",
        kidneyWarning: "인과 칼륨이 낮아 신장 질환에 비교적 안전합니다.",
      },
    },
  },

  '燕麦': {
    name: '燕麦',
    aliases: ['oat','oats','oatmeal','rolled oats','porridge',
              'avoine','flocons davoine',
              'avena','copos de avena',
              'オーツ','オートミール',
              '귀리','오트밀'],
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message:   '可溶性纤维，煮熟无调味无糖无奶，调节血糖和胆固醇。',
    messageEn: 'Soluble fiber. Cook without seasoning, sugar, or milk. Helps regulate blood sugar and cholesterol.',
    kidneyWarning:   '磷含量中等，肾病需控量',
    kidneyWarningEn: 'Moderate phosphorus — limit quantity for kidney disease.',
    translations: {
      fr: {
        message: "Fibres solubles. Cuire sans assaisonnement, sucre ni lait. Aide à réguler la glycémie et le cholestérol.",
        kidneyWarning: "Phosphore modéré — limiter les quantités en cas de maladie rénale.",
      },
      es: {
        message: "Fibra soluble. Cocinar sin condimentos, azúcar ni leche. Ayuda a regular el azúcar en sangre y el colesterol.",
        kidneyWarning: "Fósforo moderado — limitar las cantidades en enfermedad renal.",
      },
      ja: {
        message: "水溶性食物繊維です。調味料、砂糖、牛乳なしで加熱してください。血糖値とコレステロールの調整に役立ちます。",
        kidneyWarning: "リンが中程度のため、腎臓病の場合は量を制限してください。",
      },
      ko: {
        message: "수용성 식이섬유입니다. 조미료, 설탕, 우유 없이 조리하세요. 혈당과 콜레스테롤 조절에 도움이 됩니다.",
        kidneyWarning: "인 함량이 보통 수준으로 신장 질환의 경우 양을 제한하세요.",
      },
    },
  },

  '蓝莓': {
    name: '蓝莓',
    aliases: ['blueberry','blueberries','wild blueberry',
              'myrtille','myrtilles','bleuet',
              'arándano','arándanos',
              'ブルーベリー',
              '블루베리'],
    level: 'safe', title: '安全可喂食', dogSafe: true, catSafe: true,
    message:   '天然抗氧化剂，少量作零食，勿过量（高糖）。',
    messageEn: 'Natural antioxidant. Use as a small treat — do not overfeed (high sugar content).',
    translations: {
      fr: { message: "Antioxydant naturel. À utiliser comme petite friandise — ne pas trop en donner (teneur élevée en sucre)." },
      es: { message: "Antioxidante natural. Usar como pequeño premio — no dar en exceso (alto contenido de azúcar)." },
      ja: { message: "天然の抗酸化剤です。少量のおやつとして使用し、食べすぎに注意してください（糖分が高い）。" },
      ko: { message: "천연 항산화제입니다. 소량의 간식으로 사용하고 과다 급여하지 마세요(당분이 높음)." },
    },
  },

  '苹果': {
    name: '苹果',
    aliases: ['apple','apples','green apple','red apple',
              'pomme','pommes',
              'manzana','manzanas',
              'りんご','リンゴ',
              '사과'],
    level: 'caution', title: '慎用（去核去籽）', dogSafe: true, catSafe: true,
    message:   '苹果籽含氰化物，必须彻底去核去籽，果皮清洗干净再喂食。',
    messageEn: 'Apple seeds contain cyanide — thoroughly remove core and all seeds. Wash skin carefully before feeding.',
    translations: {
      fr: { message: "Les pépins de pomme contiennent du cyanure — retirer soigneusement le cœur et tous les pépins. Bien laver la peau avant de donner." },
      es: { message: "Las semillas de manzana contienen cianuro — retirar completamente el corazón y todas las semillas. Lavar bien la piel antes de dar." },
      ja: { message: "リンゴの種にはシアン化物が含まれます。芯と種をすべて取り除き、皮をよく洗ってから与えてください。" },
      ko: { message: "사과씨에는 시안화물이 포함되어 있습니다. 심지와 씨를 완전히 제거하고 껍질을 깨끗이 씻어서 주세요." },
    },
  },

  '香蕉': {
    name: '香蕉',
    aliases: ['banana','bananas','plantain',
              'banane','bananes',
              'plátano','banana','banano',
              'バナナ',
              '바나나'],
    level: 'caution', title: '慎用', dogSafe: true, catSafe: false,
    message:   '钾含量高，肾病宠物严格限制，糖尿病/肥胖宠物禁用，猫不推荐。',
    messageEn: 'High potassium — strictly limited for kidney disease. Forbidden for diabetic or obese pets. Not recommended for cats.',
    kidneyWarning:   '钾含量高，肾病禁忌',
    kidneyWarningEn: 'High potassium — contraindicated for kidney disease.',
    translations: {
      fr: {
        message: "Potassium élevé — strictement limité pour les animaux malades des reins. Interdit aux animaux diabétiques ou obèses. Pas recommandé pour les chats.",
        kidneyWarning: "Potassium élevé — contre-indiqué en cas de maladie rénale.",
      },
      es: {
        message: "Potasio alto — estrictamente limitado para mascotas con enfermedad renal. Prohibido para mascotas diabéticas u obesas. No recomendado para gatos.",
        kidneyWarning: "Potasio alto — contraindicado en enfermedad renal.",
      },
      ja: {
        message: "カリウムが高く、腎臓病のペットには厳しく制限が必要です。糖尿病・肥満のペットには禁止。猫にはお勧めしません。",
        kidneyWarning: "カリウムが高く、腎臓病には禁忌です。",
      },
      ko: {
        message: "칼륨이 높아 신장 질환 반려동물에게는 엄격히 제한해야 합니다. 당뇨병이나 비만 반려동물에게는 금지. 고양이에게는 권장하지 않습니다.",
        kidneyWarning: "칼륨이 높아 신장 질환에는 금기입니다.",
      },
    },
  },

  '西瓜': {
    name: '西瓜',
    aliases: ['watermelon','seedless watermelon',
              'pastèque',
              'sandía','melón de agua',
              'スイカ','すいか',
              '수박'],
    level: 'caution', title: '慎用（去皮去籽）', dogSafe: true, catSafe: true,
    message:   '补水零食，必须去皮去籽，钾含量较高肾病需控量。',
    messageEn: 'Hydrating treat. Must remove rind and all seeds. Higher potassium — kidney disease pets should limit intake.',
    kidneyWarning:   '钾含量较高，肾病需控量',
    kidneyWarningEn: 'Higher potassium — limit quantity for kidney disease.',
    translations: {
      fr: {
        message: "En-cas hydratant. Retirer impérativement la croûte et tous les pépins. Le potassium est assez élevé — les animaux malades des reins doivent limiter la consommation.",
        kidneyWarning: "Potassium assez élevé — limiter les quantités en cas de maladie rénale.",
      },
      es: {
        message: "Merienda hidratante. Retirar la corteza y todas las semillas. El potasio es bastante alto — las mascotas con enfermedad renal deben limitar el consumo.",
        kidneyWarning: "Potasio bastante alto — limitar las cantidades en enfermedad renal.",
      },
      ja: {
        message: "水分補給のおやつです。必ず皮と種を取り除いてください。カリウムが比較的高いため、腎臓病のペットは摂取量を制限してください。",
        kidneyWarning: "カリウムが比較的高く、腎臓病の場合は量を制限してください。",
      },
      ko: {
        message: "수분 보충 간식입니다. 껍질과 씨를 반드시 제거하세요. 칼륨이 비교적 높으므로 신장 질환 반려동물은 섭취량을 제한하세요.",
        kidneyWarning: "칼륨이 비교적 높으므로 신장 질환의 경우 양을 제한하세요.",
      },
    },
  },

  '鱼油': {
    name: '鱼油',
    aliases: ['fish oil','omega-3','omega 3','fish oil supplement',
              'huile de poisson','oméga-3',
              'aceite de pescado','omega-3',
              'フィッシュオイル','魚油','オメガ3',
              '생선 기름','어유','오메가3'],
    level: 'safe', title: '安全（控量）', dogSafe: true, catSafe: true,
    message:   'EPA/DHA来源，剂量严格按体重计算，过量导致腹泻，购买宠物专用级别。',
    messageEn: 'EPA/DHA source. Dose strictly by weight — excess causes diarrhea. Use pet-grade products only.',
    translations: {
      fr: { message: "Source d'EPA/DHA. Doser strictement selon le poids — l'excès provoque des diarrhées. Utiliser des produits de qualité vétérinaire." },
      es: { message: "Fuente de EPA/DHA. Dosificar estrictamente según el peso — el exceso provoca diarrea. Usar productos de grado veterinario." },
      ja: { message: "EPA/DHAの供給源です。体重に応じて厳密に量を計算してください。過剰摂取で下痢になります。ペット用製品を使用してください。" },
      ko: { message: "EPA/DHA 공급원입니다. 체중에 따라 엄격히 용량을 계산하세요. 과다 섭취 시 설사가 발생합니다. 반려동물용 제품을 사용하세요." },
    },
  },

  '橄榄油': {
    name: '橄榄油',
    aliases: ['olive oil','extra virgin olive oil','evoo',
              "huile d'olive",'huile dolive',
              'aceite de oliva',
              'オリーブオイル','オリーブ油',
              '올리브 오일','올리브유'],
    level: 'caution', title: '慎用（少量）', dogSafe: true, catSafe: true,
    message:   '少量润滑肠道，过量导致腹泻。',
    messageEn: 'Small amounts help lubricate digestion — excess causes diarrhea.',
    pancreatitisWarning:   '高脂肪，胰腺炎禁止',
    pancreatitisWarningEn: 'High fat — forbidden for pancreatitis.',
    translations: {
      fr: {
        message: "Les petites quantités facilitent la digestion — l'excès provoque des diarrhées.",
        pancreatitisWarning: "Haute teneur en graisses — interdit en cas de pancréatite.",
      },
      es: {
        message: "Las pequeñas cantidades ayudan a la digestión — el exceso provoca diarrea.",
        pancreatitisWarning: "Alto en grasas — prohibido en pancreatitis.",
      },
      ja: {
        message: "少量は消化を助けますが、過剰摂取で下痢になります。",
        pancreatitisWarning: "脂肪が多く、膵炎には禁止です。",
      },
      ko: {
        message: "소량은 소화를 돕지만 과다 섭취 시 설사가 발생합니다.",
        pancreatitisWarning: "지방 함량이 높아 췌장염에는 금지입니다.",
      },
    },
  },
}

/* ─── Search ─────────────────────────────────────────────────────────────── */

export function searchIngredient(query: string): IngredientSafety | null {
  const q = query.trim().toLowerCase()
  if (!q) return null

  if (SAFETY_DB[q]) return SAFETY_DB[q]

  for (const entry of Object.values(SAFETY_DB)) {
    if (entry.name.toLowerCase() === q) return entry
    if (entry.aliases.some(a => a.toLowerCase() === q)) return entry
  }
  for (const entry of Object.values(SAFETY_DB)) {
    if (entry.name.toLowerCase().includes(q) || q.includes(entry.name.toLowerCase())) return entry
    if (entry.aliases.some(a => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()))) return entry
  }
  return null
}

/* ─── Localized result (zero API calls) ─────────────────────────────────── */

export function getSafetyResult(query: string, locale: string): (IngredientSafety & { level: string }) | { level: 'unknown' } {
  const entry = searchIngredient(query)
  if (!entry) return { level: 'unknown' }

  if (locale === 'zh') return entry

  const t = entry.translations?.[locale as 'fr' | 'es' | 'ja' | 'ko']

  return {
    ...entry,
    message:             t?.message             ?? entry.messageEn             ?? entry.message,
    kidneyWarning:       t?.kidneyWarning        ?? entry.kidneyWarningEn       ?? entry.kidneyWarning,
    pancreatitisWarning: t?.pancreatitisWarning  ?? entry.pancreatitisWarningEn ?? entry.pancreatitisWarning,
  }
}
