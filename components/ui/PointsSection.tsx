'use client'
import { useState } from 'react'
import type { Profile } from '@/types'

interface Props {
  user: Profile | null
  onAuthRequired: () => void
  onPointsUpdated: (freePoints: number, paidPoints: number) => void
}

const EARN = [
  { emoji: '📅', amount: '+10', action: '每日签到' },
  { emoji: '🍽️', amount: '+5', action: '生成一次食谱' },
  { emoji: '📤', amount: '+30', action: '分享食谱' },
  { emoji: '👥', amount: '+100', action: '邀请好友注册' },
  { emoji: '🤖', amount: '-10', action: '消耗：生成食谱', spend: true },
  { emoji: '📋', amount: '-50', action: '消耗：周计划', spend: true },
]

const PACKAGES = [
  { pts: 100, price: 2.9 },
  { pts: 300, price: 6.9, best: true },
  { pts: 600, price: 11.9 },
  { pts: 1500, price: 24.9 },
]

export default function PointsSection({ user, onAuthRequired, onPointsUpdated }: Props) {
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

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
        showToast(data.error || '支付创建失败')
      }
    } catch {
      showToast('请求失败，请稍后重试')
    }
  }

  const checkin = async () => {
    if (!user) { onAuthRequired(); return }
    try {
      const res = await fetch('/api/points/checkin', { method: 'POST' })
      const data = await res.json()
      if (data.points !== undefined) {
        onPointsUpdated(data.points)
        showToast('✓ 签到成功！+10 积分')
      } else {
        showToast(data.message || '今日已签到')
      }
    } catch {
      showToast('签到失败，请稍后重试')
    }
  }

  return (
    <div style={{ padding: '56px max(32px,4vw)' }}>
      <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A9E7E', marginBottom: 12 }}>积分体系</div>
      <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px,4vw,38px)', fontWeight: 700, letterSpacing: '-0.02em' }}>赚积分，用积分</h2>
      <p style={{ fontSize: 15, color: 'rgba(28,26,22,0.6)', marginTop: 12, fontWeight: 300 }}>免费用户通过积分解锁更多功能，积分不够时可以直接购买</p>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20, padding: '12px 20px', background: '#FDFAF5', borderRadius: 12, border: '1px solid rgba(28,26,22,0.12)', width: 'fit-content' }}>
          <span style={{ fontSize: 14, color: 'rgba(28,26,22,0.6)' }}>当前积分</span>
          <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, color: '#C8813A' }}>{user.points}</span>
          <button onClick={checkin} style={{ padding: '6px 14px', borderRadius: 8, background: '#C8813A', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>每日签到</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginTop: 36 }}>
        {EARN.map(e => (
          <div key={e.action} style={{ background: '#FDFAF5', borderRadius: 14, border: `1px solid rgba(28,26,22,0.12)`, padding: 20, textAlign: 'center', borderStyle: e.spend ? 'dashed' : 'solid' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>{e.emoji}</div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, color: e.spend ? '#C45C5C' : '#C8813A', marginBottom: 4 }}>{e.amount}</div>
            <div style={{ fontSize: 13, color: 'rgba(28,26,22,0.6)' }}>{e.action}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, padding: 24, background: '#FDFAF5', borderRadius: 16, border: '1px solid rgba(28,26,22,0.12)' }}>
        <h3 style={{ fontSize: 17, fontWeight: 500, marginBottom: 16 }}>💳 购买积分包</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PACKAGES.map(p => (
            <div key={p.pts} onClick={() => buyPoints(p.pts, p.price)} style={{ flex: 1, minWidth: 100, padding: '16px 12px', borderRadius: 12, border: `1px solid ${p.best ? '#C8813A' : 'rgba(28,26,22,0.12)'}`, textAlign: 'center', cursor: 'pointer', background: p.best ? '#FBF0E4' : '#F7F3EC', position: 'relative' }}>
              {p.best && <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', background: '#C8813A', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500, whiteSpace: 'nowrap' }}>最超值</div>}
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700 }}>{p.pts}</div>
              <div style={{ fontSize: 13, color: 'rgba(28,26,22,0.6)', marginTop: 2 }}>${p.price}</div>
            </div>
          ))}
        </div>
        {!user && <p style={{ fontSize: 12, color: '#C8813A', marginTop: 12 }}>需要登录才能购买积分</p>}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 300, padding: '12px 18px', borderRadius: 10, background: '#1C1A16', color: '#FDFAF5', fontSize: 14, boxShadow: '0 4px 20px rgba(28,26,22,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
