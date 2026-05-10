'use client'
import { useState, useEffect } from 'react'
import { Profile, Ingredient, RecipeContent, NutritionInfo, SubstituteItem } from '@/types'
import { useGuestToken } from '@/hooks/useGuestToken'
import SignupPrompt from '@/components/ui/SignupPrompt'

interface Props {
  user: Profile | null
  onAuthRequired: (mode?: 'login' | 'signup') => void
  locale: string
  t: (key: string, params?: Record<string, string | number>) => string
}

const HEALTH_OPTIONS = [
  { key: 'healthy',      labelKey: 'recipe.healthy' },
  { key: 'kidney',       labelKey: 'recipe.kidney' },
  { key: 'pancreatitis', labelKey: 'recipe.pancreatitis' },
  { key: 'diabetes',     labelKey: 'recipe.diabetes' },
  { key: 'obesity',      labelKey: 'recipe.obesity' },
  { key: 'allergy',      labelKey: 'recipe.allergy' },
]

const AGE_OPTIONS = ['<1yr', '1yr', '2yr', '3yr', '5yr', '7yr', '10yr', '12yr+']

export default function RecipeDemo({ user, onAuthRequired, locale, t }: Props) {
  const [species,  setSpecies]  = useState<'dog' | 'cat'>('dog')
  const [petName,  setPetName]  = useState('')
  const [weight,   setWeight]   = useState('8')
  const [age,      setAge]      = useState('3yr')
  const [health,   setHealth]   = useState<string[]>(['healthy'])
  const [loading,  setLoading]  = useState(false)
  const [recipe,   setRecipeState]   = useState<{ title: string; content: RecipeContent; nutrition: NutritionInfo; tier?: string } | null>(null)
  const [toast,    setToast]    = useState<{ msg: string; type: 'success' | 'error' | 'warn' } | null>(null)
  const [showSignupPrompt, setShowSignupPrompt] = useState(false)

  // Helper to set recipe and persist to localStorage for guests
  const setRecipe = (r: typeof recipe) => {
    setRecipeState(r)
    if (!user && r) {
      try { localStorage.setItem('pawchef_guest_recipe', JSON.stringify(r)) } catch {}
    } else if (!r) {
      try { localStorage.removeItem('pawchef_guest_recipe') } catch {}
    }
  }

  // Guest free-use tracking
  const { guestToken, fingerprint } = useGuestToken()
  const [guestUsed,      setGuestUsed]      = useState(false)
  const [guestChecked,   setGuestChecked]   = useState(false)

  // Substitute state
  const [substituting, setSubstituting] = useState<number | null>(null)
  const [substitutes,  setSubstitutes]  = useState<Record<number, SubstituteItem[]>>({})
  const [expandedSub,  setExpandedSub]  = useState<number | null>(null)

  // Free AI remaining (updated from API response)
  const [freeRemaining, setFreeRemaining] = useState<number | null>(null)

  // Check if guest has already used their free recipe; restore cached recipe if so
  useEffect(() => {
    if (user || !guestToken) return
    const check = async () => {
      try {
        const res = await fetch(
          `/api/guest-usage?token=${encodeURIComponent(guestToken)}&fingerprint=${encodeURIComponent(fingerprint)}`
        )
        const data = await res.json()
        const used = !!data.used
        setGuestUsed(used)
        // Restore last recipe from localStorage so page refresh doesn't lose it
        if (used) {
          try {
            const cached = localStorage.getItem('pawchef_guest_recipe')
            if (cached) setRecipeState(JSON.parse(cached))
          } catch {}
        }
      } catch { /* fail silently — allow use */ }
      setGuestChecked(true)
    }
    check()
  }, [guestToken, fingerprint, user])

  // Initialise freeRemaining from user profile
  useEffect(() => {
    if (!user) return
    const used  = user.free_ai_used  ?? 0
    const limit = user.free_ai_limit ?? 3
    setFreeRemaining(Math.max(0, limit - used))
  }, [user])

  const isHealthOnly = health.length === 1 && health[0] === 'healthy'

  // ── Credit state helpers ────────────────────────────────────────────────────
  const hasFreeAI = user
    ? (user.free_ai_used ?? 0) < (user.free_ai_limit ?? 3)
    : false

  const hasPaidAI = user && (
    (user.gift_ai_points ?? 0) > 0 ||
    (user.paid_points    ?? 0) > 0 ||
    (user.is_pro && (user.monthly_ai_count ?? 0) < 30)
  )

  const canGenerate = !user
    ? (guestChecked && !guestUsed)      // guest: 1 free
    : (hasFreeAI || hasPaidAI)           // logged in: free or paid

  // ── Button label ────────────────────────────────────────────────────────────
  const getButtonLabel = () => {
    if (loading) return t('recipe.generatingBtn')

    // Guest flow
    if (!user) {
      if (!guestChecked) return t('recipe.generatingBtn')
      if (guestUsed) return t('signupPrompt.ctaSignup')
      return t('recipe.generateFree')
    }

    // Free quota
    const freeLeft = freeRemaining ?? Math.max(0, (user.free_ai_limit ?? 3) - (user.free_ai_used ?? 0))
    if (hasFreeAI) return t('recipe.generateStandard', { n: freeLeft })

    // Paid flow
    if ((user.gift_ai_points ?? 0) > 0)
      return t('recipe.generateGift', { n: user.gift_ai_points })
    if ((user.paid_points ?? 0) > 0)
      return t('recipe.generatePaid', { n: user.paid_points })
    if (user.is_pro)
      return t('recipe.generatePro', { n: 30 - (user.monthly_ai_count ?? 0) })

    return t('recipe.noCreditsBtn')
  }

  const getButtonStyle = (): React.CSSProperties => {
    if (loading || (!guestChecked && !user)) {
      return { background: 'rgba(28,26,22,0.15)', color: 'rgba(28,26,22,0.4)', cursor: 'wait' }
    }
    if (!canGenerate) {
      return { background: 'rgba(28,26,22,0.15)', color: 'rgba(28,26,22,0.4)', cursor: 'not-allowed' }
    }
    return { background: '#1C1A16', color: '#FDFAF5', cursor: 'pointer' }
  }

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

  // ── Generate ────────────────────────────────────────────────────────────────
  const generate = async () => {
    if (!user && guestUsed) { setShowSignupPrompt(true); return }
    if (!user && !guestChecked) return
    if (user && !canGenerate) {
      showToast(t('recipe.noCreditsMsg'), 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/generate-recipe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          species, petName, locale,
          weight:           parseFloat(weight) || 5,
          age,
          healthConditions: health,
          guestToken:       guestToken || undefined,
          fingerprint:      fingerprint || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        const err = data.error
        if (err === 'GUEST_LIMIT_REACHED')  { setGuestUsed(true); setShowSignupPrompt(true); return }
        if (err === 'FREE_LIMIT_REACHED')   { showToast(t('recipe.allFreeUsed', { n: user?.free_ai_limit ?? 3 }), 'warn'); return }
        if (err === 'NO_CREDITS')           { showToast(t('recipe.creditsUsed'), 'error'); return }
        if (err === 'GUEST_TOKEN_MISSING')  {
          // Shouldn't happen — retry with fresh token
          showToast('Please refresh the page and try again.', 'error'); return
        }
        showToast(data.error || 'Generation failed', 'error')
        return
      }

      setRecipe({ title: data.title, content: data.content, nutrition: data.nutrition, tier: data.tier })
      setSubstitutes({})
      setExpandedSub(null)

      // Update local free remaining
      if (data.freeRemaining !== undefined) setFreeRemaining(data.freeRemaining)
      if (!user) setGuestUsed(true)   // mark guest as used

      showToast('✓ ' + t('recipe.aafcoLabel'), 'success')
    } catch {
      showToast('Network error, please retry', 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Substitute ──────────────────────────────────────────────────────────────
  const handleSubstitute = async (ing: Ingredient, index: number) => {
    if (!user) { onAuthRequired(); return }
    const canSub = (user.gift_ai_points ?? 0) > 0 || (user.paid_points ?? 0) > 0 ||
                   (user.is_pro && (user.monthly_ai_count ?? 0) < 30)
    if (!canSub) { showToast(t('substitute.needCredits'), 'warn'); return }

    if (expandedSub === index) { setExpandedSub(null); return }
    if (substitutes[index]) { setExpandedSub(index); return }

    setSubstituting(index)
    try {
      const res = await fetch('/api/substitute-ingredient', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ingredient: ing.name, amount: ing.amount, species, healthConditions: health }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 402) showToast('🟠 ' + (data.detail || t('substitute.needCredits')), 'error')
        else showToast(data.error || 'Failed', 'error')
        return
      }
      setSubstitutes(prev => ({ ...prev, [index]: data.substitutes }))
      setExpandedSub(index)
      showToast(t('substitute.creditUsed'), 'success')
    } catch {
      showToast('Network error', 'error')
    } finally {
      setSubstituting(null)
    }
  }

  const applySubstitute = (ingredientIndex: number, sub: SubstituteItem) => {
    if (!recipe) return
    const newIngredients = recipe.content.ingredients.map((ing, i) =>
      i === ingredientIndex ? { emoji: sub.emoji, name: sub.name, amount: sub.amount } : ing
    )
    setRecipe({ ...recipe, content: { ...recipe.content, ingredients: newIngredients } })
    setExpandedSub(null)
    setSubstitutes(prev => { const next = { ...prev }; delete next[ingredientIndex]; return next })
    showToast(t('substitute.applied'), 'success')
  }

  const toastColors = {
    success: { bg: '#EBF2EC', color: '#3B6D11' },
    error:   { bg: '#FAE8E8', color: '#C45C5C' },
    warn:    { bg: '#FBF0E4', color: '#854F0B' },
  }

  // ── Computed display values ─────────────────────────────────────────────────
  const freeLeft = freeRemaining ?? (user ? Math.max(0, (user.free_ai_limit ?? 3) - (user.free_ai_used ?? 0)) : 0)
  const isPremium = recipe?.tier === 'premium'

  return (
    <div style={{ padding: '60px max(32px,4vw)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 40, alignItems: 'start' }}>

        {/* ── Form ── */}
        <div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(26px,3.5vw,38px)', fontWeight: 700, lineHeight: 1.2, marginBottom: 16 }}>
            {t('recipe.sectionTitle')}
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(28,26,22,0.6)', marginBottom: 28, fontWeight: 300 }}>
            {t('recipe.sectionSubtitle')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Species + name */}
            <div style={{ display: 'flex', gap: 10 }}>
              <select value={species} onChange={e => setSpecies(e.target.value as any)} style={selectStyle}>
                <option value="dog">{t('recipe.selectDog')}</option>
                <option value="cat">{t('recipe.selectCat')}</option>
              </select>
              <input value={petName} onChange={e => setPetName(e.target.value)} placeholder={t('recipe.petName')} style={inputStyle} />
            </div>

            {/* Weight + age */}
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
                  const needsAuth = key !== 'healthy' && !user
                  const selected  = health.includes(key)
                  return (
                    <button key={key} onClick={() => needsAuth ? onAuthRequired() : toggleHealth(key)} style={{
                      padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit',
                      border:      `1px solid ${selected ? '#7A9E7E' : 'rgba(28,26,22,0.12)'}`,
                      background:  selected ? '#7A9E7E' : needsAuth ? '#F7F3EC' : '#FDFAF5',
                      color:       selected ? '#fff' : needsAuth ? 'rgba(28,26,22,0.35)' : 'rgba(28,26,22,0.6)',
                    }}>
                      {selected ? `✓ ${t(labelKey)}` : t(labelKey)}
                      {needsAuth && <span style={{ fontSize: 10, marginLeft: 4 }}>🔒</span>}
                    </button>
                  )
                })}
              </div>
              {!user && (
                <div style={{ fontSize: 11, color: '#C8813A', marginTop: 6 }}>
                  {t('recipe.healthLockedHint')} <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => onAuthRequired()}>{t('recipe.healthLockedLogin')}</span>
                </div>
              )}
            </div>

            {/* Credit / free-use status bar */}
            {!user && guestChecked && !guestUsed && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#EBF2EC', fontSize: 12, color: '#3B6D11', lineHeight: 1.6 }}>
                🎁 {t('recipe.guestFreeAvailable')}
              </div>
            )}
            {!user && guestChecked && guestUsed && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F7F3EC', fontSize: 12, color: 'rgba(28,26,22,0.6)', lineHeight: 1.6 }}>
                {t('recipe.guestLimitReached')} · <span style={{ color: '#185FA5', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowSignupPrompt(true)}>{t('recipe.signupForMore')}</span>
              </div>
            )}
            {user && hasFreeAI && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#EBF2EC', fontSize: 12, color: '#3B6D11', lineHeight: 1.6 }}>
                ⚡ {t('recipe.freeRemaining', { n: freeLeft })}
              </div>
            )}
            {user && !hasFreeAI && (
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
            <button
              onClick={generate}
              disabled={loading || (!guestChecked && !user)}
              style={{
                padding: '12px 24px', borderRadius: 8, fontSize: 15, fontWeight: 500,
                border: 'none', fontFamily: 'inherit', transition: 'opacity 0.2s',
                opacity: loading ? 0.7 : 1,
                ...getButtonStyle()
              }}>
              {getButtonLabel()}
            </button>

            {/* No-credits state for logged-in users */}
            {user && !canGenerate && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FAE8E8', fontSize: 12, color: '#C45C5C', lineHeight: 1.6 }}>
                {t('recipe.allFreeUsed', { n: user.free_ai_limit ?? 3 })}<br />
                <span style={{ color: '#854F0B' }}>{t('recipe.upgradeHint')}</span>
              </div>
            )}

            {health.some(h => ['kidney', 'pancreatitis', 'diabetes'].includes(h)) && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FBF0E4', fontSize: 12, color: '#854F0B', lineHeight: 1.6, border: '1px solid #FAC775' }}>
                ⚕️ {t('recipe.sickPetDisclaimer')}
              </div>
            )}
          </div>
        </div>

        {/* ── Result card ── */}
        <div style={{ background: '#FDFAF5', borderRadius: 16, border: '1px solid rgba(28,26,22,0.12)', overflow: 'hidden', boxShadow: '0 4px 24px rgba(28,26,22,0.06)' }}>
          {/* Card header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(28,26,22,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700 }}>
              {recipe ? recipe.title : `${petName || (species === 'dog' ? '🐕' : '🐈')} Recipe`}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {recipe && (
                <div style={{
                  fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 5,
                  background: isPremium ? '#FBF0E4' : '#F7F3EC',
                  color:      isPremium ? '#C8813A' : 'rgba(28,26,22,0.6)',
                }}>
                  {isPremium ? t('recipe.premiumBadge') : t('recipe.standardBadge')}
                </div>
              )}
              <div style={{ fontSize: 12, fontWeight: 500, color: '#7A9E7E', background: '#EBF2EC', padding: '4px 10px', borderRadius: 6 }}>
                {t('recipe.aafcoLabel')}
              </div>
            </div>
          </div>

          {/* Card body */}
          <div style={{ padding: 20 }}>
            {recipe ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(28,26,22,0.5)', marginBottom: 8 }}>
                  {t('recipe.ingredientsLabel')}
                  {user && (
                    <span style={{ fontWeight: 400, marginLeft: 6, color: 'rgba(28,26,22,0.35)' }}>
                      · {t('substitute.btn')} {t('substitute.needCredits').toLowerCase()}
                    </span>
                  )}
                </div>

                {/* Ingredient list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                  {recipe.content.ingredients.map((ing, i) => (
                    <div key={i}>
                      <div style={{
                        padding: '8px 12px', borderRadius: expandedSub === i ? '8px 8px 0 0' : 8,
                        background: expandedSub === i ? '#EBF2EC' : '#F7F3EC',
                        display: 'flex', alignItems: 'center', gap: 8,
                        border: expandedSub === i ? '1px solid rgba(122,158,126,0.3)' : '1px solid transparent',
                        borderBottom: expandedSub === i ? 'none' : undefined,
                        transition: 'background 0.15s',
                      }}>
                        <span style={{ fontSize: 13, flex: 1 }}>{ing.emoji} {ing.name}</span>
                        <span style={{ color: 'rgba(28,26,22,0.6)', fontWeight: 500, fontSize: 13, flexShrink: 0 }}>{ing.amount}</span>
                        {user && (
                          <button
                            onClick={() => handleSubstitute(ing, i)}
                            disabled={substituting === i}
                            title={t('substitute.suggestions', { name: ing.name })}
                            style={{
                              padding: '2px 7px', borderRadius: 5, fontSize: 11,
                              cursor: substituting === i ? 'wait' : 'pointer',
                              border: '1px solid rgba(28,26,22,0.15)',
                              background: expandedSub === i ? '#7A9E7E' : '#FDFAF5',
                              color: expandedSub === i ? '#fff' : 'rgba(28,26,22,0.5)',
                              fontFamily: 'inherit', flexShrink: 0, lineHeight: 1.6,
                            }}>
                            {substituting === i ? '…' : t('substitute.btn')}
                          </button>
                        )}
                      </div>

                      {expandedSub === i && substitutes[i] && (
                        <div style={{
                          border: '1px solid rgba(122,158,126,0.3)', borderTop: 'none',
                          borderRadius: '0 0 8px 8px', background: '#F7FCF8', padding: '10px 12px',
                        }}>
                          <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.5)', marginBottom: 8, fontWeight: 500 }}>
                            {t('substitute.suggestions', { name: ing.name })} · <span style={{ color: '#C8813A' }}>{t('substitute.creditUsed')}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {substitutes[i].map((sub, si) => (
                              <div key={si} style={{ padding: '8px 10px', borderRadius: 8, background: '#FDFAF5', border: '1px solid rgba(28,26,22,0.08)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                  <span style={{ fontSize: 13, fontWeight: 500 }}>
                                    {sub.emoji} {sub.name} <span style={{ color: 'rgba(28,26,22,0.5)', fontWeight: 400 }}>{sub.amount}</span>
                                  </span>
                                  <button onClick={() => applySubstitute(i, sub)} style={{
                                    padding: '2px 8px', borderRadius: 5, fontSize: 11,
                                    cursor: 'pointer', border: 'none',
                                    background: '#1C1A16', color: '#FDFAF5', fontFamily: 'inherit',
                                  }}>
                                    {t('substitute.apply')}
                                  </button>
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.5)', lineHeight: 1.4 }}>{sub.reason}</div>
                                {sub.nutrition_note && (
                                  <div style={{ fontSize: 11, color: '#854F0B', marginTop: 2 }}>{sub.nutrition_note}</div>
                                )}
                              </div>
                            ))}
                          </div>
                          <button onClick={() => setExpandedSub(null)} style={{ marginTop: 8, fontSize: 11, color: 'rgba(28,26,22,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                            {t('substitute.collapse')}
                          </button>
                        </div>
                      )}
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

                {/* Standard / Premium note */}
                {recipe.tier === 'standard' && (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F7F3EC', fontSize: 11, color: 'rgba(28,26,22,0.5)', marginBottom: 12 }}>
                    ⚡ {t('recipe.standardNote')}
                  </div>
                )}

                {/* Nutrition row */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid rgba(28,26,22,0.08)' }}>
                  {([
                    [t('recipe.nutriCalories'), recipe.nutrition.calories],
                    [t('recipe.nutriProtein'),  recipe.nutrition.protein],
                    [t('recipe.nutriFat'),      recipe.nutrition.fat],
                    [t('recipe.nutriCarbs'),    recipe.nutrition.carbs],
                  ] as [string, string][]).map(([k, v]) => (
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
                  {!user && !guestUsed ? t('recipe.guestFreeAvailable') : ''}
                </p>
              </div>
            )}
          </div>

          <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(28,26,22,0.08)', fontSize: 11, color: 'rgba(28,26,22,0.3)', background: '#F7F3EC' }}>
            ⚠️ {t('recipe.disclaimer')}
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
          color:      toastColors[toast.type].color,
          border:     `1px solid ${toastColors[toast.type].color}30`,
        }}>
          {toast.msg}
        </div>
      )}

      {/* Signup prompt modal */}
      {showSignupPrompt && (
        <SignupPrompt
          t={t}
          onSignup={() => { setShowSignupPrompt(false); onAuthRequired('signup') }}
          onLogin={()  => { setShowSignupPrompt(false); onAuthRequired('login') }}
          onClose={() => setShowSignupPrompt(false)}
        />
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = { flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(28,26,22,0.12)', background: '#FDFAF5', fontFamily: 'inherit', fontSize: 14, outline: 'none' }
const inputStyle:  React.CSSProperties = { flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(28,26,22,0.12)', background: '#FDFAF5', fontFamily: 'inherit', fontSize: 14, outline: 'none' }
