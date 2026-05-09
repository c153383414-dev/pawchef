'use client'
import { useState, useEffect } from 'react'

const locales = ['en', 'zh', 'es', 'fr', 'ja', 'ko']

export function useLocale() {
  const [locale, setLocale] = useState('en')
  const [messages, setMessages] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Detect language
    const saved = document.cookie
      .split(';')
      .find(c => c.trim().startsWith('pawchef-locale='))
      ?.split('=')[1]?.trim()

    let detected = 'en'
    if (saved && locales.includes(saved)) {
      detected = saved
    } else {
      const browserLang = navigator.language.toLowerCase().split('-')[0]
      if (locales.includes(browserLang)) detected = browserLang
    }

    setLocale(detected)

    // Load messages
    import(`../messages/${detected}.json`)
      .then(mod => {
        setMessages(mod.default)
        setLoading(false)
      })
      .catch(() => {
        import('../messages/en.json').then(mod => {
          setMessages(mod.default)
          setLoading(false)
        })
      })
  }, [])

  // Translation function with fallback
  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.')
    let value: any = messages
    for (const k of keys) {
      value = value?.[k]
      if (value === undefined) return key
    }
    if (typeof value !== 'string') return key
    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
    }
    return value
  }

  return { locale, t, loading, messages }
}
