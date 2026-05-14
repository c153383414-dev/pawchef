'use client'
import { useState, useEffect, useRef } from 'react'
import { Profile, Ingredient, RecipeContent, NutritionInfo, RecipeCompliance, SubstituteItem } from '@/types'
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

// ── 错误码格式化（dev 显示详情，prod 显示错误码）──────────────────────────────
const DEBUG = process.env.NEXT_PUBLIC_DEBUG_ERRORS === 'true'
function formatApiError(data: { error?: string; messageKey?: string; detail?: string }, status?: number): string {
  const code = data.error || `HTTP_${status}`
  if (DEBUG) {
    const extra = [data.messageKey, data.detail].filter(Boolean).join(' | ')
    return extra ? `[${code}] ${extra}` : `[${code}]`
  }
  return `[${code}]`
}

// 年龄字符串 → 月份（传给 substitute API 用）
function parseAgeToMonths(age: string): number {
  if (age === '<1yr') return 6
  if (age === '12yr+') return 144
  const match = age.match(/^(\d+)yr$/)
  return match ? parseInt(match[1]) * 12 : 36
}

const INGREDIENT_NOTES: Record<string, string> = {
  chicken_liver:    'ingredient.note.liver',
  chicken_gizzard:  'ingredient.note.gizzard',
  salmon:           'ingredient.note.salmon',
  mackerel:         'ingredient.note.mackerel',
  sardines_canned:  'ingredient.note.sardines',
  beef_lean:        'ingredient.note.beef',
  beef_heart:       'ingredient.note.heart',
  rabbit_meat:      'ingredient.note.rabbit',
  lamb_leg:         'ingredient.note.lamb',
  egg_cooked:       'ingredient.note.egg',
  pumpkin:          'ingredient.note.pumpkin',
  broccoli:         'ingredient.note.broccoli',
  carrot:           'ingredient.note.carrot',
  blueberry:        'ingredient.note.blueberry',
  sweet_potato:     'ingredient.note.sweet_potato',
  spinach:          'ingredient.note.spinach',
  green_peas:       'ingredient.note.green_peas',
}

const PREFS_KEY = 'pawchef_form_prefs'

