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
 
// 月付次数上限
const MONTHLY_LIMIT_MONTHLY = 30
// 年付次数上限（通过 pro_plan 字段区分，暂用60）
const MONTHLY_LIMIT_ANNUAL = 60
 
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
 
    // 1. 验证登录
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }
 
    // 2. 解析请求参数
    const { species, petName, weight, age, healthConditions } = await req.json()
 
    // 3. 原子扣减积分（调用数据库函数，防并发）
    const { data: deductResult, error: deductError } = await supabase
      .rpc('deduct_ai_credits', {
        p_user_id: user.id,
        p_cost: 1
      })
 
    if (deductError) {
      console.error('deduct_ai_credits error:', deductError)
      return NextResponse.json({ error: '系统错误，请稍后重试' }, { status: 500 })
    }
 
    if (!deductResult?.ok) {
      const reason = deductResult?.reason
      if (reason === 'insufficient_credits') {
        return NextResponse.json({
          error: '次数或积分不足',
          detail: 'AI积分不足，请购买积分包或订阅Pro会员',
          gift_ai_points: deductResult?.gift_ai_points ?? 0,
          paid_points: deductResult?.paid_points ?? 0
        }, { status: 402 })
      }
      return NextResponse.json({ error: '无法使用AI功能' }, { status: 403 })
    }
 
    // 4. 扣减成功，记录来源
    const creditSource = deductResult?.source // 'member_quota' | 'gift_credits' | 'paid_credits'
 
    // 5. 构建 AI Prompt
    const isKidney = healthConditions?.includes('肾病')
    const isPancreatitis = healthConditions?.includes('胰腺炎')
    const isDiabetes = healthConditions?.includes('糖尿病')
    const isObese = healthConditions?.includes('肥胖')
    const isHealthy = healthConditions?.includes('健康') || !healthConditions?.length
 
    const prompt = `你是一位专业宠物营养师，严格遵循AAFCO、ASPCA、FEDIAF国际标准。
 
请为以下宠物生成一份完整的自制食谱：
- 种类：${species === 'dog' ? '狗' : '猫'}
- 名字：${petName || '宠物'}
- 体重：${weight || 5}kg
- 年龄：${age || '成年'}
- 健康状况：${healthConditions?.join('、') || '健康'}
 
严格要求：
1. 绝对禁止使用：洋葱、大蒜、葡萄、葡萄干、巧克力、木糖醇、牛油果、夏威夷果、咖啡因、酒精、韭菜
2. 完全不加盐/调味料/香料
3. 所有肉类必须完全煮熟
4. 这是营养参考信息，不是医疗建议
${isKidney ? '5. 肾病参考配方：低磷低钾，限制蛋白质总量，使用兔肉或鳕鱼等低磷蛋白质，避免内脏' : ''}
${isPancreatitis ? '5. 胰腺炎参考配方：极低脂肪，使用去皮鸡胸肉或鳕鱼，避免任何高脂食材' : ''}
${isDiabetes ? '5. 糖尿病参考配方：低碳水化合物，高蛋白，避免淀粉类食材' : ''}
${isObese ? '5. 减重参考配方：低热量，高纤维，控制脂肪，减少碳水' : ''}
 
根据${weight || 5}kg体重精确计算每日用量。
 
请只返回JSON格式，不要任何其他文字：
{
  "title": "食谱名称（包含宠物名字）",
  "content": {
    "ingredients": [
      {"emoji": "🍗", "name": "食材名", "amount": "XXg"}
    ],
    "steps": ["步骤1", "步骤2", "步骤3", "步骤4"],
    "warnings": ["注意事项（如有病症）"],
    "notes": "备注"
  },
  "nutrition": {
    "calories": "约XXX kcal",
    "protein": "XXg",
    "fat": "XXg",
    "carbs": "XXg",
    "standard": "符合AAFCO标准"
  }
}`
 
    // 6. 调用 AI
    let recipe: any
    try {
      const completion = await openai.chat.completions.create({
        model: 'anthropic/claude-sonnet-4-5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      })
 
      const text = completion.choices[0]?.message?.content || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('AI返回格式错误')
      recipe = JSON.parse(jsonMatch[0])
 
    } catch (aiError) {
      // AI调用失败：退还积分
      console.error('AI call failed, refunding credit:', aiError)
      await supabase.rpc('refund_ai_credit', {
        p_user_id: user.id,
        p_source: creditSource,
        p_cost: 1
      })
      return NextResponse.json({ error: 'AI生成失败，请稍后重试，积分已退还' }, { status: 500 })
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
      description: `生成食谱：${recipe.title}（来源：${creditSource}）`
    })
 
    return NextResponse.json(recipe)
 
  } catch (e: any) {
    console.error('generate-recipe error:', e)
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 })
  }
}
