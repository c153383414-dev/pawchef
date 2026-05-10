'use client'
import { useState } from 'react'

interface Props {
  onSignup: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}

export default function PricingSection({ onSignup, t }: Props) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A9E7E', marginBottom: 12 }}>
          {t('pricing.sectionLabel')}
        </div>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px,4vw,42px)', fontWeight: 700, letterSpacing: '-0.02em' }}>
          {t('pricing.title')}
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(28,26,22,0.6)', marginTop: 12, fontWeight: 300 }}>
          {t('pricing.subtitle')}
        </p>

        <div style={{ display: 'inline-flex', gap: 4, background: '#F7F3EC', padding: 4, borderRadius: 10, marginTop: 20 }}>
          {(['monthly', 'annual'] as const).map(b => (
            <button key={b} onClick={() => setBilling(b)} style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500,
              cursor: 'pointer', border: 'none', fontFamily: 'inherit',
              background: billing === b ? '#FDFAF5' : 'transparent',
              color: billing === b ? '#1C1A16' : 'rgba(28,26,22,0.6)',
              boxShadow: billing === b ? '0 1px 4px rgba(28,26,22,.1)' : 'none'
            }}>
              {b === 'monthly' ? t('pricing.monthly') : (
                <span>{t('pricing.annual')} <span style={{ color: '#7A9E7E', fontSize: 12 }}>{t('pricing.annualSave')}</span></span>
              )}
            </button>
          ))}
        </div>
        {billing === 'annual' && (
          <div style={{ marginTop: 8, fontSize: 13, color: '#7A9E7E' }}>{t('pricing.annualSaving')}</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, maxWidth: 1000, margin: '0 auto' }}>

        {/* Free */}
        <div style={cardStyle}>
          <div style={tierStyle}>{t('pricing.freeTier')}</div>
          <div style={priceWrap}><span style={currStyle}>$</span><span style={numStyle}>0</span></div>
          <div style={perStyle}>{t('pricing.freePermanent')}</div>
          <div style={divStyle} />
          <div style={secLabel}>{t('pricing.staticContent')}</div>
          <Feature text={t('pricing.feat.freeAiRecipe')} />
          <Feature text={t('pricing.feat.safetyChecker')} />
          <Feature text={t('pricing.feat.dangerAlerts')} />
          <div style={secLabel}>{t('pricing.freeCreditsSection')}</div>
          <Feature text={t('pricing.feat.earnFree')} color="#185FA5" />
          <Feature text={t('pricing.feat.unlockSlots')} color="#185FA5" />
          <Feature text={t('pricing.feat.exportLog')} color="#185FA5" />
          <div style={secLabel}>{t('pricing.aiSection')}</div>
          <Feature text={t('pricing.feat.aiGenNeeds')} color="#854F0B" />
          <button onClick={onSignup} style={{ ...btnStyle, background: 'transparent', color: '#1C1A16', border: '1px solid rgba(28,26,22,0.15)', marginTop: 24 }}>
            {t('pricing.startFree')}
          </button>
        </div>

        {/* Pro */}
        <div style={{ ...cardStyle, background: '#1C1A16', color: '#FDFAF5', position: 'relative', border: '1.5px solid #1C1A16' }}>
          <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#C8813A', color: '#fff', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {t('pricing.feat.mostPopular')}
          </div>
          <div style={{ ...tierStyle, color: 'rgba(253,250,245,0.5)' }}>
            {billing === 'monthly' ? t('pricing.proMonthly') : t('pricing.proAnnual')}
          </div>
          <div style={priceWrap}>
            <span style={{ ...currStyle, color: '#FDFAF5' }}>$</span>
            <span style={{ ...numStyle, color: '#FDFAF5' }}>{billing === 'monthly' ? '14.9' : '8.25'}</span>
          </div>
          <div style={{ ...perStyle, color: 'rgba(253,250,245,0.6)' }}>
            {billing === 'monthly' ? t('pricing.perMonth') : t('pricing.perAnnual')}
          </div>
          {billing === 'annual' && (
            <div style={{ fontSize: 12, color: '#D4A843', marginBottom: 8 }}>{t('pricing.annualDiscount')}</div>
          )}
          <div style={{ ...divStyle, background: 'rgba(253,250,245,0.15)' }} />
          <div style={{ ...secLabel, color: 'rgba(253,250,245,0.4)' }}>{t('pricing.aiSection')}</div>
          <Feature text={t('pricing.feat.aiGenCount', { n: billing === 'monthly' ? '30' : '60' })} featured />
          <Feature text={t('pricing.feat.substCount', { n: billing === 'monthly' ? '20' : '40' })} featured />
          <Feature text={t('pricing.feat.mealPlanCount', { n: billing === 'monthly' ? '2' : '4' })} featured />
          <Feature text={t('pricing.feat.healthMode')} featured />
          <div style={{ ...secLabel, color: 'rgba(253,250,245,0.4)' }}>{t('pricing.valueSection')}</div>
          <Feature text={t('pricing.feat.petProfiles')} featured />
          <Feature text={t('pricing.feat.unlimitedBookmarks')} featured />
          <Feature text={t('pricing.feat.unlimitedExports')} featured />
          <Feature text={t('pricing.feat.aiCreditsGift', { n: billing === 'monthly' ? '50' : '100' })} featured />
          <button onClick={onSignup} style={{ ...btnStyle, background: '#FDFAF5', color: '#1C1A16', marginTop: 24 }}>
            {t('pricing.subscribePro')}
          </button>
          <div style={{ fontSize: 11, color: 'rgba(253,250,245,0.4)', textAlign: 'center', marginTop: 8 }}>
            {t('pricing.upgradeNote')}
          </div>
        </div>

        {/* Credits */}
        <div style={cardStyle}>
          <div style={tierStyle}>{t('pricing.credits')}</div>
          <div style={{ fontSize: 13, color: 'rgba(28,26,22,0.6)', marginBottom: 16, lineHeight: 1.6 }}>
            {t('pricing.creditsSubtitle')}
          </div>
          <div style={divStyle} />
          {[
            { pts: 10, price: 6.9, per: 0.69, labelKey: 'points.packages.starter' },
            { pts: 30, price: 17.9, per: 0.60, labelKey: 'points.packages.popular', best: true },
            { pts: 60, price: 32.9, per: 0.55, labelKey: 'points.packages.standard' },
          ].map(p => (
            <div key={p.pts} onClick={onSignup} style={{
              padding: '12px 14px', borderRadius: 12, marginBottom: 8, cursor: 'pointer',
              background: p.best ? '#FBF0E4' : '#F7F3EC',
              border: `1px solid ${p.best ? '#EF9F27' : 'rgba(28,26,22,0.1)'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              position: 'relative'
            }}>
              {p.best && (
                <div style={{ position: 'absolute', top: -8, left: 12, background: '#EF9F27', color: '#fff', fontSize: 10, padding: '1px 8px', borderRadius: 8, fontWeight: 500 }}>
                  {t('pricing.bestValue')}
                </div>
              )}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t(p.labelKey)} · {p.pts}🟠</div>
                <div style={{ fontSize: 11, color: 'rgba(28,26,22,0.5)' }}>{t('points.packages.uses', { n: p.pts })} · {t('points.packages.perUse', { n: p.per })}</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#854F0B' }}>${p.price}</div>
            </div>
          ))}
          <div style={{ padding: '10px 12px', background: '#E6F1FB', borderRadius: 10, fontSize: 12, color: '#185FA5', marginTop: 8, lineHeight: 1.7 }}>
            {t('pricing.feat.freeNoAi')}<br />
            {t('pricing.feat.aiNeverExpire')}
          </div>
          <button onClick={onSignup} style={{ ...btnStyle, background: 'transparent', color: '#1C1A16', border: '1px solid rgba(28,26,22,0.15)', marginTop: 20 }}>
            {t('pricing.loginToBuy')}
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: 'rgba(28,26,22,0.4)', lineHeight: 1.8 }}>
        {t('pricing.disclaimer')}
      </div>
    </div>
  )
}

function Feature({ text, featured, color }: { text: string; featured?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, marginBottom: 8, color: featured ? 'rgba(253,250,245,0.8)' : color || 'rgba(28,26,22,0.6)' }}>
      <span style={{ color: featured ? '#D4A843' : color || '#7A9E7E', flexShrink: 0, marginTop: 1 }}>✓</span>
      {text}
    </div>
  )
}

const cardStyle: React.CSSProperties = { padding: '32px 24px', borderRadius: 20, border: '1px solid rgba(28,26,22,0.12)', background: '#FDFAF5' }
const tierStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(28,26,22,0.5)', marginBottom: 10 }
const priceWrap: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 3, marginBottom: 4 }
const currStyle: React.CSSProperties = { fontSize: 18, marginTop: 8, color: '#1C1A16' }
const numStyle: React.CSSProperties = { fontFamily: 'Playfair Display, serif', fontSize: 40, fontWeight: 700, lineHeight: 1, color: '#1C1A16' }
const perStyle: React.CSSProperties = { fontSize: 13, fontWeight: 300, color: 'rgba(28,26,22,0.6)', marginBottom: 4 }
const divStyle: React.CSSProperties = { height: 1, background: 'rgba(28,26,22,0.08)', margin: '16px 0' }
const secLabel: React.CSSProperties = { fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(28,26,22,0.35)', marginBottom: 8, marginTop: 4 }
const btnStyle: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 10, fontSize: 15, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit' }
