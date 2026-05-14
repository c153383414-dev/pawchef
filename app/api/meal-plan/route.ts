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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { species, petName, weight, age, healthConditions } = await req.json()
    if (!species) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 })
    }

    // Deduct 3 AI credits
    const { data: deductResult, error: deductError } = await supabase
      .rpc('deduct_ai_credits', { p_user_id: user.id, p_cost: 3 })

    if (deductError) {
      console.error('deduct_ai_credits error:', deductError)
      return NextResponse.json({ error: '系统错误，请稍后重试' }, { status: 500 })
    }

    if (!deductResult?.ok) {
      return NextResponse.json({
        error: '次数或积分不足',
        detail: 'AI积分不足（需要3个），请购买积分包或订阅Pro会员'
      }, { status: 402 })
    }

    const creditSource = deductResult?.source
    const speciesName = species === 'dog' ? '狗' : '猫'
    const weightVal = weight || 5
    const ageDesc = age || '成年'
    const conditions = Array.isArray(healthConditions) && healthConditions.length
      ? healthConditions.join('、')
      : '健康'

    const isKidney = healthConditions?.includes('肾病') || healthConditions?.includes('kidney')
    const isPancreatitis = healthConditions?.includes('胰腺炎') || healthConditions?.includes('pancreatitis')
    const isDiabetes = healthConditions?.includes('糖尿病') || healthConditions?.includes('diabetes')

    const prompt = `你是一位专业宠物营养师，严格遵循AAFCO、ASPCA、FEDIAF国际标准。

为以下宠物生成一份完整的7天膳食计划：
- 种类：${speciesName}
- 名字：${petName || '宠物'}
- 体重：${weightVal}kg
- 年龄：${ageDesc}
- 健康状况：${conditions}

要求：
- 7天内蛋白质来源至少4种（鸡肉、鱼、牛肉、火鸡等轮换）
- 每天2餐（早餐+晚餐）
- 根据${weightVal}kg体重精确计算每餐份量
- 绝对禁止：洋葱、大蒜、葡萄、葡萄干、巧克力、木糖醇、牛油果、夏威夷果、咖啡因、酒精、韭菜
- 不加盐/调味料/香料
- 所有肉类完全煮熟
${isKidney ? '- 肾病：低磷低钾，限制蛋白质，使用兔肉或鳕鱼' : ''}
${isPancreatitis ? '- 胰腺炎：极低脂肪，去皮鸡胸肉或鳕鱼' : ''}
${isDiabetes ? '- 糖尿病：低碳水高蛋白，避免淀粉' : ''}

同时生成汇总购物清单（按蛋白质/蔬菜/谷物/补充剂分类）。

只返回JSON，不要任何其他文字：
{
  "petName": "${petName || '宠物'}",
  "days": [
    {
      "day": 1,
      "dayName": "周一",
      "meals": [
        {
          "mealType": "breakfast",
          "title": "餐食名称",
          "ingredients": [{"emoji":"🍗","name":"食材名","amount":"XXg"}],
          "calories": "约XXX kcal"
        },
        {
          "mealType": "dinner",
          "title": "餐食名称",
          "ingredients": [{"emoji":"🐟","name":"食材名","amount":"XXg"}],
          "calories": "约XXX kcal"
        }
      ],
      "dailyCalories": "约XXX kcal"
    }
  ],
  "shoppingList": {
    "proteins": [{"item":"食材名","totalAmount":"XXXg","emoji":"🍗"}],
    "vegetables": [{"item":"食材名","totalAmount":"XXXg","emoji":"🥕"}],
    "grains": [{"item":"食材名","totalAmount":"XXXg","emoji":"🌾"}],
    "supplements": [{"item":"食材名","totalAmount":"XXXg","emoji":"💊"}]
  },
  "weeklyNutrition": {
    "avgDailyCalories": "约XXX kcal",
    "proteinSources": ["蛋白质1", "蛋白质2"],
    "standard": "参照AAFCO成年${speciesName}营养标准"
  }
}`

    let plan: any
    try {
      const completion = await openai.chat.completions.create({
        model: 'google/gemini-3.1-flash-lite',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.7,
        thinking_config: { include_thoughts: false },
        response_format: { type: 'json_object' },
      } as any)

      const text = completion.choices[0]?.message?.content || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('AI返回格式错误')
      plan = JSON.parse(jsonMatch[0])

    } catch (aiError) {
      console.error('AI meal-plan failed, refunding:', aiError)
      await supabase.rpc('refund_ai_credit', {
        p_user_id: user.id,
        p_source: creditSource,
        p_cost: 3
      })
      return NextResponse.json({ error: 'AI生成失败，积分已退还' }, { status: 500 })
    }

    // Save to meal_plans table (if it exists — graceful failure)
    await supabase.from('meal_plans').insert({
      user_id: user.id,
      pet_name: petName || '宠物',
      species,
      plan_data: plan,
      shopping_list: plan.shoppingList
    }).then(() => {/* saved */}, () => {/* table may not exist yet */})

    await supabase.from('point_transactions').insert({
      user_id: user.id,
      amount: -3,
      type: 'meal_plan',
      description: `7天膳食计划：${petName || '宠物'}（来源：${creditSource}）`
    })

    return NextResponse.json(plan)

  } catch (e: any) {
    console.error('meal-plan error:', e)
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 })
  }
}
