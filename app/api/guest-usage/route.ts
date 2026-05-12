import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/guest-usage?token=gt_xxx&fingerprint=abc
 * Returns whether this guest has already used their free recipe.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token       = searchParams.get('token') || ''
  const fingerprint = searchParams.get('fingerprint') || ''
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
           || req.headers.get('x-real-ip')
           || 'unknown'

  if (!token) {
    return NextResponse.json({ used: false })
  }

  try {
    const supabase = await createServerSupabaseClient()

    // Build an OR filter: any of token / ip / fingerprint matches
    const filters = [`token.eq.${token}`]
    if (ip !== 'unknown') filters.push(`ip.eq.${ip}`)
    if (fingerprint) filters.push(`fingerprint.eq.${fingerprint}`)

    const { data } = await supabase
      .from('guest_usage')
      .select('id')
      .or(filters.join(','))
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ used: !!data })
  } catch (e: any) {
    console.error('guest-usage GET error:', e)
    return NextResponse.json({ used: false })
  }
}
