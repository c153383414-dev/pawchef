'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import type { Profile, Recipe, Pet } from '@/types'

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const [{ data: p }, { data: r }, { data: pets }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('recipes').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('pets').select('*').eq('user_id', user.id),
      ])
      setProfile(p); setRecipes(r || []); setPets(pets || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FDFAF5' }}>加载中…</div>
  if (!profile) return null

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF5' }}>
      {/* Header */}
      <nav style={{ background: '#FDFAF5', borderBottom: '1px solid rgba(28,26,22,0.12)', padding: '0 max(24px,5vw)', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, textDecoration: 'none', color: '#1C1A16' }}>🐾 Paw<span style={{ color: '#C8813A' }}>Chef</span></a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'rgba(28,26,22,0.6)' }}>{profile.display_name}</span>
          <span style={{ padding: '5px 12px', borderRadius: 8, background: '#FBF0E4', color: '#C8813A', fontSize: 13, fontWeight: 500 }}>✦ {profile.points} 积分</span>
          {profile.is_pro && <span style={{ padding: '4px 10px', borderRadius: 8, background: '#EBF2EC', color: '#7A9E7E', fontSize: 12, fontWeight: 500 }}>Pro</span>}
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }} style={{ padding: '6px 14px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(28,26,22,0.12)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>退出</button>
        </div>
      </nav>

      <div style={{ padding: '40px max(24px,5vw)', maxWidth: 1100, margin: '0 auto' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 40 }}>
          {[['🍽️', '生成食谱', recipes.length + '份'], ['🐾', '宠物档案', pets.length + '只'], ['✦', '积分余额', profile.points + '分'], ['👑', '会员状态', profile.is_pro ? 'Pro' : '免费版']].map(([e,l,v]) => (
            <div key={l} style={{ background: '#F7F3EC', borderRadius: 14, padding: '20px', border: '1px solid rgba(28,26,22,0.08)' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{e}</div>
              <div style={{ fontSize: 12, color: 'rgba(28,26,22,0.5)', marginBottom: 4 }}>{l}</div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Pets */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700 }}>我的宠物</h2>
            {(profile.is_pro || pets.length < 1) && (
              <button onClick={() => router.push('/?addPet=1')} style={{ padding: '8px 16px', borderRadius: 8, background: '#1C1A16', color: '#FDFAF5', border: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ 添加宠物</button>
            )}
          </div>
          {pets.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#F7F3EC', borderRadius: 16, color: 'rgba(28,26,22,0.4)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🐾</div>
              <p>还没有宠物档案，添加第一只宠物吧</p>
              <button onClick={() => router.push('/?addPet=1')} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, background: '#1C1A16', color: '#FDFAF5', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>添加宠物</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
              {pets.map(pet => (
                <div key={pet.id} style={{ background: '#FDFAF5', borderRadius: 14, border: '1px solid rgba(28,26,22,0.12)', padding: 20 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{pet.species === 'dog' ? '🐕' : '🐈'}</div>
                  <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 4 }}>{pet.name}</div>
                  <div style={{ fontSize: 13, color: 'rgba(28,26,22,0.6)' }}>{pet.breed || pet.species === 'dog' ? '犬' : '猫'} · {pet.weight_kg}kg</div>
                  {pet.health_conditions?.length > 0 && pet.health_conditions[0] !== 'healthy' && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#C8813A', background: '#FBF0E4', padding: '3px 8px', borderRadius: 4, display: 'inline-block' }}>{pet.health_conditions.join('·')}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 40, flexWrap: 'wrap' }}>
          <a href="/dashboard/nutrition-log" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderRadius: 14, background: '#EBF2EC', border: '1px solid rgba(122,158,126,0.2)', textDecoration: 'none', color: '#1C1A16', flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 28 }}>📊</div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 15 }}>营养饮食日志</div>
              <div style={{ fontSize: 12, color: 'rgba(28,26,22,0.5)', marginTop: 2 }}>记录每餐 · 追踪营养摄入</div>
            </div>
          </a>
          <a href="/#meal-plan" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderRadius: 14, background: '#FBF0E4', border: '1px solid rgba(200,129,58,0.2)', textDecoration: 'none', color: '#1C1A16', flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 28 }}>📅</div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 15 }}>7天膳食周计划</div>
              <div style={{ fontSize: 12, color: 'rgba(28,26,22,0.5)', marginTop: 2 }}>AI生成一周菜单 · 含购物清单</div>
            </div>
          </a>
        </div>

        {/* Recent Recipes */}
        <div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, marginBottom: 16 }}>最近食谱</h2>
          {recipes.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#F7F3EC', borderRadius: 16, color: 'rgba(28,26,22,0.4)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
              <p>还没有生成过食谱</p>
              <a href="/#demo" style={{ display: 'inline-block', marginTop: 16, padding: '10px 24px', borderRadius: 8, background: '#1C1A16', color: '#FDFAF5', textDecoration: 'none', fontSize: 14 }}>去生成食谱</a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recipes.map(r => {
                const isOpen = expandedRecipe === r.id
                const ings = r.content?.ingredients || []
                const proteins = ings.filter((i: any) => i.category === 'protein' || i.category === 'organ')
                return (
                  <div key={r.id} style={{ background: '#FDFAF5', borderRadius: 14, border: `1px solid ${isOpen ? 'rgba(122,158,126,0.3)' : 'rgba(28,26,22,0.12)'}`, overflow: 'hidden' }}>
                    {/* 摘要行（可点击） */}
                    <div
                      onClick={() => setExpandedRecipe(isOpen ? null : r.id)}
                      style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 3 }}>{r.title}</div>
                        <div style={{ fontSize: 12, color: 'rgba(28,26,22,0.5)', display: 'flex', gap: 8 }}>
                          <span>{new Date(r.created_at).toLocaleDateString('zh-CN')}</span>
                          {proteins.length > 0 && <span>· {proteins.map((i: any) => i.name).join('、')}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {r.nutrition && <span style={{ fontSize: 12, color: 'rgba(28,26,22,0.5)', background: '#F7F3EC', padding: '4px 10px', borderRadius: 6 }}>{r.nutrition.calories}</span>}
                        <span style={{ fontSize: 11, color: '#7A9E7E', background: '#EBF2EC', padding: '4px 10px', borderRadius: 6 }}>✓ AAFCO</span>
                        <span style={{ fontSize: 11, color: 'rgba(28,26,22,0.35)' }}>{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* 展开详情 */}
                    {isOpen && (
                      <div style={{ padding: '0 20px 16px', borderTop: '1px solid rgba(28,26,22,0.08)' }}>
                        {/* 食材列表 */}
                        <div style={{ marginTop: 12, marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(28,26,22,0.4)', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>食材</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {ings.map((ing: any, i: number) => (
                              <span key={i} style={{ fontSize: 12, padding: '3px 9px', borderRadius: 6, background: ing.autoAdded ? '#EBF2EC' : '#F7F3EC', color: ing.autoAdded ? '#3B6D11' : '#1C1A16' }}>
                                {ing.emoji} {ing.name} {ing.amount || (ing.amountG ? `${ing.amountG}g` : '')}
                              </span>
                            ))}
                          </div>
                        </div>
                        {/* 营养摘要 */}
                        {r.nutrition && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {[['热量', r.nutrition.calories], ['蛋白质', r.nutrition.protein], ['脂肪', r.nutrition.fat], ['碳水', r.nutrition.carbs]].map(([k, v]) => (
                              <span key={k} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: '#F7F3EC', color: 'rgba(28,26,22,0.6)' }}>
                                <strong>{k}</strong> {v}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
