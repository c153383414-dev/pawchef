'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types'

interface FeedingLog {
  id: string
  user_id: string
  pet_name: string | null
  meal_title: string
  meal_type: string
  ingredients: any[] | null
  nutrition: { calories?: string } | null
  fed_at: string
  notes: string | null
}

interface Stats {
  month: string
  totalFeedings: number
  avgDailyCalories: number
  proteinBreakdown: { source: string; percentage: number }[]
  weeklyCalories: number[]
  mostUsedIngredients: string[]
  aafcoCompliance: string
}

interface LogFormData {
  pet_name: string
  meal_title: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  calories: string
  fed_at: string
  notes: string
}

export default function NutritionLogPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [logs, setLogs] = useState<FeedingLog[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [petName, setPetName] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [form, setForm] = useState<LogFormData>({
    pet_name: '', meal_title: '', meal_type: 'breakfast',
    calories: '', fed_at: new Date().toISOString().slice(0, 16), notes: ''
  })

  const router = useRouter()
  const supabase = createClient()

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const loadData = useCallback(async (uid: string) => {
    const params = new URLSearchParams({ month })
    if (petName) params.set('pet_name', petName)

    const [logsRes, statsRes] = await Promise.all([
      fetch(`/api/feeding-log?${params}&limit=50`),
      fetch(`/api/feeding-log/stats?${params}`)
    ])

    if (logsRes.ok) setLogs(await logsRes.json())
    if (statsRes.ok) setStats(await statsRes.json())
  }, [month, petName])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      await loadData(user.id)
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (profile) loadData(profile.id)
  }, [month, petName])

  const saveLog = async () => {
    if (!form.meal_title.trim()) return
    setSaving(true)
    try {
      const nutrition = form.calories ? { calories: form.calories + ' kcal' } : null
      const res = await fetch('/api/feeding-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pet_name: form.pet_name || null,
          meal_title: form.meal_title,
          meal_type: form.meal_type,
          nutrition,
          fed_at: new Date(form.fed_at).toISOString(),
          notes: form.notes || null
        })
      })
      if (res.ok) {
        setShowModal(false)
        setForm({ pet_name: '', meal_title: '', meal_type: 'breakfast', calories: '', fed_at: new Date().toISOString().slice(0, 16), notes: '' })
        showToast('✓ 记录已保存')
        if (profile) await loadData(profile.id)
      } else {
        const d = await res.json()
        showToast(d.error || '保存失败', false)
      }
    } finally {
      setSaving(false)
    }
  }

  const deleteLog = async (id: string) => {
    const res = await fetch('/api/feeding-log', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    if (res.ok) {
      setLogs(prev => prev.filter(l => l.id !== id))
      showToast('✓ 已删除')
    } else {
      showToast('删除失败', false)
    }
  }

  const exportReport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/export-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pet_name: petName || null, month })
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `pawchef-nutrition-${month}.html`
        a.click()
        URL.revokeObjectURL(url)
        showToast('✓ 报告已下载')
      } else {
        const d = await res.json()
        showToast(d.error || '导出失败', false)
      }
    } finally {
      setExporting(false)
    }
  }

  const mealTypeLabel = (t: string) => ({ breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '零食' }[t] || t)

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FDFAF5' }}>
      加载中…
    </div>
  )
  if (!profile) return null

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF5' }}>
      {/* Nav */}
      <nav style={{ background: '#FDFAF5', borderBottom: '1px solid rgba(28,26,22,0.12)', padding: '0 max(24px,5vw)', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/dashboard" style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, textDecoration: 'none', color: '#1C1A16' }}>
          🐾 PawChef <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(28,26,22,0.5)' }}>/ 营养日志</span>
        </a>
        <a href="/dashboard" style={{ fontSize: 13, color: 'rgba(28,26,22,0.5)', textDecoration: 'none' }}>← 返回控制台</a>
      </nav>

      <div style={{ padding: '40px max(24px,5vw)', maxWidth: 1000, margin: '0 auto' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700 }}>📊 营养饮食日志</h1>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="month" value={month} onChange={e => setMonth(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(28,26,22,0.12)', fontFamily: 'inherit', fontSize: 13, background: '#FDFAF5' }}
            />
            <input
              value={petName} onChange={e => setPetName(e.target.value)}
              placeholder="筛选宠物名字"
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(28,26,22,0.12)', fontFamily: 'inherit', fontSize: 13, background: '#FDFAF5', width: 130 }}
            />
            <button onClick={() => setShowModal(true)} style={{ padding: '8px 16px', borderRadius: 8, background: '#1C1A16', color: '#FDFAF5', border: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              + 记录喂食
            </button>
          </div>
        </div>

        {/* Stats cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 32 }}>
            {[
              { label: '喂食次数', value: stats.totalFeedings + ' 次', icon: '🍽️' },
              { label: '日均热量', value: stats.avgDailyCalories > 0 ? stats.avgDailyCalories + ' kcal' : '—', icon: '🔥' },
              { label: 'AAFCO 合规率', value: stats.aafcoCompliance, icon: '✓' },
            ].map(s => (
              <div key={s.label} style={{ background: '#F7F3EC', borderRadius: 14, padding: 20, border: '1px solid rgba(28,26,22,0.08)' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                <div style={{ fontSize: 12, color: 'rgba(28,26,22,0.5)', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700 }}>{s.value}</div>
              </div>
            ))}

            {/* Export button card */}
            <div style={{ background: '#F7F3EC', borderRadius: 14, padding: 20, border: '1px solid rgba(28,26,22,0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 12, color: 'rgba(28,26,22,0.5)', marginBottom: 4 }}>导出报告</div>
                <div style={{ fontSize: 12, color: '#C8813A', marginBottom: 12 }}>消耗 30 💙 免费积分</div>
              </div>
              <button
                onClick={exportReport}
                disabled={exporting}
                style={{ padding: '8px 12px', borderRadius: 8, background: exporting ? 'rgba(28,26,22,0.1)' : '#1C1A16', color: exporting ? 'rgba(28,26,22,0.4)' : '#FDFAF5', border: 'none', fontSize: 12, cursor: exporting ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                {exporting ? '导出中…' : '导出 PDF'}
              </button>
            </div>
          </div>
        )}

        {/* Pro chart section */}
        {!profile.is_pro && (
          <div style={{ padding: '24px', background: '#F7F3EC', borderRadius: 16, marginBottom: 32, textAlign: 'center', border: '1px dashed rgba(28,26,22,0.15)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📈</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>营养趋势图表</div>
            <div style={{ fontSize: 13, color: 'rgba(28,26,22,0.5)', marginBottom: 12 }}>
              Pro 会员专属：蛋白质分布饼图 · 周热量趋势折线图
            </div>
            <a href="/#pricing" style={{ display: 'inline-block', padding: '8px 20px', borderRadius: 8, background: '#C8813A', color: '#fff', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>升级 Pro →</a>
          </div>
        )}

        {profile.is_pro && stats && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>营养趋势</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
              {/* Protein breakdown */}
              {stats.proteinBreakdown.length > 0 && (
                <div style={{ background: '#FDFAF5', borderRadius: 14, border: '1px solid rgba(28,26,22,0.12)', padding: 20 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 12 }}>蛋白质来源分布</div>
                  {stats.proteinBreakdown.map(p => (
                    <div key={p.source} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span>{p.source}</span><span style={{ fontWeight: 500 }}>{p.percentage}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: '#F7F3EC', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${p.percentage}%`, background: '#7A9E7E', borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Weekly calorie trend */}
              <div style={{ background: '#FDFAF5', borderRadius: 14, border: '1px solid rgba(28,26,22,0.12)', padding: 20 }}>
                <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 12 }}>周热量趋势（kcal）</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
                  {stats.weeklyCalories.map((cal, i) => {
                    const maxCal = Math.max(...stats.weeklyCalories, 1)
                    const h = Math.max((cal / maxCal) * 72, 4)
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ fontSize: 10, color: 'rgba(28,26,22,0.4)' }}>{cal > 0 ? cal : '—'}</div>
                        <div style={{ width: '100%', height: h, background: cal > 0 ? '#C8813A' : '#F0EBE3', borderRadius: 3, transition: 'height 0.3s' }} />
                        <div style={{ fontSize: 10, color: 'rgba(28,26,22,0.4)' }}>W{i + 1}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feeding history */}
        <div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>喂食记录</h2>
          {logs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', background: '#F7F3EC', borderRadius: 16, color: 'rgba(28,26,22,0.4)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
              <p>暂无喂食记录，点击右上角「记录喂食」开始追踪</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {logs.map(log => (
                <div key={log.id} style={{ background: '#FDFAF5', borderRadius: 12, border: '1px solid rgba(28,26,22,0.1)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <div style={{ padding: '4px 10px', borderRadius: 6, background: '#F7F3EC', fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
                      {mealTypeLabel(log.meal_type)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.meal_title}</div>
                      <div style={{ fontSize: 12, color: 'rgba(28,26,22,0.45)', marginTop: 2 }}>
                        {new Date(log.fed_at).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {log.pet_name && ` · ${log.pet_name}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    {log.nutrition?.calories && (
                      <span style={{ fontSize: 12, color: '#854F0B', background: '#FBF0E4', padding: '3px 8px', borderRadius: 5 }}>{log.nutrition.calories}</span>
                    )}
                    <button
                      onClick={() => deleteLog(log.id)}
                      style={{ padding: '4px 10px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(28,26,22,0.12)', fontSize: 12, cursor: 'pointer', color: 'rgba(28,26,22,0.5)', fontFamily: 'inherit' }}>
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Log feeding modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,26,22,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 }}>
          <div style={{ background: '#FDFAF5', borderRadius: 20, padding: 32, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(28,26,22,0.2)' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, marginBottom: 20 }}>记录喂食</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                value={form.pet_name} onChange={e => setForm(f => ({ ...f, pet_name: e.target.value }))}
                placeholder="宠物名字（可选）"
                style={modalInput}
              />
              <input
                value={form.meal_title} onChange={e => setForm(f => ({ ...f, meal_title: e.target.value }))}
                placeholder="餐食名称（必填）"
                style={modalInput}
              />
              <select value={form.meal_type} onChange={e => setForm(f => ({ ...f, meal_type: e.target.value as any }))} style={modalInput}>
                <option value="breakfast">🌅 早餐</option>
                <option value="lunch">☀️ 午餐</option>
                <option value="dinner">🌆 晚餐</option>
                <option value="snack">🍪 零食</option>
              </select>
              <input
                value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))}
                placeholder="热量 kcal（可选，如 280）"
                type="number" min="0"
                style={modalInput}
              />
              <input
                value={form.fed_at} onChange={e => setForm(f => ({ ...f, fed_at: e.target.value }))}
                type="datetime-local"
                style={modalInput}
              />
              <textarea
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="备注（可选）"
                rows={2}
                style={{ ...modalInput, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ flex: 1, padding: '12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(28,26,22,0.15)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: 'rgba(28,26,22,0.6)' }}>
                取消
              </button>
              <button
                onClick={saveLog}
                disabled={saving || !form.meal_title.trim()}
                style={{ flex: 2, padding: '12px', borderRadius: 8, background: saving || !form.meal_title.trim() ? 'rgba(28,26,22,0.2)' : '#1C1A16', color: '#FDFAF5', border: 'none', fontSize: 14, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 600,
          padding: '12px 18px', borderRadius: 10, fontSize: 14, maxWidth: 300,
          background: toast.ok ? '#EBF2EC' : '#FAE8E8',
          color: toast.ok ? '#3B6D11' : '#C45C5C',
          border: `1px solid ${toast.ok ? '#3B6D1130' : '#C45C5C30'}`,
          boxShadow: '0 4px 20px rgba(28,26,22,0.15)'
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

const modalInput: React.CSSProperties = { padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(28,26,22,0.12)', background: '#FDFAF5', fontFamily: 'inherit', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' }
