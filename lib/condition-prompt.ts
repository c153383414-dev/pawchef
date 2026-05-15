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
      return `KIDNEY DISEASE DIETARY REQUIREMENTS:
- Use low-phosphorus ingredients. Target: phosphorus <1200 mg/1000kcal (dogs) / <1350 mg/1000kcal (cats).
- Avoid high-phosphorus foods: dairy, fish bones, legumes, organ meats in large amounts.
- Sardines/anchovies: use sparingly (≤20g) due to high phosphorus from bones.
- Omega-3 (EPA+DHA) is beneficial for kidney health — include fatty fish or fish oil in small amounts.
- Do NOT restrict protein excessively for cats — risk of muscle wasting.
- Reference: Cline 2016 (ACVN); IRIS CKD Treatment Recommendations 2023`

    case 'pancreatitis':
      if (species === 'cat') {
        return `PANCREATITIS DIETARY REQUIREMENTS (CAT):
- Do NOT restrict fat for cats with pancreatitis — no scientific evidence supports fat restriction in cats.
- Focus on caloric density to prevent weight loss.
- High-quality protein is essential. Include taurine-rich foods.
- Reference: Forman et al, ACVIM Consensus Statement, JVIM 2021`
      }
      return `PANCREATITIS DIETARY REQUIREMENTS (DOG):
- Keep fat LOW. Target: fat <35g/1000kcal (approx. <15% dry matter).
- Avoid fatty meats (duck, salmon, lamb), added oils, and high-fat organs.
- Preferred proteins: chicken breast, turkey breast, cod, rabbit (very lean).
- Include easily digestible carbohydrates and moderate fiber.
- Reference: Kathrani A, JAVMA 2024 (expert opinion)`

    case 'diabetes':
      if (species === 'cat') {
        return `DIABETES DIETARY REQUIREMENTS (CAT):
- MINIMIZE carbohydrates. Target: <12% of metabolizable energy = <30g carbs/1000kcal.
- HIGH PROTEIN diet. Target: ≥40% of ME from protein = ≥100g protein/1000kcal.
- Avoid grains, starchy vegetables, legumes entirely.
- Cat-safe proteins: chicken, turkey, rabbit, beef, fish. No plant protein sources.
- Reference: AAHA Diabetes Management Guidelines 2018/2022`
      }
      return `DIABETES DIETARY REQUIREMENTS (DOG):
- Include HIGH FIBER ingredients: both soluble fiber (vegetables, sweet potato in small amounts) and insoluble fiber (green beans, broccoli, zucchini).
- Avoid simple sugars and high-glycemic carbohydrates.
- Consistent portion size is critical — do not vary ingredient amounts significantly.
- Maintain adequate protein. No specific carbohydrate target — fiber content matters most.
- Reference: AAHA Diabetes Management Guidelines 2018/2022`

    case 'obesity':
      return `WEIGHT MANAGEMENT DIETARY REQUIREMENTS:
- Calories are already reduced to 80% of maintenance (AAHA 2021 guideline).
- HIGH PROTEIN to preserve lean muscle mass during weight loss.
- HIGH FIBER (insoluble) to increase satiety without adding calories: broccoli, green beans, zucchini.
- AVOID high-calorie additions: oils, fatty meats, starchy vegetables.
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
