import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' })

const POINTS_PRICES: Record<number, string> = {
  100: process.env.STRIPE_PRICE_POINTS_100 || '',
  300: process.env.STRIPE_PRICE_POINTS_300 || '',
  600: process.env.STRIPE_PRICE_POINTS_600 || '',
  1500: process.env.STRIPE_PRICE_POINTS_1500 || '',
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { points } = await req.json()
  const priceId = POINTS_PRICES[points as number]
  if (!priceId) return NextResponse.json({ error: '无效积分包' }, { status: 400 })

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}?points_success=1&pts=${points}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}#points`,
    metadata: { user_id: user.id, points: points.toString() },
  })

  return NextResponse.json({ url: session.url })
}
