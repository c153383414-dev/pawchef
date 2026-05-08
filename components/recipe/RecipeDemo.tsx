'use client'
import { useState } from 'react'
import type { Profile, RecipeContent, NutritionInfo } from '@/types'

interface Props {
  user: Profile | null
  onAuthRequired: () => void
}

const HEALTH_OPTIONS = ['健康', '肾病', '胰腺炎', '糖尿病', '肥胖', '食物过敏']

export default function RecipeDemo({ user, onAuthRequired }: Props) {
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog')
  const [petName, setPetName] = useState('小白')
  const [weight, setWeight] = useState('8')
  const [age, setAge] = useState('3岁')
  const [health, setHealth] = useState<string[]>(['健康'])
  const [loading, setLoading] = useState(false)
  const [recipe, setRecipe] = useState<{ title: string; content: RecipeContent; nutrition: NutritionInfo } | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warn' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' | 'warn' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const toggleHealth = (h: string) => {
    if (h === '健康') { setHealth(['健康']); return }
    setHealth(prev => {
      const next = prev.filter(x => x !== '健康')
      return next.includes(h) ? next.filter(x => x !== h) : [...next, h]
    })
  }

  // 判断用户能否使用AI
  const canUseAI = (): { ok: boolean; reason?: string } => {
    if (!user) return { ok: false, reason: 'not_logged_in' }
    // Pro会员有月次数
    if (user.is_pro && (user.monthly_ai_count ?? 0) < 30) return { ok: true }
    // 有赠送AI积分
    if ((user.gift_ai_points ?? 0) > 0) return { ok: true }
    // 有付费AI积分
    if ((user.paid_points ?? 0) > 0) return { ok: true }
    return { ok: false, reason: 'no_credits' }
  }

  const getButtonLabel = () => {
    if (!user) return '登录后生成食谱'
    if (loading) return '⏳ 生成中…'
    const check = canUseAI()
    if (!check.ok) return '🟠 需要AI积分'
    if (user.is_pro) return `✦ 生成食谱（本月剩余 ${30 - (user.monthly_ai_count ?? 0)} 次）`
    if ((user.gift_ai_points ?? 0) > 0) return `✦ 生成食谱（消耗1🟠赠送积分）`
    return `✦ 生成食谱（消耗1🟠AI积分，剩余${user.paid_points ?? 0}）`
  }

  const getButtonStyle = (): React.CSSProperties => {
    const check = canUseAI()
    if (!user || !check.ok) {
      return { background: 'rgba(28,26,22,0.15)', color: 'rgba(28,26,22,0.4)', cursor: !user ? 'pointer' : 'not-allowed' }
    }
    return { background: '#1C1A16', color: '#FDFAF5', cursor: 'pointer' }
  }

  const generate = async () => {
    if (!user) { onAuthRequired(); return }

    const check = canUseAI()
    if (!check.ok) {
      showToast('🟠 AI积分不足，请购买积分包或订阅Pro会员', 'error')
      setTimeout(() => {
        document.getElementById('points')?.scrollIntoView({ behavior: 'smooth' })
      }, 1000)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species,
          petName,
          weight: parseFloat(weight) || 5,
          age,
          healthConditions: health
        })
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 402) {
          showToast('🟠 ' + (data.detail || 'AI积分不足，请购买积分包'), 'error')
        } else {
          showToast(data.error || '生成失败，请稍后重试', 'error')
        }
        return
      }

      setRecipe(data)
      showToast('✓ 食谱生成成功！符合 AAFCO 标准', 'success')
    } catch {
      showToast('网络错误，请稍后重试', 'error')
    } finally {
      setLoading(false)
    }
  }

  const toastColors = {
    success: { bg: '#EBF2EC', color: '#3B6D11' },
    error: { bg: '#FAE8E8', color: '#C45C5C' },
    warn: { bg: '#FBF0E4', color: '#854F0B' },
  }

  return (
    <div style={{ padding: '60px max(32px,4vw)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 40, alignItems: 'start' }}>

        {/* 左侧：表单 */}
        <div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(26px,3.5vw,38px)', fontWeight: 700, lineHeight: 1.2, marginBottom: 16 }}>
            30秒<br />生成一份完整食谱
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(28,26,22,0.6)', marginBottom: 28, fontWeight: 300 }}>
            选择宠物信息，AI 立即生成符合 AAFCO 标准的营养完整食谱
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <select value={species} onChange={e => setSpecies(e.target.value as any)} style={selectStyle}>
                <option value="dog">🐕 狗</option>
                <option value="cat">🐈 猫</option>
              </select>
              <input value={petName} onChange={e => setPetName(e.target.value)} placeholder="宠物名字" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={weight} onChange={e => setWeight(e.target.value)} placeholder="体重(kg)" type="number" min="0.5" max="100" style={inputStyle} />
              <select value={age} onChange={e => setAge(e.target.value)} style={selectStyle}>
                {['幼年(<1岁)', '1岁', '2岁', '3岁', '5岁', '7岁', '10岁', '12岁+'].map(a => <option key={a}>{a}</option>)}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, color: 'rgba(28,26,22,0.6)', marginBottom: 8, fontWeight: 500 }}>健康状况（可多选）</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {HEALTH_OPTIONS.map(h => (
                  <button key={h} onClick={() => toggleHealth(h)} style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${health.includes(h) ? '#7A9E7E' : 'rgba(28,26,22,0.12)'}`,
                    background: health.includes(h) ? '#7A9E7E' : '#FDFAF5',
                    color: health.includes(h) ? '#fff' : 'rgba(28,26,22,0.6)'
                  }}>{health.includes(h) ? `✓ ${h}` : h}</button>
                ))}
              </div>
            </div>

            {/* 积分状态提示 */}
            {user && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F7F3EC', fontSize: 12, color: 'rgba(28,26,22,0.6)', lineHeight: 1.6 }}>
                {user.is_pro ? (
                  <span>👑 Pro会员 · 本月已用 {user.monthly_ai_count ?? 0}/30 次</span>
                ) : (
                  <span>
                    🟠 AI积分：<strong style={{ color: '#854F0B' }}>{(user.paid_points ?? 0) + (user.gift_ai_points ?? 0)}</strong>
                    {(user.gift_ai_points ?? 0) > 0 && <span style={{ color: '#C8813A' }}> （含{user.gift_ai_points}赠送，当月有效）</span>}
                  </span>
                )}
              </div>
            )}

            <button
              onClick={() => user ? generate() : onAuthRequired()}
              disabled={loading}
              style={{
                padding: '12px 24px', borderRadius: 8,
                fontSize: 15, fontWeight: 500, border: 'none',
                fontFamily: 'inherit', transition: 'opacity 0.2s',
                opacity: loading ? 0.7 : 1,
                ...getButtonStyle()
              }}>
              {getButtonLabel()}
            </button>

            {/* 未登录提示 */}
            {!user && (
              <p style={{ fontSize: 12, color: '#C8813A', margin: 0 }}>
                注册后获得 20💙免费积分 + 使用AI功能需购买🟠AI积分包
              </p>
            )}

            {/* 无积分提示 */}
            {user && !canUseAI().ok && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FAE8E8', fontSize: 12, color: '#C45C5C', lineHeight: 1.6 }}>
                🟠 AI积分不足<br />
                <span style={{ color: '#854F0B' }}>订阅Pro会员 或 购买积分包 即可生成食谱</span>
              </div>
            )}

            {/* 病宠免责声明 */}
            {health.some(h => ['肾病', '胰腺炎', '糖尿病'].includes(h)) && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FBF0E4', fontSize: 12, color: '#854F0B', lineHeight: 1.6, border: '1px solid #FAC775' }}>
                ⚕️ 病宠营养参考模式：以下食谱仅为营养参考信息，不构成医疗建议。请务必在持牌兽医指导下使用。
              </div>
            )}
          </div>
        </div>

        {/* 右侧：结果 */}
        <div style={{ background: '#FDFAF5', borderRadius: 16, border: '1px solid rgba(28,26,22,0.12)', overflow: 'hidden', boxShadow: '0 4px 24px rgba(28,26,22,0.06)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(28,26,22,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700 }}>
              {recipe ? recipe.title : `${petName || '宠物'}的营养食谱`}
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#7A9E7E', background: '#EBF2EC', padding: '4px 10px', borderRadius: 6 }}>
              ✓ AAFCO 达标
            </div>
          </div>

          <div style={{ padding: 20 }}>
            {recipe ? (
              <>
                {/* 食材 */}
                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(28,26,22,0.5)', marginBottom: 8 }}>食材用量</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
                  {recipe.content.ingredients.map((ing, i) => (
                    <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: '#F7F3EC', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{ing.emoji} {ing.name}</span>
                      <span style={{ color: 'rgba(28,26,22,0.6)', fontWeight: 500 }}>{ing.amount}</span>
                    </div>
                  ))}
                </div>

                {/* 病宠警告 */}
                {recipe.content.warnings && recipe.content.warnings.length > 0 && (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FBF0E4', marginBottom: 12, fontSize: 12, color: '#854F0B', lineHeight: 1.5 }}>
                    ⚠️ {recipe.content.warnings.join(' · ')}
                  </div>
                )}

                {/* 步骤 */}
                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(28,26,22,0.5)', marginBottom: 8 }}>烹饪步骤</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {recipe.content.steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'rgba(28,26,22,0.6)' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1C1A16', color: '#FDFAF5', fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>

                {/* 营养 */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid rgba(28,26,22,0.08)' }}>
                  {[['热量', recipe.nutrition.calories], ['蛋白质', recipe.nutrition.protein], ['脂肪', recipe.nutrition.fat], ['碳水', recipe.nutrition.carbs]].map(([k, v]) => (
                    <div key={k} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, background: '#F7F3EC' }}>
                      <strong style={{ color: '#1C1A16' }}>{k}</strong> <span style={{ color: 'rgba(28,26,22,0.6)' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(28,26,22,0.3)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
                <p style={{ fontSize: 14 }}>填写左侧宠物信息，点击生成食谱</p>
                <p style={{ fontSize: 12, marginTop: 8, color: 'rgba(28,26,22,0.25)' }}>
                  需要🟠AI积分或Pro会员
                </p>
              </div>
            )}
          </div>

          <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(28,26,22,0.08)', fontSize: 11, color: 'rgba(28,26,22,0.3)', background: '#F7F3EC' }}>
            ⚠️ AI 生成，仅供营养参考，不替代专业兽医诊断建议
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 300,
          padding: '12px 18px', borderRadius: 10, fontSize: 14,
          maxWidth: 300, lineHeight: 1.5,
          boxShadow: '0 4px 20px rgba(28,26,22,0.15)',
          background: toastColors[toast.type].bg,
          color: toastColors[toast.type].color,
          border: `1px solid ${toastColors[toast.type].color}30`
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  flex: 1, padding: '10px 14px', borderRadius: 8,
  border: '1px solid rgba(28,26,22,0.12)',
  background: '#FDFAF5', fontFamily: 'inherit', fontSize: 14, outline: 'none'
}
const inputStyle: React.CSSProperties = {
  flex: 1, padding: '10px 14px', borderRadius: 8,
  border: '1px solid rgba(28,26,22,0.12)',
  background: '#FDFAF5', fontFamily: 'inherit', fontSize: 14, outline: 'none'
}
