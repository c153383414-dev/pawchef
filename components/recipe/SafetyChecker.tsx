'use client'
import { useState } from 'react'
import { SAFETY_DB as safetyDB } from '@/lib/safety-db'

interface Props {
  t: (key: string, params?: Record<string, string | number>) => string
}

export default function SafetyChecker({ t }: Props) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<any>(null)

  const check = () => {
    if (!query.trim()) return
    const key = query.trim().toLowerCase()
    const entries = Object.values(safetyDB)
    const found = entries.find((item: any) =>
      item.name.toLowerCase().includes(key)
    )
    if (found) {
      setResult(found)
    } else {
      setResult({ name: query, level: 'unknown' })
    }
  }

  const levelConfig = {
    safe: { color: '#3B6D11', bg: '#EAF3DE', label: t('safety.safe'), icon: '✅' },
    caution: { color: '#854F0B', bg: '#FBF0E4', label: t('safety.caution'), icon: '⚠️' },
    danger: { color: '#A32D2D', bg: '#FCEBEB', label: t('safety.danger'), icon: '❌' },
    unknown: { color: '#185FA5', bg: '#E6F1FB', label: t('safety.unknownTitle'), icon: '❓' },
  }

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A9E7E', marginBottom: 12 }}>
          {t('safety.sectionLabel')}
        </div>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(26px,4vw,38px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>
          {t('safety.title')}
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(28,26,22,0.6)', fontWeight: 300, maxWidth: 500, margin: '0 auto' }}>
          {t('safety.subtitle')}
        </p>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
        {(['safe', 'caution', 'danger'] as const).map(level => (
          <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: levelConfig[level].bg, fontSize: 12, fontWeight: 500, color: levelConfig[level].color }}>
            {levelConfig[level].icon} {levelConfig[level].label.split('·')[0].trim()}
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 10, maxWidth: 480, margin: '0 auto 28px' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && check()}
          placeholder={t('safety.placeholder')}
          style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(28,26,22,0.15)', background: '#FDFAF5', fontFamily: 'inherit', fontSize: 15, outline: 'none' }}
        />
        <button onClick={check} style={{ padding: '12px 24px', borderRadius: 10, background: '#1C1A16', color: '#FDFAF5', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 500, fontFamily: 'inherit' }}>
          {t('safety.checkBtn')}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div style={{ maxWidth: 480, margin: '0 auto', padding: 20, borderRadius: 16, background: levelConfig[result.level as keyof typeof levelConfig]?.bg || '#F7F3EC', border: `1px solid ${levelConfig[result.level as keyof typeof levelConfig]?.color || '#ccc'}30` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 28 }}>{levelConfig[result.level as keyof typeof levelConfig]?.icon || '❓'}</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{result.name}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: levelConfig[result.level as keyof typeof levelConfig]?.color }}>
                {result.level === 'unknown'
                  ? t('safety.unknownTitle')
                  : result.level === 'safe'
                  ? t('safety.safeTitle')
                  : result.level === 'caution'
                  ? t('safety.cautionTitle')
                  : t('safety.dangerTitle')}
              </div>
            </div>
          </div>

          {result.level === 'unknown' ? (
            <p style={{ fontSize: 13, color: 'rgba(28,26,22,0.6)', lineHeight: 1.6 }}>
              {t('safety.unknownMsg', { name: result.name })}
            </p>
          ) : (
            <>
              {result.notes && <p style={{ fontSize: 13, color: 'rgba(28,26,22,0.7)', lineHeight: 1.6, marginBottom: 8 }}>{result.notes}</p>}
              {result.kidneyNote && (
                <p style={{ fontSize: 12, color: '#854F0B', lineHeight: 1.6 }}>
                  {t('safety.kidneyWarning')} {result.kidneyNote}
                </p>
              )}
              {result.pancreatitisNote && (
                <p style={{ fontSize: 12, color: '#A32D2D', lineHeight: 1.6 }}>
                  {t('safety.pancreatitisWarning')} {result.pancreatitisNote}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Quick check grid */}
      <div style={{ marginTop: 40 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(28,26,22,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', marginBottom: 16 }}>
          {t('safety.quickCheck')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {['Chicken', 'Salmon', 'Broccoli', 'Onion', 'Grapes', 'Blueberry', 'Xylitol', 'Pumpkin', 'Egg', 'Chocolate'].map(item => (
            <button key={item} onClick={() => { setQuery(item); setTimeout(check, 100) }} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13,
              border: '1px solid rgba(28,26,22,0.12)', background: '#FDFAF5',
              cursor: 'pointer', fontFamily: 'inherit', color: 'rgba(28,26,22,0.7)',
              transition: 'all 0.2s'
            }}>{item}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
