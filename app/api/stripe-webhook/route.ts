import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' })

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Webhook signature failed' }, { status: 400 })
  }

  const supabase = await createAdminSupabaseClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.CheckoutSession
    const { user_id, points } = session.metadata || {}

    if (user_id && points) {
      const pts = parseInt(points)
      const { data: profile } = await supabase.from('profiles').select('points').eq('id', user_id).single()
      const newPoints = (profile?.points || 0) + pts
      await supabase.from('profiles').update({ points: newPoints }).eq('id', user_id)
      await supabase.from('point_transactions').insert({ user_id, amount: pts, type: 'purchase', description: `购买${pts}积分包` })
    }

    // Handle Pro subscription
    if (session.mode === 'subscription') {
      const userId = session.client_reference_id
      if (userId) {
        const expiresAt = new Date()
        expiresAt.setMonth(expiresAt.getMonth() + 1)
        await supabase.from('profiles').update({ is_pro: true, pro_expires_at: expiresAt.toISOString() }).eq('id', userId)
        await supabase.from('subscriptions').insert({ user_id: userId, plan: 'monthly', stripe_subscription_id: session.subscription as string, current_period_end: expiresAt.toISOString() })
      }
    }
  }

  return NextResponse.json({ received: true })
}
