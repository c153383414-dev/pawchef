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

    const { ingredient, amount, species, healthConditions, recipeContext } = await req.json()
    if (!ingredient || !species) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 })
    }

    const { data: deductResult, error: deductError } = await supabase
      .rpc('deduct_ai_credits', { p_user_id: user.id, p_cost: 1 })

    if (deductError) {
      console.error('deduct_ai_credits error:', deductError)
      return NextResponse.json({ error: '系统错误，请稍后重试' }, { status: 500 })
    }

    if (!deductResult?.ok) {
      return NextResponse.json({
        error: '次数或积分不足',
        detail: 'AI积分不足，请购买积分包或订阅Pro会员'
      }, { status: 402 })
    }

    const creditSource = deductResult?.source
    const speciesName = species === 'dog' ? '狗' : '猫'
    const conditions = Array.isArray(healthConditions) && healthConditions.length
      ? healthConditions.join('、')
      : '健康'

    const prompt = `你是一位专业宠物营养师。为${speciesName}食谱中的「${ingredient}（${amount}）」推荐3个等效替代食材。
健康状况：${conditions}
食谱背景：${recipeContext || '成年宠物均衡膳食'}

严格规则：
- 绝对禁止推荐：洋葱、大蒜、葡萄、葡萄干、巧克力、木糖醇、牛油果、夏威夷果、咖啡因、酒精、韭菜
- 所有推荐必须对${speciesName}安全
- 调整用量以保持相似的热量/蛋白质含量
${conditions !== '健康' ? `- 严格遵守${conditions}的饮食限制` : ''}

只返回JSON，不要任何其他文字：
{
  "substitutes": [
    {"name": "食材名（中文）", "amount": "XXg", "emoji": "🍗", "reason": "替换原因（1-2句）", "nutrition_note": "营养说明（1句）"}
  ]
}`

    let result: any
    try {
      const completion = await openai.chat.completions.create({
        model: 'anthropic/claude-sonnet-4-5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.5,
      })

      const text = completion.choices[0]?.message?.content || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('AI返回格式错误')
      result = JSON.parse(jsonMatch[0])

    } catch (aiError) {
      console.error('AI substitute failed, refunding:', aiError)
      await supabase.rpc('refund_ai_credit', {
        p_user_id: user.id,
        p_source: creditSource,
        p_cost: 1
      })
      return NextResponse.json({ error: 'AI生成失败，积分已退还' }, { status: 500 })
    }

    await supabase.from('point_transactions').insert({
      user_id: user.id,
      amount: -1,
      type: 'substitute_ingredient',
      description: `食材替换：${ingredient}（来源：${creditSource}）`
    })

    return NextResponse.json({
      original: { name: ingredient, amount },
      substitutes: result.substitutes ?? []
    })

  } catch (e: any) {
    console.error('substitute-ingredient error:', e)
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 })
  }
}
