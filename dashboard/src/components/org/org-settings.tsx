import { useEffect, useState } from 'react'
import { getOrgSettings, updateOrgSettings, type OrgSettings as OrgSettingsType } from '../../lib/org-api'

interface OrgSettingsProps {
  token: string
  orgId: string
}

const LOGIN_METHODS = [
  { key: 'email_password', label: 'Email + Senha' },
  { key: 'magic_link', label: 'Magic Link' },
  { key: 'oauth_google', label: 'OAuth Google' },
  { key: 'oauth_github', label: 'OAuth GitHub' },
]

export function OrgSettings({ token, orgId }: OrgSettingsProps) {
  const [settings, setSettings] = useState<OrgSettingsType | null>(null)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Local editing state
  const [loginMethods, setLoginMethods] = useState<string[]>([])
  const [mfaRequired, setMfaRequired] = useState(false)
  const [jwtAccessMin, setJwtAccessMin] = useState(60)
  const [jwtRefreshDays, setJwtRefreshDays] = useState(30)

  useEffect(() => {
    setError(false)
    getOrgSettings(token, orgId)
      .then((s) => {
        setSettings(s)
        setLoginMethods(s.loginMethods)
        setMfaRequired(s.mfaRequired)
        setJwtAccessMin(Math.round(s.jwtExpiryAccess / 60))
        setJwtRefreshDays(Math.round(s.jwtExpiryRefresh / 86400))
      })
      .catch(() => setError(true))
  }, [token, orgId])

  function toggleLoginMethod(key: string) {
    setLoginMethods((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key],
    )
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      await updateOrgSettings(token, orgId, {
        loginMethods,
        mfaRequired,
        jwtExpiryAccess: jwtAccessMin * 60,
        jwtExpiryRefresh: jwtRefreshDays * 86400,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // noop
    } finally {
      setSaving(false)
    }
  }

  if (error) return <div className="py-8 text-center text-sm text-status-deny">Erro ao carregar configurações.</div>

  if (settings === null) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-surface-elevated animate-pulse rounded-card" />)}
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-8">
      {/* Métodos de login */}
      <section>
        <h2 className="text-[14px] font-medium text-text-primary mb-1">Métodos de Login</h2>
        <p className="text-[12px] text-text-secondary mb-4">
          Controla quais métodos de autenticação estão disponíveis para usuários desta org.
        </p>
        <div className="space-y-2">
          {LOGIN_METHODS.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center justify-between px-4 py-3 bg-surface-card border border-border-default rounded-card cursor-pointer hover:bg-surface-hover transition-colors"
            >
              <span className="text-[13px] text-text-primary">{label}</span>
              <button
                role="switch"
                aria-checked={loginMethods.includes(key)}
                onClick={() => toggleLoginMethod(key)}
                className={[
                  'w-9 h-5 rounded-pill relative transition-colors cursor-pointer',
                  loginMethods.includes(key) ? 'bg-accent-primary' : 'bg-surface-elevated border border-border-default',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    loginMethods.includes(key) ? 'translate-x-4' : 'translate-x-0.5',
                  ].join(' ')}
                />
              </button>
            </label>
          ))}
        </div>
      </section>

      {/* MFA */}
      <section>
        <h2 className="text-[14px] font-medium text-text-primary mb-1">MFA (Autenticação de Dois Fatores)</h2>
        <p className="text-[12px] text-text-secondary mb-4">
          Quando obrigatório, usuários sem MFA configurado serão redirecionados para o setup no primeiro login.
        </p>
        <label className="flex items-center justify-between px-4 py-3 bg-surface-card border border-border-default rounded-card cursor-pointer hover:bg-surface-hover transition-colors">
          <div>
            <p className="text-[13px] text-text-primary">MFA obrigatório</p>
            <p className="text-[12px] text-text-secondary">Exige TOTP ou backup code em todos os logins</p>
          </div>
          <button
            role="switch"
            aria-checked={mfaRequired}
            onClick={() => setMfaRequired((v) => !v)}
            className={[
              'w-9 h-5 rounded-pill relative transition-colors cursor-pointer',
              mfaRequired ? 'bg-accent-primary' : 'bg-surface-elevated border border-border-default',
            ].join(' ')}
          >
            <span
              className={[
                'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                mfaRequired ? 'translate-x-4' : 'translate-x-0.5',
              ].join(' ')}
            />
          </button>
        </label>
      </section>

      {/* JWT Expiry */}
      <section>
        <h2 className="text-[14px] font-medium text-text-primary mb-1">Expiração de Tokens JWT</h2>
        <p className="text-[12px] text-text-secondary mb-4">
          Define por quanto tempo os tokens de acesso e refresh são válidos.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] text-text-secondary mb-1 block">Access token (minutos)</label>
            <input
              type="number"
              min={1}
              value={jwtAccessMin}
              onChange={(e) => setJwtAccessMin(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 text-sm font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary focus:outline-none focus:border-border-accent"
            />
          </div>
          <div>
            <label className="text-[12px] text-text-secondary mb-1 block">Refresh token (dias)</label>
            <input
              type="number"
              min={1}
              value={jwtRefreshDays}
              onChange={(e) => setJwtRefreshDays(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 text-sm font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary focus:outline-none focus:border-border-accent"
            />
          </div>
        </div>
      </section>

      {/* Salvar */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-accent-primary text-black text-sm font-medium rounded-button hover:bg-accent-hover transition-colors disabled:opacity-60 cursor-pointer"
        >
          {saving ? 'Salvando…' : 'Salvar configurações'}
        </button>
        {saved && (
          <span className="text-[13px] text-status-allow">Salvo com sucesso</span>
        )}
      </div>
    </div>
  )
}
