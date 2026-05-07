'use client'
import { useState } from 'react'
import type { Profile, RecipeContent, NutritionInfo } from '@/types'

interface Props {
  user: Profile | null
  onAuthRequired: () => void
}

const HEALTH_OPTIONS = ['健康','肾病','胰腺炎','糖尿病','肥胖','食物过敏']

export default function RecipeDemo({ user, onAuthRequired }: Props) {
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog')
  const [petName, setPetName] = useState('小白')
  const [weight, setWeight] = useState('8')
  const [age, setAge] = useState('3岁')
  const [health, setHealth] = useState<string[]>(['健康'])
  const [loading, setLoading] = useState(false)
  const [recipe, setRecipe] = useState<{ title: string; content: RecipeContent; nutrition: NutritionInfo } | null>(null)
  const [toast, setToast] = useState('')

  const toggleHealth = (h: string) => {
    if (h === '健康') { setHealth(['健康']); return }
    setHealth(prev => {
      const next = prev.filter(x => x !== '健康')
      return next.includes(h) ? next.filter(x => x !== h) : [...next, h]
    })
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const generate = async () => {
    if (!user) { onAuthRequired(); return }
    if (user.points < 10 && !user.is_pro) {
      showToast('积分不足（需10积分），请购买积分包')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species, petName, weight: parseFloat(weight), age, healthConditions: health })
      })
      const data = await res.json()
      if (data.error) { showToast(data.error); return }
      setRecipe(data)
      showToast('✓ 食谱生成成功！')
    } catch {
      showToast('生成失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '60px max(32px,4vw)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 40, alignItems: 'start' }}>
        {/* Form */}
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
              <input value={weight} onChange={e => setWeight(e.target.value)} placeholder="体重(kg)" type="number" style={inputStyle} />
              <select value={age} onChange={e => setAge(e.target.value)} style={selectStyle}>
                {['幼年(<1岁)','1岁','2岁','3岁','5岁','7岁','10岁','12岁+'].map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(28,26,22,0.6)', marginBottom: 8, fontWeight: 500 }}>健康状况（可多选）</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {HEALTH_OPTIONS.map(h => (
                  <button key={h} onClick={() => toggleHealth(h)} style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid', fontFamily: 'inherit',
                    background: health.includes(h) ? '#7A9E7E' : '#FDFAF5',
                    color: health.includes(h) ? '#fff' : 'rgba(28,26,22,0.6)',
                    borderColor: health.includes(h) ? '#7A9E7E' : 'rgba(28,26,22,0.12)'
                  }}>{health.includes(h) ? `✓ ${h}` : h}</button>
                ))}
              </div>
            </div>
            <button onClick={generate} disabled={loading} style={{ padding: '12px 24px', borderRadius: 8, background: '#1C1A16', color: '#FDFAF5', fontSize: 15, fontWeight: 500, border: 'none', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'inherit' }}>
              {loading ? '⏳ 生成中…' : '✦ 生成食谱'}
            </button>
            {!user && <p style={{ fontSize: 12, color: '#C8813A' }}>需要登录才能生成食谱，每日免费3次</p>}
          </div>
        </div>

        {/* Result */}
        <div style={{ background: '#FDFAF5', borderRadius: 16, border: '1px solid rgba(28,26,22,0.12)', overflow: 'hidden', boxShadow: '0 4px 24px rgba(28,26,22,0.06)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(28,26,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700 }}>
              {recipe ? recipe.title : `${petName}的营养晚餐`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: '#7A9E7E', background: '#EBF2EC', padding: '4px 10px', borderRadius: 6 }}>
              ✓ AAFCO 达标
            </div>
          </div>
          <div style={{ padding: 20 }}>
            {recipe ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(28,26,22,0.6)', marginBottom: 8 }}>食材用量</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
                  {recipe.content.ingredients.map((ing, i) => (
                    <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: '#F7F3EC', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{ing.emoji} {ing.name}</span>
                      <span style={{ color: 'rgba(28,26,22,0.6)', fontWeight: 500 }}>{ing.amount}</span>
                    </div>
                  ))}
                </div>
                {recipe.content.warnings && recipe.content.warnings.length > 0 && (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FAE8E8', marginBottom: 12, fontSize: 12, color: '#C45C5C' }}>
                    ⚠️ {recipe.content.warnings.join(' · ')}
                  </div>
                )}
                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(28,26,22,0.6)', marginBottom: 8 }}>烹饪步骤</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {recipe.content.steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'rgba(28,26,22,0.6)' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1C1A16', color: '#FDFAF5', fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid rgba(28,26,22,0.08)' }}>
                  {[['热量', recipe.nutrition.calories], ['蛋白质', recipe.nutrition.protein], ['脂肪', recipe.nutrition.fat], ['碳水', recipe.nutrition.carbs]].map(([k, v]) => (
                    <div key={k} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, background: '#F7F3EC', color: 'rgba(28,26,22,0.6)' }}>
                      <strong style={{ color: '#1C1A16' }}>{k}</strong> {v}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(28,26,22,0.3)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
                <p>填写左侧宠物信息，点击生成食谱</p>
              </div>
            )}
          </div>
          <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(28,26,22,0.08)', fontSize: 11, color: 'rgba(28,26,22,0.3)', background: '#F7F3EC' }}>
            ⚠️ AI 生成，仅供参考，不替代专业兽医诊断建议
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 300, padding: '12px 18px', borderRadius: 10, background: '#1C1A16', color: '#FDFAF5', fontSize: 14, boxShadow: '0 4px 20px rgba(28,26,22,0.2)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = { flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(28,26,22,0.12)', background: '#FDFAF5', fontFamily: 'inherit', fontSize: 14, outline: 'none' }
const inputStyle: React.CSSProperties = { flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(28,26,22,0.12)', background: '#FDFAF5', fontFamily: 'inherit', fontSize: 14, outline: 'none' }