export default function RecipeDemo({ user, onAuthRequired, locale, t }: Props) {
  const [species,  setSpecies]  = useState<'dog' | 'cat'>('dog')
  const [petName,  setPetName]  = useState('')
  const [weight,   setWeight]   = useState('8')
  const [age,      setAge]      = useState('3yr')
  const [health,   setHealth]   = useState<string[]>(['healthy'])
  const [loading,  setLoading]  = useState(false)
  const [recipe,   setRecipeState] = useState<{
    title: string
    content: RecipeContent
    nutrition: NutritionInfo
    compliance?: RecipeCompliance
    tier?: string
  } | null>(null)
  const [toast,    setToast]    = useState<{ msg: string; type: 'success' | 'error' | 'warn' } | null>(null)
  const [showSignupPrompt, setShowSignupPrompt] = useState(false)
  const [proMonthlyDelta, setProMonthlyDelta] = useState(0)

  const setRecipe = (r: typeof recipe) => {
    setRecipeState(r)
    // 登录用户用独立 key 存储，访客用通用 key
    const storageKey = user ? `pawchef_recipe_${user.id}` : 'pawchef_guest_recipe'
    if (r) {
      try { localStorage.setItem(storageKey, JSON.stringify(r)) } catch {}
    } else {
      try { localStorage.removeItem(storageKey) } catch {}
    }
  }

  // 登录用户：从 localStorage 恢复上次生成的食谱（页面刷新后不丢失）
  useEffect(() => {
    if (!user?.id) return
    try {
      const cached = localStorage.getItem(`pawchef_recipe_${user.id}`)
      if (cached) setRecipeState(JSON.parse(cached))
    } catch {}
  }, [user?.id])

  // 表单偏好记忆：首次挂载时恢复上次设置
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY)
      if (saved) {
        const p = JSON.parse(saved)
        if (p.species) setSpecies(p.species)
        if (p.weight)  setWeight(p.weight)
        if (p.age)     setAge(p.age)
        if (p.health)  setHealth(p.health)
        if (p.petName) setPetName(p.petName)
      }
    } catch {}
  }, [])

  // 表单偏好变化时自动保存
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ species, weight, age, health, petName })) } catch {}
  }, [species, weight, age, health, petName])

  const { guestToken, fingerprint } = useGuestToken()
  const [guestUsed,    setGuestUsed]    = useState(false)
  const [guestChecked, setGuestChecked] = useState(false)
  const reconciledForUser  = useRef<string | null>(null)
  const reconciledFreeLeft = useRef<number | null>(null)

  // 食材替换：单个 substitute 替代原来的数组
  const [substituting, setSubstituting] = useState<number | null>(null)
  const [substitutes,  setSubstitutes]  = useState<Record<number, SubstituteItem & { reason?: string }>>({})
  const [expandedSub,  setExpandedSub]  = useState<number | null>(null)

  const [freeRemaining, setFreeRemaining] = useState<number | null>(null)
  const [showShoppingList, setShowShoppingList] = useState(false)
  const [autoLogged,       setAutoLogged]       = useState(false)
  const [copyDone,         setCopyDone]         = useState(false)

  // 检查访客是否已用过
  useEffect(() => {
    if (user || !guestToken) return
    const check = async () => {
      try {
        const res  = await fetch(`/api/guest-usage?token=${encodeURIComponent(guestToken)}&fingerprint=${encodeURIComponent(fingerprint)}`)
        const data = await res.json()
        const used = !!data.used
        setGuestUsed(used)
        if (used) {
          try {
            const cached = localStorage.getItem('pawchef_guest_recipe')
            if (cached) setRecipeState(JSON.parse(cached))
          } catch {}
        }
      } catch { /* fail silently */ }
      setGuestChecked(true)
    }
    check()
  }, [guestToken, fingerprint, user])

  // 从 profile 初始化 freeRemaining（若已对访客用量完成修正则不覆盖）
  useEffect(() => {
    if (!user) return
    if (reconciledFreeLeft.current !== null) return
    const used  = user.free_ai_used  ?? 0
    const limit = user.free_ai_limit ?? 2
    setFreeRemaining(Math.max(0, limit - used))
  }, [user])

  // 登录后对访客已用次数进行修正（每 session 每用户只跑一次）
  useEffect(() => {
    if (!user || !guestToken || reconciledForUser.current === user.id) return
    reconciledForUser.current = user.id
    fetch('/api/reconcile-guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestToken, fingerprint }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.freeRemaining !== undefined) {
          reconciledFreeLeft.current = data.freeRemaining
          setFreeRemaining(data.freeRemaining)
        }
      })
      .catch(() => {})
  }, [user?.id, guestToken])

  const isHealthOnly = health.length === 1 && health[0] === 'healthy'

  // 体重校验
  const weightNum        = parseFloat(weight)
  const weightMax        = species === 'cat' ? 15 : 100
  const weightValid      = !isNaN(weightNum) && weightNum >= 1 && weightNum <= weightMax
  const showCatOverweight = species === 'cat' && weightValid && weightNum > 10 && !health.includes('obesity')

  // 积分状态
  const hasFreeAI = user ? (user.free_ai_used ?? 0) < (user.free_ai_limit ?? 2) : false

  const isPro = user ? (user.is_pro && (user.pro_expires_at ? new Date(user.pro_expires_at) > new Date() : false)) : false

  const hasPaidAI = user && (
    (user.gift_ai_points ?? 0) > 0 ||
    (user.paid_points    ?? 0) > 0 ||
    (isPro && ((user.monthly_ai_count ?? 0) + proMonthlyDelta) < 30)
  )

  const canGenerate = weightValid && (!user
    ? (guestChecked && !guestUsed)
    : (hasFreeAI || hasPaidAI))

  // 按钮文案
  const getButtonLabel = () => {
    if (loading) return t('recipe.generatingBtn')
    if (!user) {
      if (!guestChecked) return t('recipe.generatingBtn')
      if (guestUsed)     return t('signupPrompt.ctaSignup')
      return t('recipe.generateFree')
    }
    // Pro users always show Pro quota first, regardless of remaining free quota
    if (isPro) return t('recipe.generatePro', { n: 30 - ((user.monthly_ai_count ?? 0) + proMonthlyDelta) })
    const freeLeft = freeRemaining ?? Math.max(0, (user.free_ai_limit ?? 2) - (user.free_ai_used ?? 0))
    if (hasFreeAI) return t('recipe.generateStandard', { n: freeLeft })
    if ((user.gift_ai_points ?? 0) > 0) return t('recipe.generateGift', { n: user.gift_ai_points })
    if ((user.paid_points    ?? 0) > 0) return t('recipe.generatePaid', { n: user.paid_points })
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

  // ── Generate ─────────────────────────────────────────────────────────────
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
          guestToken:       !user ? (guestToken || undefined) : undefined,
          fingerprint:      !user ? (fingerprint || undefined) : undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        const err = data.error
        if (err === 'GUEST_LIMIT_REACHED') {
          if (user) showToast('会话异常，请刷新页面后重试', 'error')
          else { setGuestUsed(true); setShowSignupPrompt(true) }
          return
        }
        if (err === 'FREE_LIMIT_REACHED')  { showToast(t('recipe.allFreeUsed', { n: user?.free_ai_limit ?? 2 }), 'warn'); return }
        if (err === 'NO_CREDITS')          { showToast(t('recipe.creditsUsed'), 'error'); return }
        if (err === 'AUTH_REQUIRED' || err === 'GUEST_TOKEN_MISSING') {
          showToast('会话已过期，请刷新页面后重新登录', 'error'); return
        }
        showToast(formatApiError(data, res.status), 'error')
        return
      }

      // 转换新 API 响应格式为组件内部格式
      setRecipe({
        title: data.title,
        content: {
          ingredients: data.ingredients || [],
          steps:       data.steps       || [],
          warnings:    (data.warnings || []).filter((w: string) => !w.startsWith('ingredient_removed:')),
        },
        nutrition:  data.nutrition,
        compliance: data.compliance,
        tier:       data.generatedBy === 'claude-sonnet' ? 'premium' : 'standard',
      })
      setSubstitutes({})
      setExpandedSub(null)

      if (data.freeRemaining !== undefined) setFreeRemaining(data.freeRemaining)
      if (data.proMonthlyUsed) setProMonthlyDelta(d => d + 1)
      if (!user) setGuestUsed(true)

      // Pro 自动记录喂食日志
      if (isPro && user) {
        setAutoLogged(false)
        fetch('/api/feeding-log', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            pet_name:    petName || null,
            meal_title:  data.title,
            meal_type:   'dinner',
            ingredients: data.ingredients || [],
            nutrition: {
              calories:   data.nutrition?.calories,
              protein:    data.nutrition?.protein,
              fat:        data.nutrition?.fat,
              carbs:      data.nutrition?.carbs,
              compliance: data.compliance?.label,
            },
            fed_at: new Date().toISOString(),
          }),
        }).then(r => { if (r.ok) setAutoLogged(true) }).catch(() => {})
      }

      // 显示被移除的食材警告
      const removed = (data.warnings || []).filter((w: string) => w.startsWith('ingredient_removed:'))
      if (removed.length > 0) {
        const names = removed.map((w: string) => w.replace('ingredient_removed:', '')).join(', ')
        showToast(t('recipe.warning.ingredient_removed', { name: names }), 'warn')
      } else {
        const toastType = data.compliance?.label === 'compliant' ? 'success' : 'warn'
        showToast(t(data.compliance?.labelKey || ('compliance.label.compliant_' + (data.compliance?.standard || 'dog_adult'))), toastType)
      }
    } catch {
      showToast('Network error, please retry', 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Substitute ───────────────────────────────────────────────────────────
  const handleSubstitute = async (ing: Ingredient, index: number, forceRefresh = false) => {
    if (!user) { onAuthRequired(); return }
    const canSub = (user.gift_ai_points ?? 0) > 0 || (user.paid_points ?? 0) > 0 ||
                   (isPro && ((user.monthly_ai_count ?? 0) + proMonthlyDelta) < 30)
    if (!canSub) { showToast(t('substitute.needCredits'), 'warn'); return }

    // 折叠：再次点击同一个且没有强制刷新
    if (expandedSub === index && !forceRefresh) { setExpandedSub(null); return }
    // 有缓存且不强制刷新：直接展开，不消耗积分
    if (substitutes[index] && !forceRefresh) { setExpandedSub(index); return }

    setSubstituting(index)
    // 强制刷新时清除旧结果
    if (forceRefresh) {
      setSubstitutes(prev => { const next = { ...prev }; delete next[index]; return next })
    }
    try {
      const res = await fetch('/api/substitute-ingredient', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          targetIngredient: ing.name,
          targetDbName:     ing.dbName,
          targetCategory:   ing.category,
          currentRecipe:    { ingredients: recipe?.content.ingredients || [] },
          pet: {
            species,
            weightKg:         parseFloat(weight) || 5,
            ageMonths:        parseAgeToMonths(age),
            healthConditions: health,
          },
          allergens: [],
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 402) showToast('🟠 ' + t('substitute.needCredits'), 'error')
        else showToast(formatApiError(data, res.status), 'error')
        return
      }
      setSubstitutes(prev => ({ ...prev, [index]: data.substitute }))
      setExpandedSub(index)

      // 更新食谱合规信息
      if (data.updatedCompliance && recipe) {
        setRecipeState(prev => prev ? { ...prev, compliance: { ...prev.compliance!, ...data.updatedCompliance } } : prev)
      }

      // Pro 月度用量同步（替换也消耗 pro_monthly 配额）
      if (data.proMonthlyUsed) setProMonthlyDelta(d => d + 1)

      showToast(isPro ? t('substitute.creditUsedPro') : t('substitute.creditUsed'), 'success')
    } catch {
      showToast('Network error', 'error')
    } finally {
      setSubstituting(null)
    }
  }

  const applySubstitute = (ingredientIndex: number, sub: SubstituteItem) => {
    if (!recipe) return
    const newIngredients = recipe.content.ingredients.map((ing, i) =>
      i === ingredientIndex
        ? { emoji: sub.emoji, name: sub.name, dbName: sub.dbName, amount: sub.amount || `${sub.amountG}g` }
        : ing
    )
    // 使用 AI 重新生成的烹饪步骤（如有），否则保留原步骤
    const newSteps = sub.newSteps && sub.newSteps.length > 0
      ? sub.newSteps
      : recipe.content.steps
    setRecipe({ ...recipe, content: { ...recipe.content, ingredients: newIngredients, steps: newSteps } })
    setExpandedSub(null)
    setSubstitutes(prev => { const next = { ...prev }; delete next[ingredientIndex]; return next })
    showToast(t('substitute.applied'), 'success')
  }

  const toastColors = {
    success: { bg: '#EBF2EC', color: '#3B6D11' },
    error:   { bg: '#FAE8E8', color: '#C45C5C' },
    warn:    { bg: '#FBF0E4', color: '#854F0B' },
  }

  const freeLeft   = freeRemaining ?? (user ? Math.max(0, (user.free_ai_limit ?? 2) - (user.free_ai_used ?? 0)) : 0)
  const isPremium  = recipe?.tier === 'premium'
  const compliance = recipe?.compliance

  // 合规标签样式
  const complianceStyle = compliance ? {
    compliant:     { bg: '#EBF2EC', color: '#3B6D11', prefix: '✓' },
    partial:       { bg: '#FBF0E4', color: '#854F0B', prefix: '△' },
    'non-compliant': { bg: '#FAE8E8', color: '#C45C5C', prefix: '⚠' },
  }[compliance.label] : null

  return (
    <div style={{ padding: '60px max(32px,4vw)' }}>
      {/* 顶部常驻免责声明 */}
      <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.4)', padding: '6px 0', marginBottom: 8, borderBottom: '1px solid rgba(28,26,22,0.06)' }}>
        ⚕ {t('recipe.disclaimer_short')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 40, alignItems: 'start' }}>

        {/* ── 表单 ── */}
        <div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(26px,3.5vw,38px)', fontWeight: 700, lineHeight: 1.2, marginBottom: 16 }}>
            {t('recipe.sectionTitle')}
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(28,26,22,0.6)', marginBottom: 28, fontWeight: 300 }}>
            {t('recipe.sectionSubtitle')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 物种 + 名字 */}
            <div style={{ display: 'flex', gap: 10 }}>
              <select value={species} onChange={e => setSpecies(e.target.value as any)} style={selectStyle}>
                <option value="dog">{t('recipe.selectDog')}</option>
                <option value="cat">{t('recipe.selectCat')}</option>
              </select>
              <input value={petName} onChange={e => setPetName(e.target.value)} placeholder={t('recipe.petName')} style={inputStyle} />
            </div>

            {/* 体重 + 年龄 */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  placeholder={t('recipe.weight')}
                  type="number" min="1" max={weightMax}
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', paddingRight: 40, border: weight && !weightValid ? '1px solid #C45C5C' : undefined }}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'rgba(28,26,22,0.4)', fontWeight: 500, pointerEvents: 'none' }}>kg</span>
                <div style={{ fontSize: 11, marginTop: 4, color: weight && !weightValid ? '#C45C5C' : 'rgba(28,26,22,0.38)', lineHeight: 1.4 }}>
                  {weight && !weightValid && weightNum < 1
                    ? t('recipe.weightErrorTooLow')
                    : weight && !weightValid && weightNum > weightMax
                      ? t('recipe.weightErrorTooHigh')
                      : t(species === 'dog' ? 'recipe.weightHintDog' : 'recipe.weightHintCat')}
                </div>
                {showCatOverweight && (
                  <div style={{ fontSize: 11, marginTop: 3, color: '#C8813A', lineHeight: 1.4 }}>
                    {t('recipe.weightHintCatOverweight')}
                  </div>
                )}
              </div>
              <select value={age} onChange={e => setAge(e.target.value)} style={selectStyle}>
                {AGE_OPTIONS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>

            {/* 健康状况：非 Pro 用户锁定除"健康"以外选项 */}
            <div>
              <div style={{ fontSize: 12, color: 'rgba(28,26,22,0.6)', marginBottom: 8, fontWeight: 500 }}>
                {t('recipe.healthLabel')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {HEALTH_OPTIONS.map(({ key, labelKey }) => {
                  const needsPro = key !== 'healthy' && !isPro
                  const selected = health.includes(key)
                  return (
                    <button key={key} onClick={() => {
                      if (needsPro && !user) { onAuthRequired(); return }
                      if (needsPro) return  // logged-in non-Pro: hint text already shown below
                      toggleHealth(key)
                    }} style={{
                      padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit',
                      border:     `1px solid ${selected ? '#7A9E7E' : 'rgba(28,26,22,0.12)'}`,
                      background: selected ? '#7A9E7E' : needsPro ? '#F7F3EC' : '#FDFAF5',
                      color:      selected ? '#fff' : needsPro ? 'rgba(28,26,22,0.35)' : 'rgba(28,26,22,0.6)',
                    }}>
                      {selected ? `✓ ${t(labelKey)}` : t(labelKey)}
                      {needsPro && <span style={{ fontSize: 10, marginLeft: 4 }}>👑</span>}
                    </button>
                  )
                })}
              </div>
              {!isPro && user && (
                // 已登录非 Pro：引导订阅，点击滚到定价区
                <div style={{ fontSize: 11, color: '#C8813A', marginTop: 6 }}>
                  {t('recipe.healthLockedHint')} <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>{t('recipe.healthLockedLogin')}</span>
                </div>
              )}
              {!user && (
                // 未登录：需要先登录才能订阅 Pro
                <div style={{ fontSize: 11, color: '#C8813A', marginTop: 6 }}>
                  {t('recipe.healthLockedNoLogin')} <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => onAuthRequired()}>{t('recipe.healthLockedLoginAction')}</span>
                </div>
              )}
            </div>

            {/* 积分状态栏 */}
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
            {user && isPro && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FBF0E4', fontSize: 12, color: '#854F0B', lineHeight: 1.6 }}>
                {t('recipe.proMonthUsage', { used: (user.monthly_ai_count ?? 0) + proMonthlyDelta })}
              </div>
            )}
            {user && !isPro && hasFreeAI && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#EBF2EC', fontSize: 12, color: '#3B6D11', lineHeight: 1.6 }}>
                ⚡ {t('recipe.freeRemaining', { n: freeLeft })}
              </div>
            )}
            {user && !isPro && !hasFreeAI && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F7F3EC', fontSize: 12, color: 'rgba(28,26,22,0.6)', lineHeight: 1.6 }}>
                {t('recipe.aiCreditsLeft', { total: (user.paid_points ?? 0) + (user.gift_ai_points ?? 0) })}
                {(user.gift_ai_points ?? 0) > 0 && (
                  <span style={{ color: '#C8813A' }}> {t('recipe.giftNote', { gift: user.gift_ai_points })}</span>
                )}
              </div>
            )}

            {/* 生成按钮 */}
            <button
              onClick={generate}
              disabled={loading || !weightValid || (!guestChecked && !user)}
              style={{
                padding: '12px 24px', borderRadius: 8, fontSize: 15, fontWeight: 500,
                border: 'none', fontFamily: 'inherit', transition: 'opacity 0.2s',
                opacity: loading ? 0.7 : 1,
                ...getButtonStyle()
              }}>
              {getButtonLabel()}
            </button>

            {user && !canGenerate && weightValid && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FAE8E8', fontSize: 12, color: '#C45C5C', lineHeight: 1.6 }}>
                {t('recipe.allFreeUsed', { n: user.free_ai_limit ?? 2 })}<br />
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

        {/* ── 结果卡片 ── */}
        <div style={{ background: '#FDFAF5', borderRadius: 16, border: '1px solid rgba(28,26,22,0.12)', overflow: 'hidden', boxShadow: '0 4px 24px rgba(28,26,22,0.06)' }}>
          {/* 卡片头 */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(28,26,22,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700 }}>
              {recipe ? recipe.title : `${petName || (species === 'dog' ? '🐕' : '🐈')} Recipe`}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {recipe && (
                <div style={{
                  fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 5,
                  background: isPremium ? '#FBF0E4' : '#F7F3EC',
                  color:      isPremium ? '#C8813A' : 'rgba(28,26,22,0.6)',
                }}>
                  {isPremium ? t('recipe.premiumBadge') : t('recipe.standardBadge')}
                </div>
              )}
              {compliance && complianceStyle && (
                <div style={{
                  fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 5,
                  background: complianceStyle.bg, color: complianceStyle.color,
                }}>
                  {complianceStyle.prefix} {t(compliance.labelKey)}
                </div>
              )}
            </div>
          </div>

          {/* 卡片体 */}
          <div style={{ padding: 20 }}>
            {recipe ? (
              <>
                {/* 适合谁标签 */}
                {(() => {
                  const kcal  = parseFloat(recipe.nutrition.calories.replace(/[^0-9.]/g, '')) || 1
                  const protG = parseFloat(recipe.nutrition.protein.replace(/[^0-9.]/g, '')) || 0
                  const fatG  = parseFloat(recipe.nutrition.fat.replace(/[^0-9.]/g, ''))     || 0
                  const pPct  = protG * 4 / kcal * 100
                  const fPct  = fatG  * 9 / kcal * 100

                  const isPuppy = age === 'puppy' || age === 'kitten'
                  const tags: { key: string; bg: string; color: string }[] = []
                  if (health.includes('kidney'))         tags.push({ key: 'suitable.kidney',        bg: '#EBF2EC', color: '#3B6D11' })
                  if (health.includes('pancreatitis'))   tags.push({ key: 'suitable.lowFat',         bg: '#FBF0E4', color: '#854F0B' })
                  if (health.includes('obesity'))        tags.push({ key: 'suitable.weightControl',  bg: '#FBF0E4', color: '#854F0B' })
                  if (health.includes('diabetes'))       tags.push({ key: 'suitable.diabetes',       bg: '#EBF2EC', color: '#3B6D11' })
                  if (health.includes('allergy'))        tags.push({ key: 'suitable.novelProtein',   bg: '#F0EEF7', color: '#5B4E8A' })
                  if (isPuppy)                           tags.push({ key: 'suitable.puppy',          bg: '#EBF2EC', color: '#3B6D11' })
                  if (health.includes('healthy') && !isPuppy) {
                    if (pPct > 55) tags.push({ key: 'suitable.highProtein',  bg: '#EBF2EC', color: '#3B6D11' })
                    if (fPct < 20) tags.push({ key: 'suitable.lean',         bg: '#F7F3EC', color: '#854F0B' })
                    tags.push({ key: 'suitable.healthyAdult', bg: '#F7F3EC', color: 'rgba(28,26,22,0.6)' })
                  }
                  if (!tags.length) return null
                  return (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      {tags.map(tag => (
                        <span key={tag.key} style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 5, background: tag.bg, color: tag.color }}>
                          {t(tag.key)}
                        </span>
                      ))}
                    </div>
                  )
                })()}

                {/* 热量偏差提示 */}
                {compliance && !compliance.caloriesOk && (
                  <div style={{ padding: '6px 10px', borderRadius: 6, background: '#FBF0E4', fontSize: 11, color: '#854F0B', marginBottom: 10 }}>
                    ⚠ {t('recipe.calories_warning', {
                      actual: recipe.nutrition.calories.replace('~', ''),
                      min: compliance.targetCalories.min,
                      max: compliance.targetCalories.max,
                    })}
                  </div>
                )}

                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(28,26,22,0.5)', marginBottom: 8 }}>
                  {t('recipe.ingredientsLabel')}
                  {user && (
                    <span style={{ fontWeight: 400, marginLeft: 6, color: 'rgba(28,26,22,0.35)' }}>
                      · {t('substitute.btn')} {t('substitute.needCredits').toLowerCase()}
                    </span>
                  )}
                </div>

                {/* 食材列表 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                  {recipe.content.ingredients.map((ing, i) => (
                    <div key={i}>
                      <div style={{
                        padding: '8px 12px', borderRadius: expandedSub === i ? '8px 8px 0 0' : 8,
                        background: ing.autoAdded ? '#F0F7F0' : (expandedSub === i ? '#EBF2EC' : '#F7F3EC'),
                        display: 'flex', alignItems: 'center', gap: 8,
                        border: expandedSub === i ? '1px solid rgba(122,158,126,0.3)' : (ing.autoAdded ? '1px solid rgba(122,158,126,0.2)' : '1px solid transparent'),
                        borderBottom: expandedSub === i ? 'none' : undefined,
                        transition: 'background 0.15s',
                      }}>
                        <span style={{ fontSize: 13, flex: 1 }}>
                          {ing.emoji} {ing.name}
                          {!ing.autoAdded && ing.dbName && INGREDIENT_NOTES[ing.dbName] && (
                            <span style={{ display: 'block', fontSize: 10, color: 'rgba(28,26,22,0.38)', marginTop: 1, lineHeight: 1.4, fontWeight: 400 }}>
                              {t(INGREDIENT_NOTES[ing.dbName])}
                            </span>
                          )}
                        </span>
                        <span style={{ color: 'rgba(28,26,22,0.6)', fontWeight: 500, fontSize: 13, flexShrink: 0 }}>{ing.amount}</span>
                        {ing.autoAdded && ing.reasonKey && (
                          <span style={{ fontSize: 10, color: '#3B6D11', background: 'rgba(59,109,17,0.08)', padding: '2px 6px', borderRadius: 4, flexShrink: 0, whiteSpace: 'nowrap' }}>
                            {t(ing.reasonKey)}
                          </span>
                        )}
                        {user && !ing.autoAdded && (
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
                            {t('substitute.suggestions', { name: ing.name })} · <span style={{ color: isPro ? '#7A9E7E' : '#C8813A' }}>{isPro ? t('substitute.creditUsedPro') : t('substitute.creditUsed')}</span>
                          </div>
                          <div style={{ padding: '8px 10px', borderRadius: 8, background: '#FDFAF5', border: '1px solid rgba(28,26,22,0.08)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                              <span style={{ fontSize: 13, fontWeight: 500 }}>
                                {substitutes[i].emoji} {substitutes[i].name} <span style={{ color: 'rgba(28,26,22,0.5)', fontWeight: 400 }}>{substitutes[i].amount}</span>
                              </span>
                              <button onClick={() => applySubstitute(i, substitutes[i])} style={{
                                padding: '2px 8px', borderRadius: 5, fontSize: 11,
                                cursor: 'pointer', border: 'none',
                                background: '#1C1A16', color: '#FDFAF5', fontFamily: 'inherit',
                              }}>
                                {t('substitute.apply')}
                              </button>
                            </div>
                            {substitutes[i].reason && (
                              <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.5)', lineHeight: 1.4 }}>{substitutes[i].reason}</div>
                            )}
                            {substitutes[i].nutritionWarnings && substitutes[i].nutritionWarnings!.length > 0 && (
                              <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: 5, background: '#FBF0E4', border: '1px solid rgba(200,129,58,0.25)', fontSize: 11, color: '#854F0B', lineHeight: 1.4 }}>
                                ⚠️ {substitutes[i].nutritionWarnings!.map(w =>
                                  w === 'protein_low'  ? t('substitute.warn.proteinLow')  :
                                  w === 'fat_low'      ? t('substitute.warn.fatLow')      :
                                  w === 'non_compliant'? t('substitute.warn.nonCompliant') : w
                                ).join(' · ')}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                            <button
                              onClick={() => handleSubstitute(ing, i, true)}
                              disabled={substituting === i}
                              style={{ fontSize: 11, color: '#854F0B', background: 'none', border: 'none', cursor: substituting === i ? 'wait' : 'pointer', fontFamily: 'inherit', padding: 0 }}>
                              {substituting === i ? '…' : `↻ ${t('substitute.tryAnother')}`}
                            </button>
                            <button onClick={() => setExpandedSub(null)} style={{ fontSize: 11, color: 'rgba(28,26,22,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                              {t('substitute.collapse')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* 预混料提示：固定显示在食材列表末尾 */}
                <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F0F7F0', fontSize: 11, color: '#3B6D11', lineHeight: 1.6, border: '1px solid rgba(122,158,126,0.2)', marginBottom: 8 }}>
                  {t(species === 'cat' ? 'recipe.premixHintCat' : 'recipe.premixHintDog')}
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

                {recipe.tier === 'standard' && (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: '#F7F3EC', fontSize: 11, color: 'rgba(28,26,22,0.5)', marginBottom: 12 }}>
                    ⚡ {t('recipe.standardNote')}
                  </div>
                )}

                {/* 营养信息 */}
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

                {/* 营养解析面板 */}
                {(() => {
                  const kcal  = parseFloat(recipe.nutrition.calories.replace(/[^0-9.]/g, '')) || 0
                  const protG = parseFloat(recipe.nutrition.protein.replace(/[^0-9.]/g, ''))  || 0
                  const fatG  = parseFloat(recipe.nutrition.fat.replace(/[^0-9.]/g, ''))      || 0
                  const carbG = parseFloat(recipe.nutrition.carbs.replace(/[^0-9.]/g, ''))    || 0
                  const fromProt = protG * 4
                  const fromFat  = fatG  * 9
                  const fromCarb = carbG * 4
                  const total    = fromProt + fromFat + fromCarb || 1
                  const pPct = Math.round(fromProt / total * 100)
                  const fPct = Math.round(fromFat  / total * 100)
                  const cPct = Math.round(fromCarb / total * 100)

                  const isPuppy = age === 'puppy' || age === 'kitten'
                  const hasOrgan = recipe.content.ingredients.some(i => i.category === 'organ')
                  const hasPancreatitis = health.includes('pancreatitis')

                  return (
                    <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: '#F7F3EC', border: '1px solid rgba(28,26,22,0.08)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(28,26,22,0.55)', marginBottom: 10, letterSpacing: '0.03em' }}>
                        {t('recipe.nutritionLogic')}
                      </div>

                      {/* 宏量热量比 */}
                      {kcal > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 5 }}>
                            <div style={{ width: `${pPct}%`, background: '#7A9E7E' }} title={`蛋白质 ${pPct}%`} />
                            <div style={{ width: `${fPct}%`, background: '#C8813A' }} title={`脂肪 ${fPct}%`} />
                            <div style={{ width: `${cPct}%`, background: '#D4B896' }} title={`碳水 ${cPct}%`} />
                          </div>
                          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'rgba(28,26,22,0.55)' }}>
                            <span><span style={{ color: '#7A9E7E', fontWeight: 600 }}>■</span> {t('recipe.nutriProtein')} {pPct}%</span>
                            <span><span style={{ color: '#C8813A', fontWeight: 600 }}>■</span> {t('recipe.nutriFat')} {fPct}%</span>
                            <span><span style={{ color: '#D4B896', fontWeight: 600 }}>■</span> {t('recipe.nutriCarbs')} {cPct}%</span>
                          </div>
                        </div>
                      )}

                      {/* 自动补充说明 */}
                      {recipe.content.ingredients.filter(i => i.autoAdded && i.reasonKey).map((ing, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#3B6D11', marginBottom: 4, lineHeight: 1.5 }}>
                          ✓ {ing.emoji} <strong>{ing.name}</strong>：{t(ing.reasonKey!)}
                        </div>
                      ))}

                      {/* 器官肉说明 */}
                      {hasOrgan && (
                        <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.55)', marginTop: 4, lineHeight: 1.5 }}>
                          🫀 {t('recipe.organNote')}
                        </div>
                      )}

                      {/* 低脂模式说明 */}
                      {hasPancreatitis && (
                        <div style={{ fontSize: 11, color: '#854F0B', marginTop: 4, lineHeight: 1.5 }}>
                          ⚠️ {t('recipe.pancreatitisNote')}
                        </div>
                      )}

                      {/* 风险提醒 */}
                      {(() => {
                        const risks: string[] = []
                        if (!isPuppy && fPct < 18) risks.push('risk.lowFatNotForPuppies')
                        if (!health.includes('healthy')) risks.push('risk.consultVet')
                        if (hasOrgan) risks.push('risk.organModeration')
                        risks.push('risk.longTermPremix')
                        return risks.length > 0 ? (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(28,26,22,0.08)' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(28,26,22,0.4)', marginBottom: 5, letterSpacing: '0.03em' }}>{t('recipe.riskTitle')}</div>
                            {risks.map(r => (
                              <div key={r} style={{ fontSize: 11, color: 'rgba(28,26,22,0.5)', lineHeight: 1.5, marginBottom: 2 }}>
                                · {t(r)}
                              </div>
                            ))}
                          </div>
                        ) : null
                      })()}
                    </div>
                  )
                })()}

                {/* 数据留存提示 */}
                {user && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(28,26,22,0.5)' }}>
                      <span>{t('recipe.recipeSaved')}</span>
                      <a href="/dashboard" style={{ color: '#7A9E7E', textDecoration: 'underline' }}>{t('recipe.viewHistory')}</a>
                    </div>
                    {autoLogged && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#3B6D11' }}>
                        <span>{t('recipe.autoLogged')}</span>
                        <a href="/dashboard/nutrition-log" style={{ color: '#7A9E7E', textDecoration: 'underline' }}>{t('recipe.viewLog')}</a>
                      </div>
                    )}
                  </div>
                )}

                {/* 购物清单 */}
                {(() => {
                  const groups: Record<string, { emoji: string; name: string; amount: string }[]> = {
                    protein: [], veggie: [], carb: [], supplement: [],
                  }
                  recipe.content.ingredients.forEach(ing => {
                    const cat = ing.category === 'organ' ? 'protein'
                              : ing.category === 'oil'   ? 'supplement'
                              : (ing.category || 'supplement')
                    if (groups[cat]) groups[cat].push({ emoji: ing.emoji || '', name: ing.name, amount: ing.amount || `${ing.amountG ?? 0}g` })
                  })
                  const labels: Record<string, string> = {
                    protein:    '🥩 ' + t('recipe.shopProtein'),
                    veggie:     '🥦 ' + t('recipe.shopVeggie'),
                    carb:       '🌾 ' + t('recipe.shopCarb'),
                    supplement: '💊 ' + t('recipe.shopSupplement'),
                  }
                  const hasItems = Object.values(groups).some(g => g.length > 0)
                  if (!hasItems) return null

                  const handleCopy = () => {
                    const lines: string[] = [`🛒 ${recipe.title}\n`]
                    Object.entries(groups).forEach(([cat, items]) => {
                      if (!items.length) return
                      lines.push(labels[cat])
                      items.forEach(i => lines.push(`  ${i.emoji} ${i.name}  ${i.amount}`))
                      lines.push('')
                    })
                    navigator.clipboard.writeText(lines.join('\n')).then(() => {
                      setCopyDone(true)
                      setTimeout(() => setCopyDone(false), 2000)
                    }).catch(() => {})
                  }

                  return (
                    <div style={{ marginTop: 14, borderTop: '1px solid rgba(28,26,22,0.08)', paddingTop: 12 }}>
                      <button
                        onClick={() => setShowShoppingList(v => !v)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 600, color: '#1C1A16', fontFamily: 'inherit' }}>
                        🛒 {t('recipe.shoppingList')}
                        <span style={{ fontSize: 11, color: 'rgba(28,26,22,0.4)', fontWeight: 400 }}>{showShoppingList ? '▲' : '▼'}</span>
                      </button>

                      {showShoppingList && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 10 }}>
                            {Object.entries(groups).map(([cat, items]) => {
                              if (!items.length) return null
                              return (
                                <div key={cat}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(28,26,22,0.45)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    {labels[cat]}
                                  </div>
                                  {items.map((item, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', color: '#1C1A16' }}>
                                      <span>{item.emoji} {item.name}</span>
                                      <span style={{ color: 'rgba(28,26,22,0.5)', marginLeft: 8 }}>{item.amount}</span>
                                    </div>
                                  ))}
                                </div>
                              )
                            })}
                          </div>
                          <button
                            onClick={handleCopy}
                            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(28,26,22,0.15)', background: copyDone ? '#F0F7F0' : '#FDFAF5', color: copyDone ? '#3B6D11' : 'rgba(28,26,22,0.6)', cursor: 'pointer', fontFamily: 'inherit' }}>
                            {copyDone ? '✓ ' + t('recipe.shopCopied') : t('recipe.shopCopy')}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}
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
