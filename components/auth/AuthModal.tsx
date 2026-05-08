'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import type { Profile } from '@/types'
 
interface Props {
  open: boolean
  tab: 'login' | 'signup'
  onClose: () => void
  onSuccess: (profile: Profile) => void
}
 
export default function AuthModal({ open, tab, onClose, onSuccess }: Props) {
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
    if (!email || !email.includes('@')) return setMsg({ type: 'error', text: '请输入有效邮箱' })
    if (password.length < 8) return setMsg({ type: 'error', text: '密码至少8位' })
    setLoading(true)
 
    if (activeTab === 'signup') {
      if (!name) { setLoading(false); return setMsg({ type: 'error', text: '请输入昵称' }) }
      if (password !== confirm) { setLoading(false); return setMsg({ type: 'error', text: '两次密码不一致' }) }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { display_name: name } }
      })
      if (error) { setMsg({ type: 'error', text: error.message }); setLoading(false); return }
      setMsg({ type: 'success', text: `注册成功！验证邮件已发至 ${email}，请点击邮件中的链接激活账户` })
      setLoading(false)
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setMsg({ type: 'error', text: '邮箱或密码错误' }); setLoading(false); return }
      if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
        if (profile) {
          onSuccess(profile as Profile)
        } else {
          onSuccess({
            id: data.user.id,
            email: data.user.email || '',
            display_name: data.user.user_metadata?.display_name || data.user.email?.split('@')[0] || '',
            is_pro: false,
            pro_expires_at: null,
            points: 50,
            created_at: new Date().toISOString()
          })
        }
      }
      setLoading(false)
    }
  }
 
  const handleReset = async () => {
    if (!resetEmail.includes('@')) return setMsg({ type: 'error', text: '请输入有效邮箱' })
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })
    setMsg({ type: 'success', text: '重置链接已发送（无论邮箱是否注册，提示相同）' })
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
              {activeTab === 'login' ? '欢迎回来' : '创建账户'}
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(28,26,22,0.6)', marginBottom: 24 }}>
              {activeTab === 'login' ? '为你的宠物生成专属食谱' : '免费开始，每日3次食谱生成'}
            </p>
 
            <div style={{ display: 'flex', gap: 4, background: '#F7F3EC', padding: 4, borderRadius: 10, marginBottom: 24 }}>
              {(['login', 'signup'] as const).map(t => (
                <button key={t} onClick={() => { setActiveTab(t); setMsg(null) }} style={{
                  flex: 1, padding: '8px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                  background: activeTab === t ? '#FDFAF5' : 'transparent',
                  color: activeTab === t ? '#1C1A16' : 'rgba(28,26,22,0.6)',
                  boxShadow: activeTab === t ? '0 1px 4px rgba(28,26,22,.1)' : 'none'
                }}>{t === 'login' ? '登录' : '注册'}</button>
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
                <label style={labelStyle}>昵称</label>
                <input style={inputStyle} placeholder="你的称呼" value={name} onChange={e => setName(e.target.value)} />
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>邮箱</label>
              <input style={inputStyle} type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div style={{ marginBottom: activeTab === 'signup' ? 16 : 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>密码</label>
                {activeTab === 'login' && (
                  <span onClick={() => { setShowReset(true); setMsg(null) }} style={{ fontSize: 12, color: '#7A9E7E', cursor: 'pointer' }}>
                    忘记密码？
                  </span>
                )}
              </div>
              <input style={inputStyle} type="password" placeholder="至少8位" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()} />
            </div>
            {activeTab === 'signup' && (
              <div style={{ marginBottom: 8 }}>
                <label style={labelStyle}>确认密码</label>
                <input style={inputStyle} type="password" placeholder="再输入一次" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()} />
              </div>
            )}
 
            <button onClick={handleAuth} disabled={loading} style={{
              width: '100%', padding: 12, borderRadius: 10, background: '#1C1A16', color: '#FDFAF5',
              fontSize: 15, fontWeight: 500, border: 'none', cursor: loading ? 'wait' : 'pointer',
              marginTop: 8, opacity: loading ? 0.7 : 1, fontFamily: 'inherit'
            }}>
              {loading ? '处理中…' : activeTab === 'login' ? '登录' : '免费注册'}
            </button>
            <p style={{ fontSize: 12, color: 'rgba(28,26,22,0.3)', textAlign: 'center', marginTop: 16 }}>
              继续即表示你同意我们的服务条款和隐私政策
            </p>
          </>
        ) : (
          <>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700, marginBottom: 6 }}>重置密码</h2>
            <p style={{ fontSize: 14, color: 'rgba(28,26,22,0.6)', marginBottom: 24 }}>输入注册邮箱，我们发送重置链接（1小时内有效）</p>
            {msg && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13,
                background: msg.type === 'success' ? '#EBF2EC' : '#FAE8E8',
                color: msg.type === 'success' ? '#7A9E7E' : '#C45C5C'
              }}>{msg.text}</div>
            )}
            <label style={labelStyle}>注册邮箱</label>
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
              {loading ? '发送中…' : '发送重置链接'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <span onClick={() => { setShowReset(false); setMsg(null) }} style={{ fontSize: 13, color: '#7A9E7E', cursor: 'pointer' }}>
                ← 返回登录
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
