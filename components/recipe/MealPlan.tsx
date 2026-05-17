'use client'
import { useState } from 'react'
import type { Profile } from '@/types'

interface Ingredient { emoji: string; name: string; amount: string }
interface Meal { mealType: string; title: string; ingredients: Ingredient[]; calories: string }
interface DayPlan { day: number; dayName: string; meals: Meal[]; dailyCalories: string }
interface ShoppingItem { item: string; totalAmount: string; emoji: string }
interface ShoppingList { proteins: ShoppingItem[]; vegetables: ShoppingItem[]; grains: ShoppingItem[]; supplements: ShoppingItem[] }
interface WeeklyNutrition { avgDailyCalories: string; proteinSources: string[]; standard: string }
interface MealPlanData {
  petName: string
  days: DayPlan[]
  shoppingList: ShoppingList
  weeklyNutrition: WeeklyNutrition
}

interface Props {
  user: Profile | null
  onAuthRequired: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const AGE_OPTIONS = ['<1yr', '1yr', '2yr', '3yr', '5yr', '7yr', '10yr', '12yr+']

export default function MealPlan({ user, onAuthRequired, t }: Props) {
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog')
  const [petName, setPetName] = useState('')
  const [weight, setWeight] = useState('8')
  const [age, setAge] = useState('3yr')
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<MealPlanData | null>(null)
  const [expandedDay, setExpandedDay] = useState<number | null>(0)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warn' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' | 'warn' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const canGenerate = user && (
    (user.is_pro && (user.monthly_ai_count ?? 0) < 18) ||
    ((user.gift_ai_points ?? 0) + (user.paid_points ?? 0)) >= 3
  )

  const generate = async () => {
    if (!user) { onAuthRequired(); return }
    if (!canGenerate) {
      showToast(t('mealPlan.needCredits'), 'warn')
      setTimeout(() => document.getElementById('points')?.scrollIntoView({ behavior: 'smooth' }), 1000)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/meal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species, petName, weight: parseFloat(weight) || 5, age, healthConditions: ['healthy'] })
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 402) showToast('🟠 ' + (data.detail || t('mealPlan.needCredits')), 'error')
        else showToast(data.error || 'Generation failed', 'error')
        return
      }
      setPlan(data)
      setExpandedDay(0)
      showToast('✓ 7-day meal plan ready!', 'success')
    } catch {
      showToast('Network error, please retry', 'error')
    } finally {
      setLoading(false)
    }
  }

  const toastColors = {
    success: { bg: '#EBF2EC', color: '#3B6D11' },
    error: { bg: '#FAE8E8', color: '#C45C5C' },
    warn: { bg: '#FBF0E4', color: '#854F0B' },
  }

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div style={{ padding: '60px max(32px,4vw)' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(26px,3.5vw,38px)', fontWeight: 700, marginBottom: 12 }}>
          {t('mealPlan.sectionTitle')}
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(28,26,22,0.6)', fontWeight: 300, maxWidth: 520, margin: '0 auto' }}>
          {t('mealPlan.sectionSubtitle')}
        </p>
      </div>

      {/* Form */}
      <div style={{ maxWidth: 560, margin: '0 auto 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <select value={species} onChange={e => setSpecies(e.target.value as any)} style={inputStyle}>
            <option value="dog">🐕 Dog</option>
            <option value="cat">🐈 Cat</option>
          </select>
          <input value={petName} onChange={e => setPetName(e.target.value)} placeholder="Pet name" style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={weight} onChange={e => setWeight(e.target.value)} type="number" min="0.5" max="100" placeholder="Weight (kg)" style={inputStyle} />
          <select value={age} onChange={e => setAge(e.target.value)} style={inputStyle}>
            {AGE_OPTIONS.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          style={{
            padding: '12px 24px', borderRadius: 8, fontSize: 15, fontWeight: 500,
            border: 'none', fontFamily: 'inherit', cursor: loading ? 'wait' : 'pointer',
            background: !user ? 'rgba(28,26,22,0.15)' : loading ? 'rgba(28,26,22,0.3)' : '#1C1A16',
            color: !user || loading ? 'rgba(28,26,22,0.5)' : '#FDFAF5',
            opacity: loading ? 0.7 : 1
          }}>
          {loading ? t('mealPlan.generating') : t('mealPlan.generate')}
        </button>
        <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(28,26,22,0.4)' }}>
          {!user ? '🔒 Login required' : t('mealPlan.cost')}
        </div>
      </div>

      {/* Plan display */}
      {plan && (
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          {/* Day selector */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 24 }}>
            {plan.days.map((day, i) => (
              <button
                key={i}
                onClick={() => setExpandedDay(expandedDay === i ? null : i)}
                style={{
                  padding: '10px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', textAlign: 'center',
                  background: expandedDay === i ? '#1C1A16' : '#F7F3EC',
                  color: expandedDay === i ? '#FDFAF5' : 'rgba(28,26,22,0.7)',
                  transition: 'background 0.15s'
                }}>
                <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 3 }}>{DAY_LABELS[i]}</div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>{day.dailyCalories.replace('约', '').replace('~', '')}</div>
              </button>
            ))}
          </div>

          {/* Expanded day */}
          {expandedDay !== null && plan.days[expandedDay] && (
            <div style={{ background: '#FDFAF5', borderRadius: 16, border: '1px solid rgba(28,26,22,0.12)', padding: 24, marginBottom: 24 }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
                {t('mealPlan.day', { n: expandedDay + 1 })} · {plan.days[expandedDay].dayName}
                <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(28,26,22,0.5)', marginLeft: 10 }}>
                  {plan.days[expandedDay].dailyCalories}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
                {plan.days[expandedDay].meals.map((meal, mi) => (
                  <div key={mi} style={{ background: '#F7F3EC', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: '#1C1A16' }}>
                      {meal.mealType === 'breakfast' ? t('mealPlan.breakfast') : t('mealPlan.dinner')} · {meal.title}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {meal.ingredients.map((ing, ii) => (
                        <div key={ii} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(28,26,22,0.7)' }}>
                          <span>{ing.emoji} {ing.name}</span>
                          <span style={{ fontWeight: 500 }}>{ing.amount}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(28,26,22,0.45)', borderTop: '1px solid rgba(28,26,22,0.08)', paddingTop: 6 }}>
                      {meal.calories}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shopping list */}
          <div style={{ background: '#FDFAF5', borderRadius: 16, border: '1px solid rgba(28,26,22,0.12)', padding: 24, marginBottom: 24 }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              {t('mealPlan.shoppingList')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
              {(['proteins', 'vegetables', 'grains', 'supplements'] as const).map(cat => {
                const items = plan.shoppingList[cat] || []
                if (!items.length) return null
                return (
                  <div key={cat}>
                    <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(28,26,22,0.4)', marginBottom: 8 }}>
                      {t(`mealPlan.${cat}`)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {items.map((item, ii) => (
                        <div key={ii} style={{ fontSize: 13, color: 'rgba(28,26,22,0.7)', display: 'flex', gap: 6 }}>
                          <span>{item.emoji}</span>
                          <span>{item.item}</span>
                          <span style={{ marginLeft: 'auto', color: 'rgba(28,26,22,0.45)', fontWeight: 500 }}>{item.totalAmount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Weekly nutrition summary */}
          <div style={{ background: '#EBF2EC', borderRadius: 12, padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.5)', marginBottom: 2 }}>{t('mealPlan.avgCalories')}</div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700 }}>{plan.weeklyNutrition.avgDailyCalories}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.5)', marginBottom: 2 }}>{t('mealPlan.proteinSources')}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{plan.weeklyNutrition.proteinSources.join(' · ')}</div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <div style={{ fontSize: 11, color: '#7A9E7E', fontWeight: 500 }}>✓ {plan.weeklyNutrition.standard}</div>
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(28,26,22,0.35)', textAlign: 'center' }}>
            {t('mealPlan.disclaimer')}
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 300,
          padding: '12px 18px', borderRadius: 10, fontSize: 14, maxWidth: 300, lineHeight: 1.5,
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

const inputStyle: React.CSSProperties = { flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(28,26,22,0.12)', background: '#FDFAF5', fontFamily: 'inherit', fontSize: 14, outline: 'none' }
