import { NextRequest, NextResponse } from 'next/server'
import { searchIngredient } from '@/lib/safety-db'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  const result = searchIngredient(q)
  if (result) return NextResponse.json(result)
  return NextResponse.json({
    level: 'caution', title: '需进一步确认',
    message: `数据库暂无"${q}"的记录，建议查阅ASPCA官方网站或咨询持牌兽医后再喂食。`,
    dogSafe: null, catSafe: null
  })
}
