/**
 * Per-condition dietary guidance injected into the Pro AI prompt.
 * Returns an English string (prompt language) or empty string for healthy pets.
 */
export function buildConditionGuidance(
  condition: string,
  species: 'dog' | 'cat',
): string {
  switch (condition) {
    case 'kidney':
      if (species === 'cat') {
        return `KIDNEY DISEASE DIETARY REQUIREMENTS (CAT):
- Use low-phosphorus ingredients. Target: phosphorus <1350 mg/1000kcal.
- Avoid high-phosphorus foods: dairy, fish bones, legumes, organ meats in large amounts.
- Sardines/anchovies: use sparingly (≤20g) due to high phosphorus from bones.
- CRITICAL — protein selection: Cats require >65% of calories from protein. Very lean proteins are paradoxically HIGH in phosphorus per 1000kcal because their low fat means more protein-per-calorie, which brings more phosphorus. AVOID as primary protein: rabbit, venison, cod, white fish, chicken breast, turkey breast — these all exceed 1350 mg phosphorus/1000kcal at cat protein ratios. USE instead (all stay under the limit): duck, lamb, beef, salmon, chicken thigh, pork loin, mackerel (boneless) — rotate widely for variety.
- Do NOT restrict protein excessively — risk of muscle wasting.
- Reference: Cline 2016 (ACVN); IRIS CKD Treatment Recommendations 2023`
      }
      return `KIDNEY DISEASE DIETARY REQUIREMENTS (DOG):
- Use low-phosphorus ingredients. Target: phosphorus <1200 mg/1000kcal.
- Avoid high-phosphorus foods: dairy, fish bones, legumes, organ meats in large amounts.
- Sardines/anchovies: use sparingly (≤20g) due to high phosphorus from bones.
- Omega-3 (EPA+DHA) is beneficial for kidney health — a small amount of fatty fish or fish oil is a useful option but not required every recipe.
- Include vegetables and moderate carbs — they add calories with minimal phosphorus, lowering the per-1000kcal phosphorus. Vary protein sources across recipes.
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
- Protein selection: AVOID only the fattiest proteins — duck and pork belly provide only ~56g protein/1000kcal, far below the ≥100g target. All other proteins work well: rabbit, chicken (breast or thigh), turkey, venison, quail, beef, cod, white fish — rotate widely for variety.
- Rotate protein sources across recipes for variety. No plant protein sources.
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
      return ''
  }
}
