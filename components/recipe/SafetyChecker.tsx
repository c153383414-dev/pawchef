'use client'
import { useState } from 'react'

const QUICK = ['洋葱','葡萄','鸡胸肉','巧克力','胡萝卜','大蒜','蓝莓','木糖醇','三文鱼','南瓜']

export default function SafetyChecker() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const check = async (q?: string) => {
    const term = q || query.trim()
    if (!term) return
    setQuery(term)
    setLoading(true)
    try {
      const res = await fetch(`/api/check-ingredient?q=${encodeURIComponent(term)}`)
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ level: 'caution', title: '查询失败', message: '请稍后重试' })
    } finally {
      setLoading(false)
    }
  }

  const levelStyle = (level: string) => ({
    safe: { bg: '#EBF2EC', color: '#7A9E7E', icon: '✅' },
    caution: { bg: '#FBF0E4', color: '#C8813A', icon: '⚠️' },
    danger: { bg: '#FAE8E8', color: '#C45C5C', icon: '🚫' },
  }[level] || { bg: '#FBF0E4', color: '#C8813A', icon: '🔍' })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 48, alignItems: 'start' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A9E7E', marginBottom: 12 }}>食材安全速查</div>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(26px,3.5vw,38px)', fontWeight: 700, lineHeight: 1.2, marginBottom: 16 }}>
          任何食材，<br />3秒知道安不安全
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(28,26,22,0.6)', fontWeight: 300, lineHeight: 1.7, marginBottom: 24 }}>
          无需登录，直接查询。<br />基于 ASPCA 官方毒物数据库，实时返回安全等级
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[['#7A9E7E','安全 · 可正常喂食'],['#C8813A','慎用 · 需控量或处理'],['#C45C5C','禁止 · 有毒严禁喂食']].map(([c,l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'rgba(28,26,22,0.6)' }}>
              <span style={{ color: c, fontSize: 10 }}>●</span> {l}
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#FDFAF5', borderRadius: 16, border: '1px solid rgba(28,26,22,0.12)', padding: 24, boxShadow: '0 2px 16px rgba(28,26,22,0.04)' }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>快速查询</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {QUICK.map(q => (
            <button key={q} onClick={() => check(q)} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid rgba(28,26,22,0.12)', background: '#F7F3EC', fontFamily: 'inherit', transition: '0.2s' }}>
              {q}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && check()}
            placeholder="输入食材名称…"
            style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(28,26,22,0.12)', fontFamily: 'inherit', fontSize: 14, background: '#F7F3EC', outline: 'none' }}
          />
          <button onClick={() => check()} disabled={loading} style={{ padding: '10px 18px', borderRadius: 8, background: '#1C1A16', color: '#FDFAF5', border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            {loading ? '…' : '查询'}
          </button>
        </div>

        {result && (() => {
          const s = levelStyle(result.level)
          return (
            <div style={{ padding: 14, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4, color: '#1C1A16' }}>{query} · {result.title}</div>
                <p style={{ fontSize: 13, color: 'rgba(28,26,22,0.7)', lineHeight: 1.55, margin: 0 }}>{result.message}</p>
                {result.kidneyWarning && <p style={{ fontSize: 12, color: '#C8813A', marginTop: 6, margin: 0 }}>🫘 肾病提示：{result.kidneyWarning}</p>}
                {result.pancreatitisWarning && <p style={{ fontSize: 12, color: '#C45C5C', marginTop: 4, margin: 0 }}>🔥 胰腺炎提示：{result.pancreatitisWarning}</p>}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
