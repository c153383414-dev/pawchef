'use client'
import { useState, useRef, useEffect } from 'react'

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
]

interface Props {
  currentLocale: string
}

export default function LanguageSwitcher({ currentLocale }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = LANGUAGES.find(l => l.code === currentLocale) || LANGUAGES[0]

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const switchLanguage = (code: string) => {
    // Save to cookie
    document.cookie = `pawchef-locale=${code};path=/;max-age=31536000`
    setOpen(false)
    // Reload to apply new language
    window.location.reload()
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8,
          background: 'rgba(28,26,22,0.06)',
          border: '1px solid rgba(28,26,22,0.12)',
          cursor: 'pointer', fontSize: 13, fontWeight: 500,
          fontFamily: 'inherit', color: 'rgba(28,26,22,0.7)',
          transition: 'all 0.2s'
        }}
      >
        <span>{current.flag}</span>
        <span>{current.label}</span>
        <span style={{ fontSize: 10, opacity: 0.5 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          background: '#FDFAF5', borderRadius: 12,
          border: '1px solid rgba(28,26,22,0.12)',
          boxShadow: '0 8px 24px rgba(28,26,22,0.12)',
          zIndex: 200, minWidth: 160, overflow: 'hidden'
        }}>
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => switchLanguage(lang.code)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 14px',
                background: lang.code === currentLocale ? '#F7F3EC' : 'transparent',
                border: 'none', cursor: 'pointer', fontSize: 13,
                fontFamily: 'inherit', color: '#1C1A16',
                textAlign: 'left', transition: 'background 0.15s'
              }}
            >
              <span style={{ fontSize: 16 }}>{lang.flag}</span>
              <span>{lang.label}</span>
              {lang.code === currentLocale && (
                <span style={{ marginLeft: 'auto', color: '#7A9E7E', fontSize: 12 }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
