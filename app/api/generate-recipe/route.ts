import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import OpenAI from 'openai'

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: { 'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL, 'X-Title': 'PawChef' }
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: '用户不存在' }, { status: 404 })

    // Check daily limit for free users
    if (!profile.is_pro) {
      if (profile.points < 10) return NextResponse.json({ error: '积分不足（需10积分），请购买积分包' }, { status: 402 })
    }

    const { species, petName, weight, age, healthConditions } = await req.json()
    const isKidney = healthConditions?.includes('肾病')
    const isPancreatitis = healthConditions?.includes('胰腺炎')
    const isDiabetes = healthConditions?.includes('糖尿病')
    const isObese = healthConditions?.includes('肥胖')

    const prompt = `你是一位专业宠物营养师，严格遵循AAFCO、ASPCA、FEDIAF国际标准。

请为以下宠物生成一份完整的自制食谱：
- 种类：${species === 'dog' ? '狗' : '猫'}
- 名字：${petName}
- 体重：${weight}kg
- 年龄：${age}
- 健康状况：${healthConditions?.join('、') || '健康'}

要求：
1. 严格禁止使用：洋葱、大蒜、葡萄、葡萄干、巧克力、木糖醇、牛油果、夏威夷果、咖啡因、酒精
2. 完全不加盐/调味料
3. ${isKidney ? '肾病配方：低磷低钾，限制蛋白质总量，使用兔肉或鳕鱼等低磷蛋白质' : ''}
4. ${isPancreatitis ? '胰腺炎配方：极低脂肪，使用去皮鸡胸肉或鳕鱼' : ''}
5. ${isDiabetes ? '糖尿病配方：低碳水化合物，高蛋白' : ''}
6. ${isObese ? '减重配方：低热量，高纤维，控制脂肪' : ''}
7. 所有肉类必须完全煮熟
8. 根据${weight}kg体重精确计算用量

请以JSON格式回复，格式如下：
{
  "title": "食谱名称",
  "content": {
    "ingredients": [
      {"emoji": "🍗", "name": "食材名", "amount": "用量（如120g）"}
    ],
    "steps": ["步骤1", "步骤2", "步骤3", "步骤4"],
    "warnings": ["注意事项（如有）"],
    "notes": "备注（可选）"
  },
  "nutrition": {
    "calories": "约XXX kcal",
    "protein": "XXg",
    "fat": "XXg",
    "carbs": "XXg",
    "standard": "符合AAFCO成年${species === 'dog' ? '犬' : '猫'}营养标准"
  }
}`

    const completion = await openai.chat.completions.create({
      model: 'anthropic/claude-sonnet-4-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.7,
    })

    const text = completion.choices[0]?.message?.content || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: '生成失败，请重试' }, { status: 500 })

    const recipe = JSON.parse(jsonMatch[0])

    // Deduct points and save recipe
    if (!profile.is_pro) {
      await supabase.from('profiles').update({ points: profile.points - 10 }).eq('id', user.id)
      await supabase.from('point_transactions').insert({ user_id: user.id, amount: -10, type: 'generate_recipe', description: `生成食谱：${recipe.title}` })
    }
    await supabase.from('recipes').insert({ user_id: user.id, title: recipe.title, content: recipe.content, nutrition: recipe.nutrition })

    return NextResponse.json(recipe)
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 })
  }
}
