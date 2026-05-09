import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

const locales = ['en', 'zh', 'es', 'fr', 'ja', 'ko']

function detectLocale(): string {
  try {
    const cookieStore = cookies()
    const saved = cookieStore.get('pawchef-locale')?.value
    if (saved && locales.includes(saved)) return saved
  } catch {}
  try {
    const headersList = headers()
    const acceptLang = headersList.get('accept-language') || ''
    for (const part of acceptLang.split(',')) {
      const lang = part.split(';')[0].trim().toLowerCase().split('-')[0]
      if (locales.includes(lang)) return lang
    }
  } catch {}
  return 'en'
}

export default getRequestConfig(async () => {
  const locale = detectLocale()
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  }
})

export { locales }