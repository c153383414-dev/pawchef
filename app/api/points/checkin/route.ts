'use client'
import { useState } from 'react'
import type { Profile } from '@/types'

interface Props {
  user: Profile | null
  onAuthRequired: () => void
  onPointsUpdated: (freePoints: number, paidPoints: number) => void
}

const EARN_ITEMS = [
  { emoji: '🎁', title: '注册赠送', desc: '完成注册即得，一次性', val: '+20', type: 'free' },
  { emoji: '📅', title: '每日签到', desc: '每天登录签到，当天有效', val: '+5', type: 'free' },
  { emoji: '📤', title: '分享食谱', desc: '每个食谱限得一次，每日上限2次', val: '+10', type: 'free' },
  { emoji: '👥', title: '邀请好友', desc: '好友完成邮箱验证后，终身上限5次', val: '+30', type: 'free' },
]

const SPEND_ITEMS = [
  { emoji: '📚', title: '解锁额外收藏位', desc: '+10个收藏位', val: '50💙', type: 'free' },
  { emoji: '📄', title: '导出饮食日志PDF', desc: '每次导出', val: '30💙', type: 'free' },
  { emoji: '🐾', title: '解锁第2只宠物档案', desc: '一次性解锁', val: '100💙', type: 'free' },
]

const AI_SPEND = [
  { emoji: '🤖', title: 'AI食谱生成', desc: '超出会员次数后，或非会员', val: '1🟠', type: 'paid' },
  { emoji: '🔄', title: '食材替换建议', desc: 'AI智能替换', val: '1🟠', type: 'paid' },
  { emoji: '📋', title: '7天周计划', desc: '生成完整膳食计划', val: '3🟠', type: 'paid' },
]

const PACKAGES = [
  { pts: 10, price: 6.9, label: '入门包', desc: '10次AI生成' },
  { pts: 30, price: 17.9, label: '热销包', desc: '30次AI生成', best: true },
  { pts: 60, price: 32.9, label: '标准包', desc: '60次AI生成' },
]

