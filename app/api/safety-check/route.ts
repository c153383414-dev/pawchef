import { NextRequest, NextResponse } from 'next/server'
import { getSafetyResult } from '@/lib/safety-db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || ''
  const locale = searchParams.get('locale') || 'zh'

  if (!q) return NextResponse.json({ level: 'unknown' })

  const result = getSafetyResult(q, locale)
  return NextResponse.json(result)
}
