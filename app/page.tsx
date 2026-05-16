'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-client'
import AuthModal from '@/components/auth/AuthModal'
import RecipeDemo from '@/components/recipe/RecipeDemo'
import MealPlan from '@/components/recipe/MealPlan'
import SafetyChecker from '@/components/recipe/SafetyChecker'
import PricingSection from '@/components/ui/PricingSection'
import PointsSection from '@/components/ui/PointsSection'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { useLocale } from '@/hooks/useLocale'
import type { Profile } from '@/types'

// ─── Pro membership chip with custom hover tooltip ───────────────────────────
function ProNavChip({ user, t }: { user: Profile; t: (k: string, p?: Record<string, string | number>) => string }) {
  const [hover, setHover] = useState(false)
  const expiresAt = user.pro_expires_at ? new Date(user.pro_expires_at) : null
  const daysLeft = expiresAt
    ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  const expiringSoon = daysLeft !== null && daysLeft <= 7
  const expiryDateStr = expiresAt
    ? expiresAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : null
  const tooltipText = expiryDateStr
    ? (expiringSoon
        ? t('nav.expiringSoonTip') + '\n' + t('nav.expiresOn', { date: expiryDateStr })
        : t('nav.expiresOn', { date: expiryDateStr }))
    : ''

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Chip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderRadius: 20,
        border: `1px solid ${expiringSoon ? '#F5A623' : 'rgba(200,129,58,0.25)'}`,
        background: expiringSoon ? '#FFF8E8' : '#FFFBF5',
        overflow: 'hidden', cursor: 'default',
        boxShadow: expiringSoon ? '0 0 0 2px rgba(245,166,35,0.15)' : 'none',
      }}>
        {/* Avatar circle */}
        <div style={{
          width: 30, height: 30, flexShrink: 0,
          background: '#1C1A16', color: '#FDFAF5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, userSelect: 'none',
        }}>
          {(user.display_name || user.email || '?').charAt(0).toUpperCase()}
        </div>
        {/* PRO badge + days */}
        <div style={{ padding: '0 8px', height: 30, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            padding: '1px 6px', borderRadius: 8,
            background: expiringSoon ? '#F5A623' : '#C8813A',
            color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
          }}>
            {t('nav.proBadge')}
          </span>
          {daysLeft !== null && (
            <>
              <span style={{ width: 1, height: 12, background: 'rgba(28,26,22,0.12)', display: 'inline-block' }} />
              <span style={{
                fontSize: 11, fontWeight: expiringSoon ? 700 : 400,
                color: expiringSoon ? '#C45C5C' : '#A06520',
              }}>
                {expiringSoon && '⚠️ '}{t('nav.daysLeft', { days: daysLeft })}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Custom tooltip */}
      {hover && tooltipText && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          background: '#1C1A16', color: '#FDFAF5',
          fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre',
          padding: '7px 12px', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          zIndex: 999, pointerEvents: 'none',
        }}>
          {tooltipText}
          {/* Arrow */}
          <div style={{
            position: 'absolute', top: -5, right: 14,
            width: 10, height: 10,
            background: '#1C1A16',
            transform: 'rotate(45deg)',
            borderRadius: 2,
          }} />
        </div>
      )}
    </div>
  )
}

