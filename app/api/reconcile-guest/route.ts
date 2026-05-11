import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * POST /api/reconcile-guest
 * Called once after login to:
 * 1. Fix legacy free_ai_limit (3 → 2)
 * 2. Mark free_ai_used = 1 if the user had a prior guest usage
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ reconciled: false }, { status: 401 })

    const { guestToken, fingerprint } = await req.json()
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
             || req.headers.get('x-real-ip')
             || 'unknown'

    const { data: profile } = await supabase
      .from('profiles')
      .select('free_ai_used, free_ai_limit')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ reconciled: false })

    const currentUsed  = profile.free_ai_used  ?? 0
    const currentLimit = profile.free_ai_limit ?? 2

    // Already normalized — nothing to do
    if (currentLimit <= 2 && currentUsed > 0) {
      return NextResponse.json({ reconciled: false, freeRemaining: Math.max(0, currentLimit - currentUsed) })
    }

    // Check if this browser had a guest usage
    let guestUsed = false
    if (currentUsed === 0) {
      const filters: string[] = []
      if (guestToken) filters.push(`token.eq.${guestToken}`)
      if (ip !== 'unknown') filters.push(`ip.eq.${ip}`)
      if (fingerprint) filters.push(`fingerprint.eq.${fingerprint}`)

      if (filters.length > 0) {
        const { data: guestRecord } = await supabase
          .from('guest_usage').select('id').or(filters.join(',')).limit(1).maybeSingle()
        guestUsed = !!guestRecord
      }
    }

    const newLimit = Math.min(currentLimit, 2)
    const newUsed  = guestUsed ? 1 : currentUsed

    if (newLimit === currentLimit && newUsed === currentUsed) {
      return NextResponse.json({ reconciled: false, freeRemaining: Math.max(0, currentLimit - currentUsed) })
    }

    await supabase
      .from('profiles')
      .update({ free_ai_limit: newLimit, free_ai_used: newUsed })
      .eq('id', user.id)

    return NextResponse.json({
      reconciled: true,
      freeRemaining: Math.max(0, newLimit - newUsed)
    })
  } catch (e: any) {
    console.error('reconcile-guest error:', e)
    return NextResponse.json({ reconciled: false })
  }
}
