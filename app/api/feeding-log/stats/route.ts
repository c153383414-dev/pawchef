import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const petName = searchParams.get('pet_name')
    const month = searchParams.get('month') // YYYY-MM

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

    if (petName) query = query.eq('pet_name', petName)

    const { data: logs, error } = await query

    if (error) {
      return NextResponse.json({ error: '查询失败' }, { status: 500 })
    }

    if (!logs || logs.length === 0) {
      return NextResponse.json({
        month: targetMonth,
        totalFeedings: 0,
        avgDailyCalories: 0,
        proteinBreakdown: [],
        weeklyCalories: [0, 0, 0, 0],
        mostUsedIngredients: [],
        aafcoCompliance: '0%'
      })
    }

    // Calculate stats
    const totalFeedings = logs.length

    // Extract calories from nutrition field
    let totalCalories = 0
    let totalProteinG = 0
    let totalFatG = 0
    let calorieCount = 0
    let macroCount = 0
    const ingredientCount: Record<string, number> = {}
    const proteinCount: Record<string, number> = {}

    const weeklyCalorieSums = [0, 0, 0, 0]
    const weeklyCalorieCounts = [0, 0, 0, 0]

    for (const log of logs) {
      const fedDate = new Date(log.fed_at)
      const dayOfMonth = fedDate.getDate()
      const weekIndex = Math.min(Math.floor((dayOfMonth - 1) / 7), 3)

      // Parse calories + macros
      if (log.nutrition?.calories) {
        const cal = parseInt(String(log.nutrition.calories).replace(/[^0-9]/g, ''))
        if (!isNaN(cal) && cal > 0) {
          totalCalories += cal
          calorieCount++
          weeklyCalorieSums[weekIndex] += cal
          weeklyCalorieCounts[weekIndex]++
        }
      }
      if (log.nutrition?.protein && log.nutrition?.fat) {
        const prot = parseFloat(String(log.nutrition.protein).replace(/[^0-9.]/g, ''))
        const fat  = parseFloat(String(log.nutrition.fat).replace(/[^0-9.]/g, ''))
        if (!isNaN(prot) && !isNaN(fat)) {
          totalProteinG += prot
          totalFatG += fat
          macroCount++
        }
      }

      // Count ingredients
      if (Array.isArray(log.ingredients)) {
        for (const ing of log.ingredients) {
          const name = ing.name?.toLowerCase() || ''
          if (name) ingredientCount[name] = (ingredientCount[name] || 0) + 1

          // Rough protein detection
          const proteinKeywords = ['chicken', 'beef', 'fish', 'turkey', 'rabbit', 'salmon', 'cod',
            '鸡', '牛', '鱼', '火鸡', '兔', '三文鱼', '鳕鱼', '猪', '鸭']
          if (proteinKeywords.some(k => name.includes(k))) {
            proteinCount[ing.name] = (proteinCount[ing.name] || 0) + 1
          }
        }
      }
    }

    const avgDailyCalories = calorieCount > 0
      ? Math.round(totalCalories / calorieCount)
      : 0

    const weeklyCalories = weeklyCalorieSums.map((sum, i) =>
      weeklyCalorieCounts[i] > 0 ? Math.round(sum / weeklyCalorieCounts[i]) : 0
    )

    const mostUsedIngredients = Object.entries(ingredientCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name)

    const proteinEntries = Object.entries(proteinCount)
    const totalProteinUses = proteinEntries.reduce((sum, [, c]) => sum + c, 0)
    const proteinBreakdown = proteinEntries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([source, count]) => ({
        source,
        percentage: Math.round((count / Math.max(totalProteinUses, 1)) * 100)
      }))

    // Simple AAFCO compliance: % of logs that have nutrition data
    const logsWithNutrition = logs.filter(l => l.nutrition?.calories).length
    const aafcoCompliance = totalFeedings > 0
      ? Math.round((logsWithNutrition / totalFeedings) * 100) + '%'
      : '0%'

    const avgDailyProtein = macroCount > 0 ? Math.round(totalProteinG / macroCount) : null
    const avgDailyFat     = macroCount > 0 ? Math.round(totalFatG     / macroCount) : null

    return NextResponse.json({
      month: targetMonth,
      totalFeedings,
      avgDailyCalories,
      avgDailyProtein,
      avgDailyFat,
      proteinBreakdown,
      weeklyCalories,
      mostUsedIngredients,
      aafcoCompliance
    })

  } catch (e: any) {
    console.error('feeding-log stats error:', e)
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 })
  }
}
