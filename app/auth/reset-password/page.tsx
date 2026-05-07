'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMsg({ type: 'success', text: '请设置你的新密码' })
      }
    })
  }, [])

  const handleReset = async () => {
    if (password.length < 8) return setMsg({ type: 'error', text: '密码至少8位' })
    if (password !== confirm) return setMsg({ type: 'error', text: '两次密码不一致' })
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      setMsg({ type: 'success', text: '密码已更新！正在跳转…' })
      setTimeout(() => router.push('/'), 2000)
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 400, padding: 36, border: '1px solid rgba(28,26,22,0.12)' }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700, marginBottom: 6 }}>设置新密码</h2>
        <p style={{ fontSize: 14, color: 'rgba(28,26,22,0.6)', marginBottom: 24 }}>请输入你的新密码（至少8位）</p>

        {msg && <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: msg.type === 'success' ? '#EBF2EC' : '#FAE8E8', color: msg.type === 'success' ? '#7A9E7E' : '#C45C5C' }}>{msg.text}</div>}

        <label style={labelStyle}>新密码</label>
        <input style={inputStyle} type="password" placeholder="至少8位" value={password} onChange={e => setPassword(e.target.value)} />
        <label style={{ ...labelStyle, marginTop: 16 }}>确认新密码</label>
        <input style={{ ...inputStyle, marginBottom: 16 }} type="password" placeholder="再输入一次" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleReset()} />

        <button onClick={handleReset} disabled={loading} style={{ width: '100%', padding: 12, borderRadius: 10, background: '#1C1A16', color: '#FDFAF5', fontSize: 15, fontWeight: 500, border: 'none', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'inherit' }}>
          {loading ? '更新中…' : '更新密码'}
        </button>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'rgba(28,26,22,0.6)', marginBottom: 6, display: 'block' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(28,26,22,0.12)', fontFamily: 'inherit', fontSize: 14, background: '#F7F3EC', outline: 'none', marginBottom: 8 }
