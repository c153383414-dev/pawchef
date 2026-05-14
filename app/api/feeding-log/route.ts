import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { pet_name, meal_title, meal_type, ingredients, nutrition, fed_at, notes } = await req.json()
    if (!meal_title || !meal_type) {
      return NextResponse.json({ error: '餐食名称和餐次为必填项' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('feeding_logs')
      .insert({
        user_id: user.id,
        pet_name: pet_name || null,
        meal_title,
        meal_type,
        ingredients: ingredients || null,
        nutrition: nutrition || null,
        fed_at: fed_at || new Date().toISOString(),
        notes: notes || null
      })
      .select()
      .single()

    if (error) {
      console.error('feeding_logs insert error:', error)
      return NextResponse.json({ error: '记录失败，请稍后重试' }, { status: 500 })
    }

    return NextResponse.json(data)

  } catch (e: any) {
    console.error('feeding-log POST error:', e)
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const petName = searchParams.get('pet_name')
    const month = searchParams.get('month') // format: YYYY-MM
    const limit = parseInt(searchParams.get('limit') || '30')

    let query = supabase
      .from('feeding_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('fed_at', { ascending: false })
      .limit(limit)

    if (petName) query = query.eq('pet_name', petName)

    if (month) {
      const start = `${month}-01T00:00:00.000Z`
      const [year, mon] = month.split('-').map(Number)
      const endDate = new Date(year, mon, 1)
      const end = endDate.toISOString()
      query = query.gte('fed_at', start).lt('fed_at', end)
    }

    const { data, error } = await query

    if (error) {
      console.error('feeding_logs select error:', error)
      return NextResponse.json({ error: '查询失败' }, { status: 500 })
    }

    return NextResponse.json(data || [])

  } catch (e: any) {
    console.error('feeding-log GET error:', e)
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })

    const { id, pet_name, meal_type, fed_at, notes, ingredients, nutrition } = await req.json()
    if (!id) return NextResponse.json({ error: '缺少记录ID' }, { status: 400 })

    const { data, error } = await supabase
      .from('feeding_logs')
      .update({
        pet_name:    pet_name ?? null,
        meal_type,
        fed_at,
        notes:       notes ?? null,
        ingredients: ingredients ?? null,
        nutrition:   nutrition ?? null,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: '更新失败' }, { status: 500 })

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: '缺少记录ID' }, { status: 400 })

    const { error } = await supabase
      .from('feeding_logs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: '删除失败' }, { status: 500 })

    return NextResponse.json({ ok: true })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 })
  }
}
