'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import AuthModal from '@/components/auth/AuthModal'
import RecipeDemo from '@/components/recipe/RecipeDemo'
import SafetyChecker from '@/components/recipe/SafetyChecker'
import PricingSection from '@/components/ui/PricingSection'
import PointsSection from '@/components/ui/PointsSection'
import type { Profile } from '@/types'

export default function HomePage() {
  const [user, setUser] = useState<Profile | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login')
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (u) {
        const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single()
        if (data) setUser(data)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        if (data) setUser(data)
      } else {
        setUser(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const openAuth = (tab: 'login' | 'signup') => {
    setAuthTab(tab)
    setAuthOpen(true)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{ background: '#FDFAF5', minHeight: '100vh' }}>
      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(253,250,245,0.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(28,26,22,0.12)',
        padding: '0 max(24px, 5vw)', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 22 }}>
          🐾 Paw<span style={{ color: '#C8813A' }}>Chef</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => scrollTo('features')} style={navLinkStyle}>功能</button>
          <button onClick={() => scrollTo('safety')} style={navLinkStyle}>食材安全</button>
          <button onClick={() => scrollTo('pricing')} style={navLinkStyle}>定价</button>
          {user ? (
            <>
              <button onClick={() => scrollTo('points')} style={{
                ...navLinkStyle, background: '#FBF0E4', color: '#C8813A', borderRadius: 8
              }}>✦ {user.points} 积分</button>
              <a href="/dashboard" style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(28,26,22,0.12)', color: '#1C1A16', textDecoration: 'none' }}>控制台</a>
              <button onClick={logout} style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(28,26,22,0.12)', color: '#1C1A16' }}>退出</button>
            </>
          ) : (
            <>
              <button onClick={() => openAuth('login')} style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(28,26,22,0.12)', color: '#1C1A16' }}>登录</button>
              <button onClick={() => openAuth('signup')} style={{ ...btnStyle, background: '#1C1A16', color: '#FDFAF5' }}>免费开始</button>
            </>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section style={{ paddingTop: 140, paddingBottom: 80, textAlign: 'center', padding: '140px max(24px,5vw) 80px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 40% at 20% 30%, rgba(122,158,126,0.12) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 80% 70%, rgba(200,129,58,0.1) 0%, transparent 60%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 20, background: '#EBF2EC', color: '#7A9E7E', fontSize: 13, fontWeight: 500, marginBottom: 28 }}>
            ✦ 基于 ASPCA · AAFCO · FEDIAF 国际标准
          </div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(40px,7vw,80px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 20 }}>
            为你的宠物定制<br /><em style={{ fontStyle: 'italic', color: '#C8813A' }}>专属食谱</em>
          </h1>
          <p style={{ fontSize: 'clamp(16px,2vw,19px)', color: 'rgba(28,26,22,0.6)', maxWidth: 520, margin: '0 auto 36px', fontWeight: 300 }}>
            AI 秒级生成营养完整的猫狗食谱，严格遵循国际兽医营养标准，病宠也适用
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => openAuth('signup')} style={{ padding: '14px 32px', borderRadius: 10, background: '#1C1A16', color: '#FDFAF5', fontSize: 16, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
              免费生成食谱 →
            </button>
            <button onClick={() => scrollTo('demo')} style={{ padding: '14px 32px', borderRadius: 10, background: '#FDFAF5', color: '#1C1A16', fontSize: 16, fontWeight: 500, border: '1px solid rgba(28,26,22,0.12)', cursor: 'pointer' }}>
              查看示例食谱
            </button>
          </div>
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center', marginTop: 60, flexWrap: 'wrap' }}>
            {[['60+','食材安全数据'],['3','每日免费次数'],['100%','AAFCO合规'],['$0','月固定成本']].map(([n,l]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700 }}>{n}</div>
                <div style={{ fontSize: 12, color: 'rgba(28,26,22,0.6)', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div style={{ background: '#1C1A16', color: '#FDFAF5', padding: '14px 0', overflow: 'hidden', borderTop: '1px solid rgba(28,26,22,0.12)' }}>
        <div style={{ display: 'flex', gap: 48, animation: 'marquee 20s linear infinite', whiteSpace: 'nowrap' }}>
          {['AAFCO 营养完整性校验','ASPCA 毒物过滤器','FEDIAF 欧洲标准','肾病专项食谱','胰腺炎适配','AI 食材替换','份量自动换算','多语言支持','GDPR 合规',
            'AAFCO 营养完整性校验','ASPCA 毒物过滤器','FEDIAF 欧洲标准','肾病专项食谱','胰腺炎适配','AI 食材替换','份量自动换算'].map((t,i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, opacity: 0.85 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#C8813A', display: 'inline-block' }} />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" style={{ padding: '80px max(24px,5vw)' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A9E7E', marginBottom: 12 }}>核心功能</div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px,4vw,42px)', fontWeight: 700, letterSpacing: '-0.02em' }}>
            一个平台，照顾宠物一生的饮食
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
          {features.map(f => (
            <div key={f.title} style={{ padding: 28, borderRadius: 16, border: '1px solid rgba(28,26,22,0.12)', background: '#FDFAF5', transition: 'all 0.25s' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 500, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: 'rgba(28,26,22,0.6)', lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DEMO */}
      <div id="demo" style={{ background: '#F7F3EC', borderRadius: 24, margin: '0 max(24px,5vw)' }}>
        <RecipeDemo user={user} onAuthRequired={() => openAuth('signup')} />
      </div>

      {/* SAFETY */}
      <section id="safety" style={{ padding: '80px max(24px,5vw)' }}>
        <SafetyChecker />
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: '80px max(24px,5vw)' }}>
        <PricingSection onSignup={() => openAuth('signup')} />
      </section>

      {/* POINTS */}
      <div id="points" style={{ background: '#F7F3EC', borderRadius: 24, margin: '0 max(24px,5vw) 80px' }}>
        <PointsSection user={user} onAuthRequired={() => openAuth('signup')} onPointsUpdated={(pts) => setUser(u => u ? { ...u, points: pts } : u)} />
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(28,26,22,0.12)', padding: '48px max(24px,5vw) 32px', background: '#F7F3EC' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 40, marginBottom: 40 }}>
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, marginBottom: 10 }}>🐾 Paw<span style={{ color: '#C8813A' }}>Chef</span></div>
            <p style={{ fontSize: 13, color: 'rgba(28,26,22,0.6)', lineHeight: 1.6 }}>AI驱动的宠物营养食谱平台，严格遵循 ASPCA · AAFCO · FEDIAF 国际标准</p>
          </div>
          {[['产品',['功能介绍','食材安全','定价方案','积分体系']],['标准来源',['ASPCA 毒物库','AAFCO 营养指南','FEDIAF 欧洲标准']],['法律',['隐私政策','服务条款','GDPR 数据权利']]].map(([title, links]) => (
            <div key={title as string}>
              <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>{title as string}</h4>
              {(links as string[]).map(l => <div key={l} style={{ fontSize: 13, color: 'rgba(28,26,22,0.6)', marginBottom: 8, cursor: 'pointer' }}>{l}</div>)}
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(28,26,22,0.12)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'rgba(28,26,22,0.3)' }}>© 2025 PawChef · All rights reserved</div>
          <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.3)', maxWidth: 500, textAlign: 'right' }}>⚠️ 本平台所有内容均为AI生成，仅供参考，不构成专业兽医诊断或治疗建议。喂食前请咨询持牌兽医。</div>
        </div>
      </footer>

      <AuthModal open={authOpen} tab={authTab} onClose={() => setAuthOpen(false)} onSuccess={(profile) => { setUser(profile); setAuthOpen(false) }} />

      <style>{`
        @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        button:hover { opacity: 0.85 }
      `}</style>
    </div>
  )
}

const navLinkStyle: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, fontSize: 14, color: 'rgba(28,26,22,0.6)', cursor: 'pointer', border: 'none', background: 'none' }
const btnStyle: React.CSSProperties = { padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit' }

const features = [
  { icon: '🤖', title: 'AI 个性化食谱生成', bg: '#EBF2EC', desc: '输入宠物品种、年龄、体重、健康状况，AI 秒级生成营养完整的专属食谱，实时通过 AAFCO 标准校验' },
  { icon: '🚫', title: '危险食材强制拦截', bg: '#FAE8E8', desc: '基于 ASPCA 毒物列表，60+ 种有毒食材实时过滤。检测到洋葱、葡萄、木糖醇等立即弹出警报' },
  { icon: '⚕️', title: '病宠专项食谱', bg: '#FBF0E4', desc: '肾病、胰腺炎、糖尿病、肥胖……AI 自动调整蛋白质、磷、脂肪比例，为患病宠物量身定制安全饮食' },
  { icon: '🔄', title: '智能食材替换', bg: '#EBF2EC', desc: '冰箱里没有某种食材？AI 立即给出营养等效替代方案，并重新计算全部营养指标' },
  { icon: '📊', title: '营养仪表盘', bg: '#FBF0E4', desc: '每月自动生成宠物营养趋势报告，可导出 PDF 分享给兽医，追踪健康改善轨迹' },
  { icon: '⚖️', title: '精确份量换算', bg: '#EBF2EC', desc: '依据宠物体重自动计算每日用量，克/盎司自由切换，还有7天膳食计划和购物清单' },
]
