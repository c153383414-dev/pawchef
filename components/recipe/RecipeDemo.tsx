'use client'
import { useState } from 'react'
import type { Profile, RecipeContent, NutritionInfo } from '@/types'

interface Props {
  user: Profile | null
  onAuthRequired: () => void
  locale: string
  t: (key: string, params?: Record<string, string | number>) => string
}

const HEALTH_OPTIONS = [
  { key: 'healthy', labelKey: 'recipe.healthy' },
  { key: 'kidney', labelKey: 'recipe.kidney' },
  { key: 'pancreatitis', labelKey: 'recipe.pancreatitis' },
  { key: 'diabetes', labelKey: 'recipe.diabetes' },
  { key: 'obesity', labelKey: 'recipe.obesity' },
  { key: 'allergy', labelKey: 'recipe.allergy' },
]

const AGE_OPTIONS = ['<1yr', '1yr', '2yr', '3yr', '5yr', '7yr', '10yr', '12yr+']

function getWeightRange(weight: number, species: string): string {
  if (species === 'dog') {
    if (weight < 10) return 'small'
    if (weight <= 25) return 'medium'
    return 'large'
  } else {
    if (weight < 4) return 'light'
    if (weight <= 6) return 'standard'
    return 'heavy'
  }
}

function getAgeRange(age: string): string {
  if (age.includes('<1') || age === '幼年(<1岁)') return 'puppy'
  const num = parseInt(age)
  if (num >= 7) return 'senior'
  return 'adult'
}

