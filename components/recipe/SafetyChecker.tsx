'use client'
import { useState } from 'react'

interface Props {
  t: (key: string, params?: Record<string, string | number>) => string
  locale: string
}

// Quick items: English search key (matches DB aliases) + translation key for displayed label
const QUICK_ITEMS = [
  { search: 'Chicken',   labelKey: 'safety.qi.chicken' },
  { search: 'Salmon',    labelKey: 'safety.qi.salmon' },
  { search: 'Broccoli',  labelKey: 'safety.qi.broccoli' },
  { search: 'Onion',     labelKey: 'safety.qi.onion' },
  { search: 'Grapes',    labelKey: 'safety.qi.grapes' },
  { search: 'Blueberry', labelKey: 'safety.qi.blueberry' },
  { search: 'Xylitol',   labelKey: 'safety.qi.xylitol' },
  { search: 'Pumpkin',   labelKey: 'safety.qi.pumpkin' },
  { search: 'Egg',       labelKey: 'safety.qi.egg' },
  { search: 'Chocolate', labelKey: 'safety.qi.chocolate' },
]

export default function SafetyChecker({ t, locale }: Props) {
  const [query, setQuery]           = useState('')
  const [displayName, setDisplayName] = useState('')  // shown in result card
  const [result, setResult]         = useState<any>(null)
  const [loading, setLoading]       = useState(false)

  /** Call the server-side API which handles multilingual aliases + translation */
  const check = async (searchTerm: string, label?: string) => {
    const q = searchTerm.trim()
    if (!q) return

    setDisplayName(label ?? q)
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch(
        `/api/safety-check?q=${encodeURIComponent(q)}&locale=${encodeURIComponent(locale)}`
      )
      const data = await res.json()
      setResult(data ?? { level: 'unknown' })
    } catch {
      setResult({ level: 'unknown' })
    } finally {
      setLoading(false)
    }
  }

  const handleManualCheck = () => check(query)

  const levelConfig = {
    safe:    { color: '#3B6D11', bg: '#EAF3DE', icon: '✅' },
    caution: { color: '#854F0B', bg: '#FBF0E4', icon: '⚠️' },
    danger:  { color: '#A32D2D', bg: '#FCEBEB', icon: '❌' },
    unknown: { color: '#185FA5', bg: '#E6F1FB', icon: '❓' },
  }

  const cfg = result
    ? (levelConfig[result.level as keyof typeof levelConfig] ?? levelConfig.unknown)
    : null

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
            {levelConfig[level].icon} {t(`safety.${level}`).split('·')[0].trim()}
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 10, maxWidth: 480, margin: '0 auto 28px' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleManualCheck()}
          placeholder={t('safety.placeholder')}
          style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(28,26,22,0.15)', background: '#FDFAF5', fontFamily: 'inherit', fontSize: 15, outline: 'none' }}
        />
        <button
          onClick={handleManualCheck}
          disabled={loading}
          style={{ padding: '12px 24px', borderRadius: 10, background: loading ? 'rgba(28,26,22,0.3)' : '#1C1A16', color: '#FDFAF5', border: 'none', cursor: loading ? 'wait' : 'pointer', fontSize: 15, fontWeight: 500, fontFamily: 'inherit' }}>
          {loading ? '…' : t('safety.checkBtn')}
        </button>
      </div>

      {/* Result */}
      {(result || loading) && (
        <div style={{ maxWidth: 480, margin: '0 auto', padding: 20, borderRadius: 16, background: cfg?.bg ?? '#F7F3EC', border: `1px solid ${cfg?.color ?? '#ccc'}30`, minHeight: 80 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'rgba(28,26,22,0.4)', paddingTop: 12 }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>🔍</div>
              <div style={{ fontSize: 13 }}>{displayName} …</div>
            </div>
          ) : result && cfg && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>{cfg.icon}</span>
                <div>
                  {/* Show user's search term, NOT the Chinese DB name */}
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{displayName}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: cfg.color }}>
                    {result.level === 'unknown'   ? t('safety.unknownTitle')
                     : result.level === 'safe'    ? t('safety.safeTitle')
                     : result.level === 'caution' ? t('safety.cautionTitle')
                     :                              t('safety.dangerTitle')}
                  </div>
                </div>
              </div>

              {result.level === 'unknown' ? (
                <p style={{ fontSize: 13, color: 'rgba(28,26,22,0.6)', lineHeight: 1.6 }}>
                  {t('safety.unknownMsg', { name: displayName })}
                </p>
              ) : (
                <>
                  {result.message && (
                    <p style={{ fontSize: 13, color: 'rgba(28,26,22,0.7)', lineHeight: 1.6, marginBottom: 8 }}>
                      {result.message}
                    </p>
                  )}
                  {result.kidneyWarning && (
                    <p style={{ fontSize: 12, color: '#854F0B', lineHeight: 1.6 }}>
                      {t('safety.kidneyWarning')} {result.kidneyWarning}
                    </p>
                  )}
                  {result.pancreatitisWarning && (
                    <p style={{ fontSize: 12, color: '#A32D2D', lineHeight: 1.6 }}>
                      {t('safety.pancreatitisWarning')} {result.pancreatitisWarning}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Quick check grid — labels translated, search always uses English alias */}
      <div style={{ marginTop: 40 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(28,26,22,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', marginBottom: 16 }}>
          {t('safety.quickCheck')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {QUICK_ITEMS.map(({ search, labelKey }) => {
            const label = t(labelKey)
            return (
              <button
                key={search}
                onClick={() => { setQuery(label); check(search, label) }}
                disabled={loading}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 13,
                  border: '1px solid rgba(28,26,22,0.12)', background: '#FDFAF5',
                  cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
                  color: 'rgba(28,26,22,0.7)', transition: 'all 0.2s'
                }}>
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
