import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const locales = ['en', 'zh', 'es', 'fr', 'ja', 'ko']

function getLocale(request: NextRequest): string {
  // 1. Cookie (user manual selection)
  const saved = request.cookies.get('pawchef-locale')?.value
  if (saved && locales.includes(saved)) return saved

  // 2. Accept-Language header
  const acceptLang = request.headers.get('accept-language') || ''
  for (const part of acceptLang.split(',')) {
    const lang = part.split(';')[0].trim().toLowerCase().split('-')[0]
    if (locales.includes(lang)) return lang
  }

  return 'en'
}

export async function middleware(request: NextRequest) {
  // Set locale header for next-intl
  const locale = getLocale(request)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-locale', locale)

  let response = NextResponse.next({
    request: { headers: requestHeaders }
  })

  // Supabase session refresh
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: { headers: requestHeaders }
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