export default function RecipeDemo({ user, onAuthRequired, locale, t }: Props) {
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog')
  const [petName, setPetName] = useState('')
  const [weight, setWeight] = useState('8')
  const [age, setAge] = useState('3yr')
  const [health, setHealth] = useState<string[]>(['healthy'])
  const [loading, setLoading] = useState(false)
  const [recipe, setRecipe] = useState<{ title: string; content: RecipeContent; nutrition: NutritionInfo } | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warn' } | null>(null)
  const [isPreset, setIsPreset] = useState(false)

  const showToast = (msg: string, type: 'success' | 'error' | 'warn' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const toggleHealth = (key: string) => {
    if (key === 'healthy') { setHealth(['healthy']); return }
    setHealth(prev => {
      const next = prev.filter(x => x !== 'healthy')
      return next.includes(key) ? next.filter(x => x !== key) : [...next, key]
    })
  }

  const isHealthOnly = health.length === 1 && health[0] === 'healthy'
  const canUseAI = user && (
    (user.is_pro && (user.monthly_ai_count ?? 0) < 30) ||
    (user.gift_ai_points ?? 0) > 0 ||
    (user.paid_points ?? 0) > 0
  )

  // Free users or healthy-only: use preset recipes
  const shouldUsePreset = isHealthOnly && !canUseAI

  const getButtonLabel = () => {
    if (loading) return t('recipe.generatingBtn')
    if (shouldUsePreset) return t('recipe.generateBtn')
    if (!user) return t('recipe.generateBtn')
    if (!canUseAI) return t('recipe.needCredits')
    if (user.is_pro) return `✦ ${t('recipe.generateBtn')} (${30 - (user.monthly_ai_count ?? 0)} left)`
    if ((user.gift_ai_points ?? 0) > 0) return `✦ ${t('recipe.generateBtn')} (-1🟠)`
    return `✦ ${t('recipe.generateBtn')} (-1🟠, ${user.paid_points ?? 0} left)`
  }

  const getButtonStyle = (): React.CSSProperties => {
    if (loading) return { background: 'rgba(28,26,22,0.15)', color: 'rgba(28,26,22,0.4)', cursor: 'wait' }
    if (shouldUsePreset) return { background: '#7A9E7E', color: '#fff', cursor: 'pointer' }
    if (!user || !canUseAI) return { background: 'rgba(28,26,22,0.15)', color: 'rgba(28,26,22,0.4)', cursor: canUseAI === null ? 'pointer' : 'not-allowed' }
    return { background: '#1C1A16', color: '#FDFAF5', cursor: 'pointer' }
  }

  const fetchPresetRecipe = async () => {
    const weightRange = getWeightRange(parseFloat(weight) || 5, species)
    const ageRange = getAgeRange(age)

    const res = await fetch(`/api/preset-recipe?species=${species}&weight_range=${weightRange}&age_range=${ageRange}`)
    const data = await res.json()
    if (data.title) {
      setIsPreset(true)
      return data
    }
    return null
  }

  const generate = async () => {
    // Free user / healthy only → use preset
    if (shouldUsePreset) {
      setLoading(true)
      try {
        const preset = await fetchPresetRecipe()
        if (preset) {
          setRecipe(preset)
          showToast('✓ ' + t('recipe.aafcoLabel'), 'success')
        } else {
          showToast('No matching recipe found', 'error')
        }
      } catch {
        showToast('Failed to load recipe', 'error')
      } finally {
        setLoading(false)
      }
      return
    }

    // Need login for non-healthy conditions
    if (!user) { onAuthRequired(); return }

    // Need credits for AI generation
    if (!canUseAI) {
      showToast(t('recipe.noCreditsMsg'), 'error')
      setTimeout(() => document.getElementById('points')?.scrollIntoView({ behavior: 'smooth' }), 1000)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species, petName, locale,
          weight: parseFloat(weight) || 5,
          age, healthConditions: health
        })
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 402) showToast('🟠 ' + (data.detail || t('recipe.noCreditsMsg')), 'error')
        else showToast(data.error || 'Generation failed', 'error')
        return
      }
      setIsPreset(false)
      setRecipe(data)
      showToast('✓ ' + t('recipe.aafcoLabel'), 'success')
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

  return (
    <div style={{ padding: '60px max(32px,4vw)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 40, alignItems: 'start' }}>

        {/* Form */}
        <div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(26px,3.5vw,38px)', fontWeight: 700, lineHeight: 1.2, marginBottom: 16 }}>
            {t('recipe.sectionTitle')}
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(28,26,22,0.6)', marginBottom: 28, fontWeight: 300 }}>
            {t('recipe.sectionSubtitle')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <select value={species} onChange={e => setSpecies(e.target.value as any)} style={selectStyle}>
                <option value="dog">{t('recipe.selectDog')}</option>
                <option value="cat">{t('recipe.selectCat')}</option>
              </select>
              <input value={petName} onChange={e => setPetName(e.target.value)} placeholder={t('recipe.petName')} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={weight} onChange={e => setWeight(e.target.value)} placeholder={t('recipe.weight')} type="number" min="0.5" max="100" style={inputStyle} />
              <select value={age} onChange={e => setAge(e.target.value)} style={selectStyle}>
                {AGE_OPTIONS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>

            {/* Health conditions */}
            <div>
              <div style={{ fontSize: 12, color: 'rgba(28,26,22,0.6)', marginBottom: 8, fontWeight: 500 }}>
                {t('recipe.healthLabel')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {HEALTH_OPTIONS.map(({ key, labelKey }) => {
                  const isHealthy = key === 'healthy'
                  const isSick = !isHealthy
                  const needsAuth = isSick && !user
                  const selected = health.includes(key)
                  return (
                    <button
                      key={key}
                      onClick={() => needsAuth ? onAuthRequired() : toggleHealth(key)}
                      style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', fontFamily: 'inherit',
                        border: `1px solid ${selected ? '#7A9E7E' : 'rgba(28,26,22,0.12)'}`,
                        background: selected ? '#7A9E7E' : needsAuth ? '#F7F3EC' : '#FDFAF5',
                        color: selected ? '#fff' : needsAuth ? 'rgba(28,26,22,0.35)' : 'rgba(28,26,22,0.6)',
                        position: 'relative'
                      }}>
                      {selected ? `✓ ${t(labelKey)}` : t(labelKey)}
                      {needsAuth && <span style={{ fontSize: 10, marginLeft: 4 }}>🔒</span>}
                    </button>
                  )
                })}
              </div>
              {!user && (
                <div style={{ fontSize: 11, color: '#C8813A', marginTop: 6 }}>
                  🔒 Health conditions for paying users · <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={onAuthRequired}>Login / Signup</span>
                </div>
              )}
            </div>

            {/* Credits status */}
            {user && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F7F3EC', fontSize: 12, color: 'rgba(28,26,22,0.6)', lineHeight: 1.6 }}>
                {user.is_pro
                  ? t('recipe.proMonthUsage', { used: user.monthly_ai_count ?? 0 })
                  : t('recipe.aiCreditsLeft', { total: (user.paid_points ?? 0) + (user.gift_ai_points ?? 0) })
                }
                {(user.gift_ai_points ?? 0) > 0 && (
                  <span style={{ color: '#C8813A' }}> {t('recipe.giftNote', { gift: user.gift_ai_points })}</span>
                )}
              </div>
            )}

            {/* Generate button */}
            <button onClick={generate} disabled={loading || (!shouldUsePreset && !!user && !canUseAI)} style={{
              padding: '12px 24px', borderRadius: 8, fontSize: 15, fontWeight: 500,
              border: 'none', fontFamily: 'inherit', transition: 'opacity 0.2s',
              opacity: loading ? 0.7 : 1,
              ...getButtonStyle()
            }}>
              {getButtonLabel()}
            </button>

            {/* Preset note */}
            {shouldUsePreset && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EBF2EC', fontSize: 12, color: '#3B6D11', lineHeight: 1.5 }}>
                ✓ {t('recipe.freeRecipeNote')}
              </div>
            )}

            {/* No credits warning */}
            {user && !canUseAI && !isHealthOnly && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FAE8E8', fontSize: 12, color: '#C45C5C', lineHeight: 1.6 }}>
                {t('recipe.noCreditsMsg')}<br />
                <span style={{ color: '#854F0B' }}>{t('recipe.upgradeHint')}</span>
              </div>
            )}

            {/* Sick pet disclaimer */}
            {health.some(h => ['kidney', 'pancreatitis', 'diabetes'].includes(h)) && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FBF0E4', fontSize: 12, color: '#854F0B', lineHeight: 1.6, border: '1px solid #FAC775' }}>
                ⚕️ {t('recipe.sickPetDisclaimer')}
              </div>
            )}
          </div>
        </div>

        {/* Result */}
        <div style={{ background: '#FDFAF5', borderRadius: 16, border: '1px solid rgba(28,26,22,0.12)', overflow: 'hidden', boxShadow: '0 4px 24px rgba(28,26,22,0.06)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(28,26,22,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700 }}>
              {recipe ? recipe.title : `${petName || (species === 'dog' ? '🐕' : '🐈')} Recipe`}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {isPreset && recipe && (
                <div style={{ fontSize: 11, fontWeight: 500, color: '#185FA5', background: '#E6F1FB', padding: '3px 8px', borderRadius: 5 }}>
                  📚 Database
                </div>
              )}
              <div style={{ fontSize: 12, fontWeight: 500, color: '#7A9E7E', background: '#EBF2EC', padding: '4px 10px', borderRadius: 6 }}>
                {t('recipe.aafcoLabel')}
              </div>
            </div>
          </div>

          <div style={{ padding: 20 }}>
            {recipe ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(28,26,22,0.5)', marginBottom: 8 }}>
                  {t('recipe.ingredientsLabel')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
                  {recipe.content.ingredients.map((ing, i) => (
                    <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: '#F7F3EC', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{ing.emoji} {ing.name}</span>
                      <span style={{ color: 'rgba(28,26,22,0.6)', fontWeight: 500 }}>{ing.amount}</span>
                    </div>
                  ))}
                </div>

                {recipe.content.warnings && recipe.content.warnings.length > 0 && (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FBF0E4', marginBottom: 12, fontSize: 12, color: '#854F0B', lineHeight: 1.5 }}>
                    ⚠️ {recipe.content.warnings.join(' · ')}
                  </div>
                )}

                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(28,26,22,0.5)', marginBottom: 8 }}>
                  {t('recipe.stepsLabel')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {recipe.content.steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'rgba(28,26,22,0.6)' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1C1A16', color: '#FDFAF5', fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>

                {/* Upgrade hint for preset */}
                {isPreset && (
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FBF0E4', fontSize: 12, color: '#854F0B', lineHeight: 1.5, marginBottom: 12, cursor: 'pointer' }} onClick={onAuthRequired}>
                    ⭐ {t('recipe.upgradeHint')}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid rgba(28,26,22,0.08)' }}>
                  {[['Calories', recipe.nutrition.calories], ['Protein', recipe.nutrition.protein], ['Fat', recipe.nutrition.fat], ['Carbs', recipe.nutrition.carbs]].map(([k, v]) => (
                    <div key={k} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, background: '#F7F3EC' }}>
                      <strong style={{ color: '#1C1A16' }}>{k}</strong> <span style={{ color: 'rgba(28,26,22,0.6)' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(28,26,22,0.3)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
                <p style={{ fontSize: 14 }}>{t('recipe.sectionSubtitle')}</p>
                <p style={{ fontSize: 12, marginTop: 8, color: 'rgba(28,26,22,0.25)' }}>
                  {isHealthOnly ? '📚 Free preset recipe available' : '🟠 ' + t('recipe.needCredits')}
                </p>
              </div>
            )}
          </div>

          <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(28,26,22,0.08)', fontSize: 11, color: 'rgba(28,26,22,0.3)', background: '#F7F3EC' }}>
            ⚠️ {t('recipe.disclaimer')}
          </div>
        </div>
      </div>

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

const selectStyle: React.CSSProperties = { flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(28,26,22,0.12)', background: '#FDFAF5', fontFamily: 'inherit', fontSize: 14, outline: 'none' }
const inputStyle: React.CSSProperties = { flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(28,26,22,0.12)', background: '#FDFAF5', fontFamily: 'inherit', fontSize: 14, outline: 'none' }
