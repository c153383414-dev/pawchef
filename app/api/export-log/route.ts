import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { pet_name, month } = await req.json()

    // Deduct 30 free_points
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('free_points')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: '获取用户信息失败' }, { status: 500 })
    }

    if ((profile.free_points ?? 0) < 30) {
      return NextResponse.json({ error: '免费积分不足（需要 30 💙）', detail: 'insufficient_free_points' }, { status: 402 })
    }

    // Deduct points
    const { error: deductError } = await supabase
      .from('profiles')
      .update({ free_points: profile.free_points - 30 })
      .eq('id', user.id)

    if (deductError) {
      return NextResponse.json({ error: '积分扣减失败' }, { status: 500 })
    }

    // Record transaction
    await supabase.from('point_transactions').insert({
      user_id: user.id,
      amount: -30,
      type: 'export_log',
      description: `导出饮食日志 PDF：${pet_name || '全部宠物'} ${month || ''}`
    })

    // Fetch logs for the month
    const targetMonth = month || new Date().toISOString().slice(0, 7)
    const [year, mon] = targetMonth.split('-').map(Number)
    const start = `${targetMonth}-01T00:00:00.000Z`
    const end = new Date(year, mon, 1).toISOString()

    let query = supabase
      .from('feeding_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('fed_at', start)
      .lt('fed_at', end)
      .order('fed_at', { ascending: true })

    if (pet_name) query = query.eq('pet_name', pet_name)

    const { data: logs } = await query
    const safeProfile = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
    const ownerName = safeProfile.data?.display_name || 'User'

    // Generate HTML report
    const monthLabel = new Date(year, mon - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const totalFeedings = logs?.length ?? 0

    let calTotal = 0, calCount = 0
    for (const log of logs ?? []) {
      if (log.nutrition?.calories) {
        const c = parseInt(String(log.nutrition.calories).replace(/[^0-9]/g, ''))
        if (!isNaN(c) && c > 0) { calTotal += c; calCount++ }
      }
    }
    const avgCal = calCount > 0 ? Math.round(calTotal / calCount) : 0

    const logRows = (logs ?? []).map(log => {
      const date = new Date(log.fed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const mealLabel = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }[log.meal_type as string] || log.meal_type
      const cal = log.nutrition?.calories ? ` · ${log.nutrition.calories}` : ''
      return `<tr><td>${date}</td><td>${mealLabel}</td><td>${log.meal_title}</td><td style="color:#854F0B">${cal}</td></tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PawChef Nutrition Report · ${pet_name || 'All Pets'} · ${monthLabel}</title>
<style>
  body { font-family: Georgia, serif; color: #1C1A16; background: #fff; max-width: 800px; margin: 0 auto; padding: 40px 24px; }
  h1 { font-size: 28px; margin-bottom: 4px; }
  .sub { color: #7A9E7E; font-size: 14px; margin-bottom: 32px; }
  .stats { display: flex; gap: 24px; background: #F7F3EC; padding: 16px 20px; border-radius: 10px; margin-bottom: 28px; }
  .stat { text-align: center; }
  .stat-val { font-size: 22px; font-weight: 700; }
  .stat-lbl { font-size: 12px; color: #666; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { text-align: left; font-size: 12px; color: #888; padding: 8px 10px; border-bottom: 1px solid #eee; }
  td { padding: 8px 10px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
  .footer { margin-top: 40px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 16px; }
  @media print { body { padding: 24px; } }
</style>
</head>
<body>
<h1>🐾 PawChef Nutrition Report</h1>
<div class="sub">Pet: ${pet_name || 'All Pets'} &nbsp;·&nbsp; Month: ${monthLabel} &nbsp;·&nbsp; Owner: ${ownerName}</div>
<div class="stats">
  <div class="stat"><div class="stat-val">${totalFeedings}</div><div class="stat-lbl">Total Feedings</div></div>
  <div class="stat"><div class="stat-val">${avgCal > 0 ? avgCal + ' kcal' : '—'}</div><div class="stat-lbl">Avg Daily Calories</div></div>
</div>
<h2 style="font-size:16px;margin-bottom:8px;">Feeding History</h2>
<table>
  <thead><tr><th>Date</th><th>Meal</th><th>Recipe</th><th>Calories</th></tr></thead>
  <tbody>${logRows || '<tr><td colspan="4" style="color:#999;text-align:center;padding:24px">No records for this period</td></tr>'}</tbody>
</table>
<div class="footer">
  ⚠️ This report is for reference only. Consult your veterinarian before making dietary changes.<br>
  Generated by PawChef · pawchef-app.vercel.app · ${new Date().toLocaleDateString()}
</div>
</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="pawchef-nutrition-${pet_name || 'report'}-${targetMonth}.html"`
      }
    })

  } catch (e: any) {
    console.error('export-log error:', e)
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 })
  }
}
