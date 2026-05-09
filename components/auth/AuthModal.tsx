'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import type { Profile } from '@/types'

interface Props {
  open: boolean
  tab: 'login' | 'signup'
  onClose: () => void
  onSuccess: (profile: Profile) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

export default function AuthModal({ open, tab, onClose, onSuccess, t }: Props) {
  const [activeTab, setActiveTab] = useState(tab)
  const [showReset, setShowReset] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [name, setName] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  if (!open) return null

  const handleAuth = async () => {
    setMsg(null)
    if (!email || !email.includes('@')) return setMsg({ type: 'error', text: t('auth.errors.invalidEmail') })
    if (password.length < 8) return setMsg({ type: 'error', text: t('auth.errors.passwordLength') })
    setLoading(true)

    if (activeTab === 'signup') {
      if (!name) { setLoading(false); return setMsg({ type: 'error', text: t('auth.errors.nicknamRequired') }) }
      if (password !== confirm) { setLoading(false); return setMsg({ type: 'error', text: t('auth.errors.passwordMismatch') }) }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { display_name: name } }
      })
      setLoading(false)
      if (error) return setMsg({ type: 'error', text: error.message })
      setMsg({ type: 'success', text: t('auth.success.signupOk', { email }) })
    } else {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        setLoading(false)
        if (error) return setMsg({ type: 'error', text: t('auth.errors.loginFailed') })
        if (!data?.user) return setMsg({ type: 'error', text: t('auth.errors.loginFailed') })
        
        // 直接关闭弹窗，让 onAuthStateChange 处理 profile 读取
        onSuccess({
          id: data.user.id,
          email: data.user.email || '',
          display_name: data.user.user_metadata?.display_name || data.user.email?.split('@')[0] || '',
          is_pro: false,
          pro_expires_at: null,
          points: 0,
          free_points: 20,
          paid_points: 0,
          gift_ai_points: 0,
          monthly_ai_count: 0,
          count_reset_at: null,
          last_checkin_date: null,
          created_at: new Date().toISOString()
        })
      } catch (e) {
        setLoading(false)
        setMsg({ type: 'error', text: 'Network error, please retry' })
      }
    }
  }




  
  const handleReset = async () => {
    if (!resetEmail.includes('@')) return setMsg({ type: 'error', text: t('auth.errors.validEmail') })
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })
    setMsg({ type: 'success', text: t('auth.success.resetSent') })
    setLoading(false)
  }

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(28,26,22,0.5)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{ background: '#FDFAF5', borderRadius: 20, width: '100%', maxWidth: 400, padding: 36, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 8, background: '#F7F3EC', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>

        {!showReset ? (
          <>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
              {activeTab === 'login' ? t('auth.welcomeBack') : t('auth.createAccount')}
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(28,26,22,0.6)', marginBottom: 24 }}>
              {activeTab === 'login' ? t('auth.loginSubtitle') : t('auth.signupSubtitle')}
            </p>

            <div style={{ display: 'flex', gap: 4, background: '#F7F3EC', padding: 4, borderRadius: 10, marginBottom: 24 }}>
              {(['login', 'signup'] as const).map(tabKey => (
                <button key={tabKey} onClick={() => { setActiveTab(tabKey); setMsg(null) }} style={{
                  flex: 1, padding: '8px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                  cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                  background: activeTab === tabKey ? '#FDFAF5' : 'transparent',
                  color: activeTab === tabKey ? '#1C1A16' : 'rgba(28,26,22,0.6)',
                  boxShadow: activeTab === tabKey ? '0 1px 4px rgba(28,26,22,.1)' : 'none'
                }}>
                  {tabKey === 'login' ? t('auth.login') : t('auth.signup')}
                </button>
              ))}
            </div>

            {msg && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13,
                background: msg.type === 'success' ? '#EBF2EC' : msg.type === 'error' ? '#FAE8E8' : '#FBF0E4',
                color: msg.type === 'success' ? '#7A9E7E' : msg.type === 'error' ? '#C45C5C' : '#C8813A'
              }}>{msg.text}</div>
            )}

            {activeTab === 'signup' && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('auth.nickname')}</label>
                <input style={inputStyle} placeholder={t('auth.nickname')} value={name} onChange={e => setName(e.target.value)} />
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t('auth.email')}</label>
              <input style={inputStyle} type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div style={{ marginBottom: activeTab === 'signup' ? 16 : 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>{t('auth.password')}</label>
                {activeTab === 'login' && (
                  <span onClick={() => { setShowReset(true); setMsg(null) }} style={{ fontSize: 12, color: '#7A9E7E', cursor: 'pointer' }}>
                    {t('auth.forgotPassword')}
                  </span>
                )}
              </div>
              <input style={inputStyle} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()} />
            </div>
            {activeTab === 'signup' && (
              <div style={{ marginBottom: 8 }}>
                <label style={labelStyle}>{t('auth.confirmPassword')}</label>
                <input style={inputStyle} type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()} />
              </div>
            )}

            <button onClick={handleAuth} disabled={loading} style={{
              width: '100%', padding: 12, borderRadius: 10, background: '#1C1A16', color: '#FDFAF5',
              fontSize: 15, fontWeight: 500, border: 'none', cursor: loading ? 'wait' : 'pointer',
              marginTop: 8, opacity: loading ? 0.7 : 1, fontFamily: 'inherit'
            }}>
              {loading ? t('auth.processing') : activeTab === 'login' ? t('auth.loginBtn') : t('auth.signupBtn')}
            </button>
            <p style={{ fontSize: 12, color: 'rgba(28,26,22,0.3)', textAlign: 'center', marginTop: 16 }}>
              {t('auth.terms')}
            </p>
          </>
        ) : (
          <>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
              {t('auth.resetTitle')}
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(28,26,22,0.6)', marginBottom: 24 }}>
              {t('auth.resetSubtitle')}
            </p>
            {msg && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13,
                background: msg.type === 'success' ? '#EBF2EC' : '#FAE8E8',
                color: msg.type === 'success' ? '#7A9E7E' : '#C45C5C'
              }}>{msg.text}</div>
            )}
            <label style={labelStyle}>{t('auth.resetEmail')}</label>
            <input
              style={{ ...inputStyle, marginBottom: 8 }}
              type="email" placeholder="your@email.com"
              value={resetEmail} onChange={e => setResetEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleReset()}
            />
            <button onClick={handleReset} disabled={loading} style={{
              width: '100%', padding: 12, borderRadius: 10, background: '#1C1A16', color: '#FDFAF5',
              fontSize: 15, fontWeight: 500, border: 'none', cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1, fontFamily: 'inherit'
            }}>
              {loading ? t('auth.sending') : t('auth.sendReset')}
            </button>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <span onClick={() => { setShowReset(false); setMsg(null) }} style={{ fontSize: 13, color: '#7A9E7E', cursor: 'pointer' }}>
                {t('auth.backToLogin')}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'rgba(28,26,22,0.6)', marginBottom: 6, display: 'block' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(28,26,22,0.12)', fontFamily: 'inherit', fontSize: 14, background: '#F7F3EC', outline: 'none' }
