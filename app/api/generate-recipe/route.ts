import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import OpenAI from 'openai'

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL,
    'X-Title': 'PawChef'
  }
})

const LANGUAGE_MAP: Record<string, string> = {
  'en': 'English',
  'zh': 'Chinese (Simplified)',
  'es': 'Spanish',
  'fr': 'French',
  'ja': 'Japanese',
  'ko': 'Korean',
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // 1. 验证登录
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Please login first' }, { status: 401 })
    }

    // 2. 解析请求参数（locale 决定返回语言）
    const { species, petName, weight, age, healthConditions, locale } = await req.json()
    const language = LANGUAGE_MAP[locale] || 'English'

    // 3. 原子扣减积分（调用数据库函数，防并发）
    const { data: deductResult, error: deductError } = await supabase
      .rpc('deduct_ai_credits', {
        p_user_id: user.id,
        p_cost: 1
      })

    if (deductError) {
      console.error('deduct_ai_credits error:', deductError)
      return NextResponse.json({ error: 'System error, please retry later' }, { status: 500 })
    }

    if (!deductResult?.ok) {
      const reason = deductResult?.reason
      if (reason === 'insufficient_credits') {
        return NextResponse.json({
          error: 'Insufficient credits',
          detail: 'AI credits insufficient. Please purchase a credits pack or subscribe to Pro.',
          gift_ai_points: deductResult?.gift_ai_points ?? 0,
          paid_points: deductResult?.paid_points ?? 0
        }, { status: 402 })
      }
      return NextResponse.json({ error: 'Cannot use AI features' }, { status: 403 })
    }

    // 4. 扣减成功，记录来源（health conditions now use English keys）
    const creditSource = deductResult?.source
    const isKidney       = healthConditions?.includes('kidney')
    const isPancreatitis = healthConditions?.includes('pancreatitis')
    const isDiabetes     = healthConditions?.includes('diabetes')
    const isObese        = healthConditions?.includes('obesity')
    const speciesName    = species === 'dog' ? 'dog' : 'cat'

    // 5. 构建多语言 AI Prompt
    const prompt = `You are a professional pet nutritionist strictly following AAFCO, ASPCA, and FEDIAF international standards.

Generate a complete homemade pet food recipe for:
- Species: ${speciesName}
- Name: ${petName || 'Pet'}
- Weight: ${weight || 5}kg
- Age: ${age || 'adult'}
- Health conditions: ${healthConditions?.join(', ') || 'healthy'}

Strict requirements:
1. NEVER use: onion, garlic, grapes, raisins, chocolate, xylitol, avocado, macadamia nuts, caffeine, alcohol, chives
2. NO salt, seasoning, or spices whatsoever
3. All meat must be thoroughly cooked
4. This is nutritional reference only, not medical advice
${isKidney       ? '5. Kidney disease mode: low phosphorus, low potassium, restricted protein, use rabbit or cod, avoid organ meats' : ''}
${isPancreatitis ? '5. Pancreatitis mode: very low fat, use skinless chicken breast or cod, avoid any high-fat ingredients' : ''}
${isDiabetes     ? '5. Diabetes mode: low carbohydrate, high protein, avoid starchy foods' : ''}
${isObese        ? '5. Weight loss mode: low calorie, high fiber, controlled fat, reduced carbs' : ''}

Calculate precise daily portions based on ${weight || 5}kg body weight.

IMPORTANT: All text values in the JSON MUST be written in ${language}. This includes the recipe title, all ingredient names, all step descriptions, all warnings, and all notes.

Return ONLY valid JSON, no other text:
{
  "title": "Recipe name in ${language} (include pet name if provided)",
  "content": {
    "ingredients": [
      {"emoji": "🍗", "name": "ingredient name in ${language}", "amount": "XXg"}
    ],
    "steps": ["step 1 in ${language}", "step 2 in ${language}", "step 3 in ${language}", "step 4 in ${language}"],
    "warnings": ["warning in ${language} if health conditions present, else empty array"],
    "notes": "brief notes in ${language}"
  },
  "nutrition": {
    "calories": "~XXX kcal",
    "protein": "XXg",
    "fat": "XXg",
    "carbs": "XXg",
    "standard": "AAFCO compliant"
  }
}`

    // 6. 调用 AI
    let recipe: any
    try {
      const completion = await openai.chat.completions.create({
        model: 'anthropic/claude-sonnet-4-5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.7,
      })

      const text = completion.choices[0]?.message?.content || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('AI response format error')
      recipe = JSON.parse(jsonMatch[0])

    } catch (aiError) {
      console.error('AI call failed, refunding credit:', aiError)
      await supabase.rpc('refund_ai_credit', {
        p_user_id: user.id,
        p_source: creditSource,
        p_cost: 1
      })
      return NextResponse.json({ error: 'AI generation failed, please retry. Credits refunded.' }, { status: 500 })
    }

    // 7. 保存食谱记录
    await supabase.from('recipes').insert({
      user_id: user.id,
      title: recipe.title,
      content: recipe.content,
      nutrition: recipe.nutrition
    })

    // 8. 记录积分流水
    await supabase.from('point_transactions').insert({
      user_id: user.id,
      amount: -1,
      type: 'generate_recipe',
      description: `Generate recipe: ${recipe.title} (source: ${creditSource})`
    })

    return NextResponse.json(recipe)

  } catch (e: any) {
    console.error('generate-recipe error:', e)
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}
