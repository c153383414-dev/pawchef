'use client'
import { useState } from 'react'
import type { Profile } from '@/types'

interface Props {
  user: Profile | null
  onAuthRequired: () => void
  onPointsUpdated: (freePoints: number, paidPoints: number) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const PACKAGES = [
  { pts: 10, price: 6.9, labelKey: 'points.packages.starter' },
  { pts: 30, price: 17.9, labelKey: 'points.packages.popular', best: true },
  { pts: 60, price: 32.9, labelKey: 'points.packages.standard' },
]

export default function PointsSection({ user, onAuthRequired, onPointsUpdated, t }: Props) {
  const [toast, setToast] = useState('')
  const [checkinDone, setCheckinDone] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleCheckin = async () => {
    if (!user) { onAuthRequired(); return }
    if (checkinDone) { showToast(t('points.checkinDone')); return }
    try {
      const res = await fetch('/api/points/checkin', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setCheckinDone(true)
        onPointsUpdated(data.free_points, user?.paid_points ?? 0)
        showToast(t('points.checkinSuccess'))
      } else {
        showToast(data.message || t('points.checkinDone'))
        setCheckinDone(true)
      }
    } catch {
      showToast('Check-in failed, please try again')
    }
  }

  const buyPoints = async (pts: number, price: number) => {
    if (!user) { onAuthRequired(); return }
    try {
      const res = await fetch('/api/points/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: pts, price })
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        showToast(data.error || 'Payment failed, please try again')
      }
    } catch {
      showToast('Request failed, please try again')
    }
  }

  const EARN_ITEMS = [
    { emoji: '🎁', titleKey: 'points.earn.register.title', descKey: 'points.earn.register.desc', val: '+20' },
    { emoji: '📅', titleKey: 'points.earn.checkin.title', descKey: 'points.earn.checkin.desc', val: '+5' },
    { emoji: '📤', titleKey: 'points.earn.share.title', descKey: 'points.earn.share.desc', val: '+10' },
    { emoji: '👥', titleKey: 'points.earn.invite.title', descKey: 'points.earn.invite.desc', val: '+30' },
  ]

  const FREE_SPEND = [
    { emoji: '📚', titleKey: 'points.freeSpend.collection.title', descKey: 'points.freeSpend.collection.desc', val: '50💙' },
    { emoji: '📄', titleKey: 'points.freeSpend.export.title', descKey: 'points.freeSpend.export.desc', val: '30💙' },
    { emoji: '🐾', titleKey: 'points.freeSpend.pet2.title', descKey: 'points.freeSpend.pet2.desc', val: '100💙' },
  ]

  const AI_SPEND = [
    { emoji: '🤖', titleKey: 'points.aiSpend.generate.title', descKey: 'points.aiSpend.generate.desc', val: '1🟠' },
    { emoji: '🔄', titleKey: 'points.aiSpend.substitute.title', descKey: 'points.aiSpend.substitute.desc', val: '1🟠' },
    { emoji: '📋', titleKey: 'points.aiSpend.weekly.title', descKey: 'points.aiSpend.weekly.desc', val: '3🟠' },
  ]

  return (
    <div style={{ padding: '56px max(32px,4vw)' }}>
      <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A9E7E', marginBottom: 12 }}>
        {t('points.sectionLabel')}
      </div>
      <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px,4vw,38px)', fontWeight: 700, letterSpacing: '-0.02em' }}>
        {t('points.title')}
      </h2>
      <p style={{ fontSize: 15, color: 'rgba(28,26,22,0.6)', marginTop: 12, fontWeight: 300, maxWidth: 560, lineHeight: 1.7 }}>
        {t('points.subtitle')}
      </p>

      {/* User balance */}
      {user && (
        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', background: '#E6F1FB', borderRadius: 12, border: '1px solid #85B7EB' }}>
            <span style={{ fontSize: 20 }}>💙</span>
            <div>
              <div style={{ fontSize: 11, color: '#185FA5', fontWeight: 500 }}>{t('points.freeCredits')}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#185FA5' }}>{user.free_points ?? 0}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', background: '#FBF0E4', borderRadius: 12, border: '1px solid #FAC775' }}>
            <span style={{ fontSize: 20 }}>🟠</span>
            <div>
              <div style={{ fontSize: 11, color: '#854F0B', fontWeight: 500 }}>{t('points.aiCredits')}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#854F0B' }}>{user.paid_points ?? 0}</div>
            </div>
          </div>
          <button onClick={handleCheckin} style={{
            padding: '10px 20px', borderRadius: 10,
            background: checkinDone ? '#F7F3EC' : '#1C1A16',
            color: checkinDone ? 'rgba(28,26,22,0.4)' : '#FDFAF5',
            border: 'none', fontSize: 14, fontWeight: 500,
            cursor: checkinDone ? 'default' : 'pointer', fontFamily: 'inherit'
          }}>
            {checkinDone ? t('points.checkinDone') : t('points.checkinBtn')}
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20, marginTop: 36 }}>

        {/* Left: Free credits */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#185FA5', marginBottom: 10 }}>
            {t('points.earnFree')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {EARN_ITEMS.map(e => (
              <div key={e.titleKey} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#EBF2EC', borderRadius: 10 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{e.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t(e.titleKey)}</div>
                  <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.5)', marginTop: 1 }}>{t(e.descKey)}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#185FA5', flexShrink: 0 }}>{e.val}💙</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 13, fontWeight: 500, color: '#185FA5', marginBottom: 10 }}>
            {t('points.spendFree')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {FREE_SPEND.map(s => (
              <div key={s.titleKey} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#E6F1FB', borderRadius: 10 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{s.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t(s.titleKey)}</div>
                  <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.5)' }}>{t(s.descKey)}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#185FA5', flexShrink: 0 }}>{s.val}</div>
              </div>
            ))}
            <div style={{ padding: '8px 14px', background: '#F1EFE8', borderRadius: 10, fontSize: 12, color: 'rgba(28,26,22,0.5)' }}>
              ❌ {t('points.noCredits')}
            </div>
          </div>
        </div>

        {/* Right: AI credits */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#854F0B', marginBottom: 10 }}>
            {t('points.aiCanDo')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {AI_SPEND.map(s => (
              <div key={s.titleKey} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FBF0E4', borderRadius: 10 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{s.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t(s.titleKey)}</div>
                  <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.5)' }}>{t(s.descKey)}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#854F0B', flexShrink: 0 }}>{s.val}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 13, fontWeight: 500, color: '#854F0B', marginBottom: 10 }}>
            {t('points.buyAI')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PACKAGES.map(p => (
              <div key={p.pts} onClick={() => buyPoints(p.pts, p.price)} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                background: p.best ? '#FBF0E4' : '#F7F3EC',
                borderRadius: 12, border: `1px solid ${p.best ? '#EF9F27' : 'rgba(28,26,22,0.1)'}`,
                cursor: 'pointer', position: 'relative'
              }}>
                {p.best && (
                  <div style={{ position: 'absolute', top: -9, left: 16, background: '#EF9F27', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>
                    {t('points.packages.bestValue')}
                  </div>
                )}
                <div style={{ width: 40, height: 40, borderRadius: 10, background: p.best ? '#FAC775' : '#e8e4dc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🟠</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t(p.labelKey)} · {p.pts} AI credits</div>
                  <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.5)' }}>{t('points.packages.uses', { n: p.pts })} · {t('points.packages.perUse', { n: (p.price / p.pts).toFixed(2) })}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#854F0B' }}>${p.price}</div>
                  <div style={{ fontSize: 10, color: 'rgba(28,26,22,0.4)' }}>{t('points.neverExpire')}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, padding: '10px 14px', background: '#F7F3EC', borderRadius: 10, fontSize: 12, color: 'rgba(28,26,22,0.5)', lineHeight: 1.6 }}>
            ✓ {t('points.neverExpire')} &nbsp;·&nbsp; ✓ {t('points.autoRefund')} &nbsp;·&nbsp; ✓ {t('points.noRefund')}
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 300, padding: '12px 18px', borderRadius: 10, background: '#1C1A16', color: '#FDFAF5', fontSize: 14, boxShadow: '0 4px 20px rgba(28,26,22,0.2)', maxWidth: 280 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