export default function HomePage() {
  const [user, setUser] = useState<Profile | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login')
  const { locale, t, loading } = useLocale()
  const supabaseRef = useRef(createClient())
  const explicitSignOut = useRef(false)

  const profileFromAuth = (authUser: any, dbProfile: any): Profile => ({
    id: authUser.id,
    email: authUser.email || '',
    display_name: dbProfile?.display_name || authUser.user_metadata?.display_name || authUser.email?.split('@')[0] || '',
    is_pro: dbProfile?.is_pro ?? false,
    pro_expires_at: dbProfile?.pro_expires_at ?? null,
    points: dbProfile?.points ?? 0,
    free_points: dbProfile?.free_points ?? 20,
    paid_points: dbProfile?.paid_points ?? 0,
    gift_ai_points: dbProfile?.gift_ai_points ?? 0,
    monthly_ai_count: dbProfile?.monthly_ai_count ?? 0,
    count_reset_at: dbProfile?.count_reset_at ?? null,
    last_checkin_date: dbProfile?.last_checkin_date ?? null,
    created_at: dbProfile?.created_at ?? new Date().toISOString(),
    free_ai_used:  dbProfile?.free_ai_used  ?? 0,
    free_ai_limit: dbProfile?.free_ai_limit ?? 2,
  })

  useEffect(() => {
    const sb = supabaseRef.current

    // onAuthStateChange fires INITIAL_SESSION immediately from localStorage
    // without waiting for a network call, so the user is set right away on refresh.
    const { data: authData } = sb.auth.onAuthStateChange((event: string, session: any) => {
      if (session?.user) {
        // Set user immediately from session so the page shows logged-in state
        // without waiting for any network call.
        setUser(prev => prev?.id === session.user.id ? prev : profileFromAuth(session.user, null))
        // Then update with DB profile data in the background.
        sb.from('profiles').select('*').eq('id', session.user.id).single().then(({ data: profile }: { data: any }) => {
          if (profile) setUser(profileFromAuth(session.user, profile))
        })
      } else if (event === 'SIGNED_OUT' && explicitSignOut.current) {
        explicitSignOut.current = false
        setUser(null)
      }
    })

    return () => authData.subscription.unsubscribe()
  }, [])

  const openAuth = (tab: 'login' | 'signup') => {
    setAuthTab(tab)
    setAuthOpen(true)
  }

  const logout = async () => {
    explicitSignOut.current = true
    await supabaseRef.current.auth.signOut()
    setUser(null)
  }

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const handlePointsUpdated = (freePoints: number, paidPoints: number) => {
    setUser(u => u ? { ...u, free_points: freePoints, paid_points: paidPoints } : u)
  }

  // Refresh user credits from DB (called after substitution to update nav credit display)
  const refreshUserCredits = async () => {
    const sb = supabaseRef.current
    const { data: { user: authUser } } = await sb.auth.getUser()
    if (!authUser) return
    const { data: profile } = await sb.from('profiles').select('*').eq('id', authUser.id).single()
    if (profile) setUser(profileFromAuth(authUser, profile))
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FDFAF5' }}>
      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: '#C8813A' }}>🐾 PawChef</div>
    </div>
  )

  return (
    <div style={{ background: '#FDFAF5', minHeight: '100vh' }}>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(253,250,245,0.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(28,26,22,0.12)',
        padding: '0 max(24px, 5vw)', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 22 }}>
          🐾 Paw<span style={{ color: '#C8813A' }}>Chef</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => scrollTo('features')} style={navLinkStyle}>{t('nav.features')}</button>
          <button onClick={() => scrollTo('safety')} style={navLinkStyle}>{t('nav.safety')}</button>
          <button onClick={() => scrollTo('pricing')} style={navLinkStyle}>{t('nav.pricing')}</button>

          <LanguageSwitcher currentLocale={locale} />

          {user ? (
            <>
              {/* Credit pills */}
              <button onClick={() => scrollTo('points')} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 8,
                background: '#E6F1FB', color: '#185FA5',
                border: 'none', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit'
              }}>
                💙 {user.free_points ?? 0}
              </button>
              {!user.is_pro && (
                <button onClick={() => scrollTo('points')} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 8,
                  background: '#FBF0E4', color: '#854F0B',
                  border: 'none', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit'
                }}>
                  🟠 {user.paid_points ?? 0}
                </button>
              )}

              {/* Pro membership chip — Western-standard user status indicator */}
              {user.is_pro && <ProNavChip user={user} t={t} />}

              <a href="/dashboard" style={{
                ...btnStyle, background: 'transparent',
                border: '1px solid rgba(28,26,22,0.12)',
                color: '#1C1A16', textDecoration: 'none',
                padding: '7px 16px', borderRadius: 8, fontSize: 14
              }}>{t('nav.dashboard')}</a>
              <button onClick={logout} style={{
                ...btnStyle, background: 'transparent',
                border: '1px solid rgba(28,26,22,0.12)', color: '#1C1A16'
              }}>{t('nav.logout')}</button>
            </>
          ) : (
            <>
              <button onClick={() => openAuth('login')} style={{
                ...btnStyle, background: 'transparent',
                border: '1px solid rgba(28,26,22,0.12)', color: '#1C1A16'
              }}>{t('nav.login')}</button>
              <button onClick={() => scrollTo('demo')} style={{
                ...btnStyle, background: '#1C1A16', color: '#FDFAF5'
              }}>{t('nav.signup')}</button>
            </>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        padding: '140px max(24px,5vw) 80px',
        textAlign: 'center', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 40% at 20% 30%, rgba(122,158,126,0.12) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 80% 70%, rgba(200,129,58,0.1) 0%, transparent 60%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 20, background: '#EBF2EC', color: '#7A9E7E', fontSize: 13, fontWeight: 500, marginBottom: 28 }}>
            ✦ {t('hero.badge')}
          </div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(40px,7vw,80px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 20 }}>
            {t('hero.title')}<br />
            <em style={{ fontStyle: 'italic', color: '#C8813A' }}>{t('hero.titleHighlight')}</em>
          </h1>
          <p style={{ fontSize: 'clamp(16px,2vw,19px)', color: 'rgba(28,26,22,0.6)', maxWidth: 520, margin: '0 auto 16px', fontWeight: 300 }}>
            {t('hero.subtitle')}
          </p>
          {!user && (
            <p style={{ fontSize: 13, color: 'rgba(28,26,22,0.45)', marginBottom: 24 }}>
              {t('hero.freeNote')}
            </p>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => scrollTo('demo')} style={{ padding: '14px 32px', borderRadius: 10, background: '#1C1A16', color: '#FDFAF5', fontSize: 16, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
              {user ? t('hero.ctaLoggedIn') : t('hero.ctaMain')}
            </button>
            <button onClick={() => scrollTo('demo')} style={{ padding: '14px 32px', borderRadius: 10, background: '#FDFAF5', color: '#1C1A16', fontSize: 16, fontWeight: 500, border: '1px solid rgba(28,26,22,0.12)', cursor: 'pointer' }}>
              {t('hero.ctaSecondary')}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center', marginTop: 60, flexWrap: 'wrap' }}>
            {[['60+', t('hero.stat1Label')], ['2', t('hero.stat2Label')], ['6', t('hero.stat3Label')], ['30s', t('hero.stat4Label')]].map(([n, l]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700 }}>{n}</div>
                <div style={{ fontSize: 12, color: 'rgba(28,26,22,0.6)', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div style={{ background: '#1C1A16', color: '#FDFAF5', padding: '14px 0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 48, animation: 'marquee 20s linear infinite', whiteSpace: 'nowrap' }}>
          {['Pet Nutrition', 'Safety Verified', 'Vet Reference', 'AI Recipes', 'Kidney Disease', 'Pancreatitis', 'GDPR', 'Multi-language',
            'Pet Nutrition', 'Safety Verified', 'Vet Reference', 'AI Recipes', 'Kidney Disease', 'Pancreatitis', 'GDPR', 'Multi-language'].map((item, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, opacity: 0.85 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#C8813A', display: 'inline-block' }} />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" style={{ padding: '80px max(24px,5vw)' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A9E7E', marginBottom: 12 }}>{t('features.sectionLabel')}</div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px,4vw,42px)', fontWeight: 700, letterSpacing: '-0.02em' }}>{t('features.sectionTitle')}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
          {[
            { icon: '🤖', bg: '#EBF2EC', titleKey: 'features.f1Title', descKey: 'features.f1Desc' },
            { icon: '🚫', bg: '#FAE8E8', titleKey: 'features.f2Title', descKey: 'features.f2Desc' },
            { icon: '⚕️', bg: '#FBF0E4', titleKey: 'features.f3Title', descKey: 'features.f3Desc' },
            { icon: '🔄', bg: '#EBF2EC', titleKey: 'features.f4Title', descKey: 'features.f4Desc' },
            { icon: '📊', bg: '#FBF0E4', titleKey: 'features.f5Title', descKey: 'features.f5Desc' },
            { icon: '🔍', bg: '#EBF2EC', titleKey: 'features.f6Title', descKey: 'features.f6Desc' },
          ].map(f => (
            <div key={f.titleKey} style={{ padding: 28, borderRadius: 16, border: '1px solid rgba(28,26,22,0.12)', background: '#FDFAF5' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 500, marginBottom: 8 }}>{t(f.titleKey)}</h3>
              <p style={{ fontSize: 14, color: 'rgba(28,26,22,0.6)', lineHeight: 1.65 }}>{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DEMO */}
      <div id="demo" style={{ background: '#F7F3EC', borderRadius: 24, margin: '0 max(24px,5vw)' }}>
        <RecipeDemo user={user} onAuthRequired={(mode) => openAuth(mode ?? 'signup')} locale={locale} t={t} onCreditsUsed={refreshUserCredits} />
      </div>

      {/* MEAL PLAN */}
      <div id="meal-plan" style={{ background: '#F7F3EC', borderRadius: 24, margin: '0 max(24px,5vw) 40px' }}>
        <MealPlan user={user} onAuthRequired={() => openAuth('signup')} t={t} />
      </div>

      {/* SAFETY */}
      <section id="safety" style={{ padding: '80px max(24px,5vw)' }}>
        <SafetyChecker t={t} locale={locale} />
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: '80px max(24px,5vw)' }}>
        <PricingSection onSignup={() => openAuth('signup')} t={t} />
      </section>

      {/* POINTS */}
      <div id="points" style={{ background: '#F7F3EC', borderRadius: 24, margin: '0 max(24px,5vw) 80px' }}>
        <PointsSection user={user} onAuthRequired={() => openAuth('signup')} onPointsUpdated={handlePointsUpdated} t={t} />
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(28,26,22,0.12)', padding: '48px max(24px,5vw) 32px', background: '#F7F3EC' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 40, marginBottom: 40 }}>
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, marginBottom: 10 }}>
              🐾 Paw<span style={{ color: '#C8813A' }}>Chef</span>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(28,26,22,0.6)', lineHeight: 1.6 }}>{t('footer.description')}</p>
          </div>
          {[
            [t('footer.product'), [t('footer.features'), t('footer.safety'), t('footer.pricing'), t('footer.credits')]],
            [t('footer.standards'), [t('footer.aspca'), t('footer.aafco'), t('footer.fediaf')]],
            [t('footer.legal'), [t('footer.privacy'), t('footer.terms'), t('footer.gdpr')]]
          ].map(([title, links]) => (
            <div key={title as string}>
              <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>{title as string}</h4>
              {(links as string[]).map(l => (
                <div key={l} style={{ fontSize: 13, color: 'rgba(28,26,22,0.6)', marginBottom: 8, cursor: 'pointer' }}>{l}</div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(28,26,22,0.12)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'rgba(28,26,22,0.3)' }}>{t('footer.copyright')}</div>
          <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.3)', maxWidth: 500, textAlign: 'right' }}>{t('footer.disclaimer')}</div>
        </div>
      </footer>

      <AuthModal
        open={authOpen}
        tab={authTab}
        onClose={() => setAuthOpen(false)}
        onSuccess={(profile) => { setUser(profile); setAuthOpen(false) }}
        t={t}
      />

      <style>{`
        @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
      `}</style>
    </div>
  )
}

const navLinkStyle: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 8, fontSize: 14,
  color: 'rgba(28,26,22,0.6)', cursor: 'pointer',
  border: 'none', background: 'none', fontFamily: 'inherit'
}
const btnStyle: React.CSSProperties = {
  padding: '8px 20px', borderRadius: 8, fontSize: 14,
  fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit'
}
