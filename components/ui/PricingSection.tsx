'use client'
import { useState } from 'react'

export default function PricingSection({ onSignup }: { onSignup: () => void }) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A9E7E', marginBottom: 12 }}>透明定价</div>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px,4vw,42px)', fontWeight: 700, letterSpacing: '-0.02em' }}>
          为你的宠物值得
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(28,26,22,0.6)', marginTop: 12, fontWeight: 300 }}>
          随时取消 · 无隐藏费用 · 每天只需 $0.50
        </p>

        {/* 月付/年付切换，年付为默认 */}
        <div style={{ display: 'inline-flex', gap: 4, background: '#F7F3EC', padding: 4, borderRadius: 10, marginTop: 20 }}>
          {(['monthly', 'annual'] as const).map(b => (
            <button key={b} onClick={() => setBilling(b)} style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500,
              cursor: 'pointer', border: 'none', fontFamily: 'inherit',
              background: billing === b ? '#FDFAF5' : 'transparent',
              color: billing === b ? '#1C1A16' : 'rgba(28,26,22,0.6)',
              boxShadow: billing === b ? '0 1px 4px rgba(28,26,22,.1)' : 'none'
            }}>
              {b === 'monthly' ? '月付' : (
                <span>年付 <span style={{ color: '#7A9E7E', fontSize: 12 }}>省45%</span></span>
              )}
            </button>
          ))}
        </div>
        {billing === 'annual' && (
          <div style={{ marginTop: 8, fontSize: 13, color: '#7A9E7E' }}>
            💚 年付用户省 $80.1/年，且享受更高月次数
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, maxWidth: 1000, margin: '0 auto' }}>

        {/* 免费版 */}
        <div style={cardStyle}>
          <div style={tierStyle}>免费版</div>
          <div style={priceWrap}>
            <span style={currStyle}>$</span>
            <span style={numStyle}>0</span>
          </div>
          <div style={perStyle}>永久免费</div>
          <div style={divStyle} />
          <div style={secLabel}>静态内容（零AI成本）</div>
          {['预置食谱库 100+ 份', '食材安全查询（无限）', '危险食材警报', '营养知识文章'].map(f => <Feature key={f} text={f} />)}
          <div style={secLabel}>免费积分功能</div>
          {['签到/分享/邀请赚取 💙免费积分', '积分解锁额外收藏位', '积分导出饮食日志PDF'].map(f => <Feature key={f} text={f} color="#185FA5" />)}
          <div style={secLabel}>AI功能</div>
          <Feature text="AI生成需购买🟠AI积分包" color="#854F0B" />
          <button onClick={onSignup} style={{ ...btnStyle, background: 'transparent', color: '#1C1A16', border: '1px solid rgba(28,26,22,0.15)', marginTop: 24 }}>
            免费开始
          </button>
        </div>

        {/* Pro 订阅（默认年付） */}
        <div style={{ ...cardStyle, background: '#1C1A16', color: '#FDFAF5', position: 'relative', border: '1.5px solid #1C1A16' }}>
          <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#C8813A', color: '#fff', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
            🔥 最受欢迎
          </div>
          <div style={{ ...tierStyle, color: 'rgba(253,250,245,0.5)' }}>Pro 订阅</div>
          <div style={priceWrap}>
            <span style={{ ...currStyle, color: '#FDFAF5' }}>$</span>
            <span style={{ ...numStyle, color: '#FDFAF5' }}>
              {billing === 'monthly' ? '14.9' : '8.25'}
            </span>
          </div>
          <div style={{ ...perStyle, color: 'rgba(253,250,245,0.6)' }}>
            {billing === 'monthly' ? '/ 月 · 随时取消' : '/ 月 · 年付 $99 · 省$80.1'}
          </div>
          {billing === 'annual' && (
            <div style={{ fontSize: 12, color: '#D4A843', marginBottom: 8 }}>
              💚 比月付省 $80.1/年
            </div>
          )}
          <div style={{ ...divStyle, background: 'rgba(253,250,245,0.15)' }} />
          <div style={{ ...secLabel, color: 'rgba(253,250,245,0.4)' }}>AI功能（月次数限额）</div>
          <Feature text={`AI食谱生成 ${billing === 'monthly' ? '30' : '60'}次/月`} featured />
          <Feature text={`食材替换建议 ${billing === 'monthly' ? '20' : '40'}次/月`} featured />
          <Feature text={`7天周计划 ${billing === 'monthly' ? '2' : '4'}次/月`} featured />
          <Feature text="病宠营养参考模式" featured />
          <div style={{ ...secLabel, color: 'rgba(253,250,245,0.4)' }}>增值功能（零AI成本）</div>
          <Feature text="5只宠物档案" featured />
          <Feature text="食谱无限收藏" featured />
          <Feature text="营养饮食日志无限导出" featured />
          <Feature text={`每月赠 ${billing === 'monthly' ? '50' : '100'} 🟠AI积分（当月有效）`} featured />
          <button onClick={onSignup} style={{ ...btnStyle, background: '#FDFAF5', color: '#1C1A16', marginTop: 24 }}>
            立即订阅 Pro
          </button>
          <div style={{ fontSize: 11, color: 'rgba(253,250,245,0.4)', textAlign: 'center', marginTop: 8 }}>
            超出次数后可用🟠AI积分继续
          </div>
        </div>

        {/* 积分包 */}
        <div style={cardStyle}>
          <div style={tierStyle}>🟠 AI积分包</div>
          <div style={{ fontSize: 13, color: 'rgba(28,26,22,0.6)', marginBottom: 16, lineHeight: 1.6 }}>
            不订阅也能用AI<br />单次比订阅贵，适合轻度用户
          </div>
          <div style={divStyle} />

          {[
            { pts: 10, price: 6.9, per: 0.69, label: '入门包' },
            { pts: 30, price: 17.9, per: 0.60, label: '热销包', best: true },
            { pts: 60, price: 32.9, per: 0.55, label: '标准包' },
          ].map(p => (
            <div key={p.pts} onClick={onSignup} style={{
              padding: '12px 14px', borderRadius: 12, marginBottom: 8, cursor: 'pointer',
              background: p.best ? '#FBF0E4' : '#F7F3EC',
              border: `1px solid ${p.best ? '#EF9F27' : 'rgba(28,26,22,0.1)'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              position: 'relative'
            }}>
              {p.best && (
                <div style={{ position: 'absolute', top: -8, left: 12, background: '#EF9F27', color: '#fff', fontSize: 10, padding: '1px 8px', borderRadius: 8, fontWeight: 500 }}>最超值</div>
              )}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.label} · {p.pts}🟠</div>
                <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.5)' }}>{p.pts}次AI生成 · ${p.per}/次</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#854F0B' }}>${p.price}</div>
            </div>
          ))}

          <div style={{ padding: '10px 12px', background: '#E6F1FB', borderRadius: 10, fontSize: 12, color: '#185FA5', marginTop: 8 }}>
            💙 免费积分不能用于AI功能<br />
            🟠 AI积分永不过期，调用失败自动退还
          </div>

          <div style={divStyle} />
          <div style={{ ...secLabel, marginTop: 0 }}>对比订阅</div>
          <div style={{ fontSize: 12, color: 'rgba(28,26,22,0.6)', lineHeight: 1.8 }}>
            积分包单次：$0.55~$0.69<br />
            Pro月付单次：$0.50（30次）<br />
            Pro年付单次：$0.14（60次）<br />
            <span style={{ color: '#7A9E7E', fontWeight: 500 }}>→ 重度用户订阅更划算</span>
          </div>

          <button onClick={onSignup} style={{ ...btnStyle, background: 'transparent', color: '#1C1A16', border: '1px solid rgba(28,26,22,0.15)', marginTop: 20 }}>
            登录后购买
          </button>
        </div>

      </div>

      {/* 底部说明 */}
      <div style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: 'rgba(28,26,22,0.4)', lineHeight: 1.8 }}>
        ⚠️ 所有内容为AI生成，仅供参考，不替代专业兽医建议<br />
        所有价格含税，支持 Visa / Mastercard · Stripe 安全支付
      </div>
    </div>
  )
}

function Feature({ text, featured, color }: { text: string; featured?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, marginBottom: 8, color: featured ? 'rgba(253,250,245,0.8)' : color || 'rgba(28,26,22,0.6)' }}>
      <span style={{ color: featured ? '#D4A843' : color || '#7A9E7E', flexShrink: 0, marginTop: 1 }}>✓</span>
      {text}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  padding: '32px 24px', borderRadius: 20,
  border: '1px solid rgba(28,26,22,0.12)',
  background: '#FDFAF5'
}
const tierStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'rgba(28,26,22,0.5)', marginBottom: 10
}
const priceWrap: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 3, marginBottom: 4
}
const currStyle: React.CSSProperties = { fontSize: 18, marginTop: 8, color: '#1C1A16' }
const numStyle: React.CSSProperties = {
  fontFamily: 'Playfair Display, serif',
  fontSize: 40, fontWeight: 700, lineHeight: 1, color: '#1C1A16'
}
const perStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 300, color: 'rgba(28,26,22,0.6)', marginBottom: 4
}
const divStyle: React.CSSProperties = {
  height: 1, background: 'rgba(28,26,22,0.08)', margin: '16px 0'
}
const secLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'rgba(28,26,22,0.35)',
  marginBottom: 8, marginTop: 4
}
const btnStyle: React.CSSProperties = {
  width: '100%', padding: 12, borderRadius: 10,
  fontSize: 15, fontWeight: 500, cursor: 'pointer',
  border: 'none', fontFamily: 'inherit'
}
