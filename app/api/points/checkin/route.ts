import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { data, error } = await supabase.rpc('daily_checkin', {
    p_user_id: user.id
  })

  if (error) {
    return NextResponse.json({ error: '系统错误' }, { status: 500 })
  }

  if (!data?.ok) {
    return NextResponse.json(
      { message: '今日已签到，明天再来' },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    free_points: data.free_points,
    message: '签到成功！+5 免费积分'
  })
}