export default function PointsSection({ user, onAuthRequired, onPointsUpdated }: Props) {
  const [toast, setToast] = useState('')
  const [checkinDone, setCheckinDone] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleCheckin = async () => {
    if (!user) { onAuthRequired(); return }
    if (checkinDone) { showToast('今日已签到'); return }
    try {
      const res = await fetch('/api/points/checkin', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setCheckinDone(true)
        onPointsUpdated(data.free_points, user?.paid_points ?? 0)
        showToast('✅ 签到成功！+5 💙免费积分')
      } else {
        showToast(data.message || '今日已签到')
        setCheckinDone(true)
      }
    } catch {
      showToast('签到失败，请重试')
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
        showToast(data.error || '支付创建失败，请重试')
      }
    } catch {
      showToast('请求失败，请稍后重试')
    }
  }

  return (
    <div style={{ padding: '56px max(32px,4vw)' }}>

      {/* Header */}
      <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A9E7E', marginBottom: 12 }}>积分体系</div>
      <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px,4vw,38px)', fontWeight: 700, letterSpacing: '-0.02em' }}>
        两种积分，两种用途
      </h2>
      <p style={{ fontSize: 15, color: 'rgba(28,26,22,0.6)', marginTop: 12, fontWeight: 300, maxWidth: 560 }}>
        💙 <strong style={{ color: '#185FA5' }}>免费积分</strong>：签到/分享/邀请获得，用于解锁收藏、导出等功能<br />
        🟠 <strong style={{ color: '#C8813A' }}>AI积分</strong>：购买积分包获得，用于AI食谱生成等付费功能
      </p>

      {/* 用户积分展示 */}
      {user && (
        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', background: '#E6F1FB', borderRadius: 12, border: '1px solid #85B7EB' }}>
            <span style={{ fontSize: 20 }}>💙</span>
            <div>
              <div style={{ fontSize: 11, color: '#185FA5', fontWeight: 500 }}>免费积分</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#185FA5' }}>{user.free_points ?? 0}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', background: '#FBF0E4', borderRadius: 12, border: '1px solid #FAC775' }}>
            <span style={{ fontSize: 20 }}>🟠</span>
            <div>
              <div style={{ fontSize: 11, color: '#854F0B', fontWeight: 500 }}>AI积分</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#854F0B' }}>{user.paid_points ?? 0}</div>
            </div>
          </div>
          <button
            onClick={handleCheckin}
            style={{ padding: '10px 20px', borderRadius: 10, background: checkinDone ? '#F7F3EC' : '#1C1A16', color: checkinDone ? 'rgba(28,26,22,0.4)' : '#FDFAF5', border: 'none', fontSize: 14, fontWeight: 500, cursor: checkinDone ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {checkinDone ? '✅ 今日已签到' : '📅 每日签到 +5💙'}
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20, marginTop: 36 }}>

        {/* 左栏：赚取免费积分 */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#185FA5', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            💙 赚取免费积分
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {EARN_ITEMS.map(e => (
              <div key={e.title} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#EBF2EC', borderRadius: 10 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{e.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.5)', marginTop: 1 }}>{e.desc}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#185FA5', flexShrink: 0 }}>{e.val}💙</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 13, fontWeight: 500, color: '#185FA5', marginBottom: 10 }}>💙 免费积分能做什么</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SPEND_ITEMS.map(s => (
              <div key={s.title} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#E6F1FB', borderRadius: 10 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{s.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.5)' }}>{s.desc}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#185FA5', flexShrink: 0 }}>{s.val}</div>
              </div>
            ))}
            <div style={{ padding: '8px 14px', background: '#F1EFE8', borderRadius: 10, fontSize: 12, color: 'rgba(28,26,22,0.5)' }}>
              ❌ 免费积分不能用于AI食谱生成
            </div>
          </div>
        </div>

        {/* 右栏：购买AI积分 */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#854F0B', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            🟠 AI积分能做什么
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {AI_SPEND.map(s => (
              <div key={s.title} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FBF0E4', borderRadius: 10 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{s.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.5)' }}>{s.desc}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#854F0B', flexShrink: 0 }}>{s.val}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 13, fontWeight: 500, color: '#854F0B', marginBottom: 10 }}>🟠 购买AI积分包</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PACKAGES.map(p => (
              <div
                key={p.pts}
                onClick={() => buyPoints(p.pts, p.price)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: p.best ? '#FBF0E4' : '#F7F3EC', borderRadius: 12, border: `1px solid ${p.best ? '#EF9F27' : 'rgba(28,26,22,0.1)'}`, cursor: 'pointer', position: 'relative' }}>
                {p.best && (
                  <div style={{ position: 'absolute', top: -9, left: 16, background: '#EF9F27', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>最超值</div>
                )}
                <div style={{ width: 40, height: 40, borderRadius: 10, background: p.best ? '#FAC775' : '#e8e4dc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🟠</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.label} · {p.pts} AI积分</div>
                  <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.5)' }}>{p.desc} · ${(p.price / p.pts).toFixed(2)}/次</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#854F0B' }}>${p.price}</div>
                  <div style={{ fontSize: 10, color: 'rgba(28,26,22,0.4)' }}>永不过期</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, padding: '10px 14px', background: '#F7F3EC', borderRadius: 10, fontSize: 12, color: 'rgba(28,26,22,0.5)', lineHeight: 1.6 }}>
            ✓ AI积分永不过期 &nbsp;·&nbsp; ✓ 调用失败自动退还 &nbsp;·&nbsp; ✓ 不可退款转让
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 300, padding: '12px 18px', borderRadius: 10, background: '#1C1A16', color: '#FDFAF5', fontSize: 14, boxShadow: '0 4px 20px rgba(28,26,22,0.2)', maxWidth: 280 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
