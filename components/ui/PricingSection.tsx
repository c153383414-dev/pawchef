'use client'
import { useState } from 'react'

export default function PricingSection({ onSignup }: { onSignup: () => void }) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A9E7E', marginBottom: 12 }}>透明定价</div>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px,4vw,42px)', fontWeight: 700, letterSpacing: '-0.02em' }}>为你的宠物值得</h2>
        <p style={{ fontSize: 15, color: 'rgba(28,26,22,0.6)', marginTop: 12, fontWeight: 300 }}>随时取消，无隐藏费用</p>
        <div style={{ display: 'inline-flex', gap: 4, background: '#F7F3EC', padding: 4, borderRadius: 10, marginTop: 20 }}>
          {(['monthly', 'annual'] as const).map(b => (
            <button key={b} onClick={() => setBilling(b)} style={{ padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit', background: billing === b ? '#FDFAF5' : 'transparent', color: billing === b ? '#1C1A16' : 'rgba(28,26,22,0.6)', boxShadow: billing === b ? '0 1px 4px rgba(28,26,22,.1)' : 'none' }}>
              {b === 'monthly' ? '月付' : <>年付 <span style={{ color: '#7A9E7E', fontSize: 12 }}>省40%</span></>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, maxWidth: 960, margin: '0 auto' }}>
        {/* Free */}
        <div style={cardStyle}>
          <div style={tierStyle}>免费版</div>
          <div style={priceStyle}><span style={{ fontSize: 18, marginTop: 8 }}>$</span>0</div>
          <div style={perStyle}>永久免费</div>
          <div style={dividerStyle} />
          {['每日 3 次食谱生成','1只宠物档案','食材安全速查（无限）','危险食材警报','收藏最多 5 份食谱'].map(f => <Feature key={f} text={f} />)}
          <button onClick={onSignup} style={{ ...btnStyle, background: 'transparent', color: '#1C1A16', border: '1px solid rgba(28,26,22,0.12)' }}>免费开始</button>
        </div>

        {/* Pro */}
        <div style={{ ...cardStyle, background: '#1C1A16', color: '#FDFAF5', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#C8813A', color: '#fff', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>🔥 最受欢迎</div>
          <div style={{ ...tierStyle, color: 'rgba(253,250,245,0.5)' }}>Pro 订阅</div>
          <div style={{ ...priceStyle, color: '#FDFAF5' }}>
            <span style={{ fontSize: 18, marginTop: 8 }}>$</span>
            {billing === 'monthly' ? '9.9' : '5.9'}
          </div>
          <div style={{ ...perStyle, color: 'rgba(253,250,245,0.6)' }}>
            {billing === 'monthly' ? '/ 月' : '/ 月，年付 $70.8'}
          </div>
          {billing === 'annual' && <div style={{ fontSize: 12, fontWeight: 500, color: '#D4A843', marginBottom: 20 }}>💚 比月付省 $47.76/年</div>}
          <div style={{ ...dividerStyle, background: 'rgba(253,250,245,0.15)' }} />
          {['无限次食谱生成','5只宠物档案','7天膳食计划 + 购物清单','营养月报 PDF 导出','每月赠送 200 积分','病宠专项食谱'].map(f => <Feature key={f} text={f} featured />)}
          <button onClick={onSignup} style={{ ...btnStyle, background: '#FDFAF5', color: '#1C1A16' }}>立即订阅 Pro</button>
        </div>

        {/* Points */}
        <div style={cardStyle}>
          <div style={tierStyle}>积分包</div>
          <div style={priceStyle}><span style={{ fontSize: 18, marginTop: 8 }}>$</span>2.9</div>
          <div style={perStyle}>起 / 次购买</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#7A9E7E', marginBottom: 20 }}>免费用户也可购买</div>
          <div style={dividerStyle} />
          {['100 积分 = $2.9','1 次食谱生成 = 10 积分','1 次周计划 = 50 积分','积分永不过期','签到/分享赚积分'].map(f => <Feature key={f} text={f} />)}
          <button onClick={() => document.getElementById('points')?.scrollIntoView({ behavior: 'smooth' })} style={{ ...btnStyle, background: 'transparent', color: '#1C1A16', border: '1px solid rgba(28,26,22,0.12)' }}>查看积分详情</button>
        </div>
      </div>
    </div>
  )
}

function Feature({ text, featured }: { text: string; featured?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, marginBottom: 10, color: featured ? 'rgba(253,250,245,0.75)' : 'rgba(28,26,22,0.6)' }}>
      <span style={{ color: featured ? '#D4A843' : '#7A9E7E', flexShrink: 0 }}>✓</span>
      {text}
    </div>
  )
}

const cardStyle: React.CSSProperties = { padding: '32px 28px', borderRadius: 20, border: '1px solid rgba(28,26,22,0.12)', background: '#FDFAF5' }
const tierStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(28,26,22,0.6)', marginBottom: 8 }
const priceStyle: React.CSSProperties = { fontFamily: 'Playfair Display, serif', fontSize: 40, fontWeight: 700, lineHeight: 1, marginBottom: 4, display: 'flex', alignItems: 'flex-start', gap: 4 }
const perStyle: React.CSSProperties = { fontSize: 14, fontWeight: 300, color: 'rgba(28,26,22,0.6)', marginBottom: 4 }
const dividerStyle: React.CSSProperties = { height: 1, background: 'rgba(28,26,22,0.1)', margin: '20px 0' }
const btnStyle: React.CSSProperties = { width: '100%', marginTop: 24, padding: 12, borderRadius: 10, fontSize: 15, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit' }
