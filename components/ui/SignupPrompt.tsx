'use client'

interface Props {
  t: (key: string, params?: Record<string, string | number>) => string
  onSignup: () => void
  onLogin: () => void
  onClose: () => void
}

export default function SignupPrompt({ t, onSignup, onLogin, onClose }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(28,26,22,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FDFAF5', borderRadius: 20, padding: '36px 32px',
          maxWidth: 420, width: '100%',
          boxShadow: '0 24px 80px rgba(28,26,22,0.18)',
          textAlign: 'center', fontFamily: 'inherit',
        }}>
        {/* Icon */}
        <div style={{ fontSize: 44, marginBottom: 16 }}>🐾</div>

        {/* Title */}
        <h2 style={{
          fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700,
          marginBottom: 8, color: '#1C1A16',
        }}>
          {t('signupPrompt.title')}
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(28,26,22,0.6)', marginBottom: 20 }}>
          {t('signupPrompt.subtitle')}
        </p>

        {/* Benefits */}
        <div style={{
          background: '#F0F7F0', borderRadius: 12, padding: '16px 20px',
          marginBottom: 24, textAlign: 'left',
        }}>
          {(['benefit1', 'benefit2', 'benefit3'] as const).map(key => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 14, color: '#1C1A16' }}>
              <span style={{ color: '#7A9E7E', fontWeight: 700 }}>✓</span>
              {t(`signupPrompt.${key}`)}
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <button
          onClick={onSignup}
          style={{
            width: '100%', padding: '13px 24px', borderRadius: 10,
            background: '#1C1A16', color: '#FDFAF5',
            border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600,
            fontFamily: 'inherit', marginBottom: 10,
          }}>
          {t('signupPrompt.ctaSignup')}
        </button>

        <button
          onClick={() => window.location.href = '/pricing'}
          style={{
            width: '100%', padding: '12px 24px', borderRadius: 10,
            background: 'transparent', color: '#C8813A',
            border: '1px solid #C8813A', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            fontFamily: 'inherit', marginBottom: 16,
          }}>
          {t('signupPrompt.ctaBuy')}
        </button>

        {/* Login link */}
        <p style={{ fontSize: 13, color: 'rgba(28,26,22,0.5)' }}>
          <span
            onClick={onLogin}
            style={{ cursor: 'pointer', textDecoration: 'underline', color: '#185FA5' }}>
            {t('signupPrompt.loginLink')}
          </span>
        </p>
      </div>
    </div>
  )
}
