import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  // Check if already checked in today
  const today = new Date().toISOString().split('T')[0]
  const { data: existing } = await supabase
    .from('point_transactions')
    .select('id')
    .eq('user_id', user.id)
    .eq('type', 'checkin')
    .gte('created_at', today)
    .single()

  if (existing) return NextResponse.json({ message: '今日已签到' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('points').eq('id', user.id).single()
  const newPoints = (profile?.points || 0) + 10

  await supabase.from('profiles').update({ points: newPoints }).eq('id', user.id)
  await supabase.from('point_transactions').insert({ user_id: user.id, amount: 10, type: 'checkin', description: '每日签到' })

  return NextResponse.json({ points: newPoints })
}
