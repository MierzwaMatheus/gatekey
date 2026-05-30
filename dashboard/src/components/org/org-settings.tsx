import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('common')
  const [settings, setSettings] = useState<OrgSettingsType | null>(null)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Local editing state
  const [loginMethods, setLoginMethods] = useState<string[]>([])
  const [mfaRequired, setMfaRequired] = useState(false)
  const [jwtAccessMin, setJwtAccessMin] = useState(60)
  const [jwtRefreshDays, setJwtRefreshDays] = useState(30)
  const [checkPerMin, setCheckPerMin] = useState<number | ''>('')
  const [checkBatchPerMin, setCheckBatchPerMin] = useState<number | ''>('')

  useEffect(() => {
    setError(false)
    getOrgSettings(token, orgId)
      .then((s) => {
        setSettings(s)
        setLoginMethods(s.loginMethods)
        setMfaRequired(s.mfaRequired)
        setJwtAccessMin(Math.round(s.jwtExpiryAccess / 60))
        setJwtRefreshDays(Math.round(s.jwtExpiryRefresh / 86400))
        setCheckPerMin(s.rateLimits?.checkPerMin ?? '')
        setCheckBatchPerMin(s.rateLimits?.checkBatchPerMin ?? '')
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
        rateLimits: {
          checkPerMin: checkPerMin !== '' ? checkPerMin : undefined,
          checkBatchPerMin: checkBatchPerMin !== '' ? checkBatchPerMin : undefined,
        },
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // noop
    } finally {
      setSaving(false)
    }
  }

  if (error) return <div className="py-8 text-center text-sm text-status-deny">{t('org_settings.error')}</div>

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
        <h2 className="text-[14px] font-medium text-text-primary mb-1">{t('org_settings.login_methods_title')}</h2>
        <p className="text-[12px] text-text-secondary mb-4">
          {t('org_settings.login_methods_desc')}
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
        <h2 className="text-[14px] font-medium text-text-primary mb-1">{t('org_settings.mfa_title')}</h2>
        <p className="text-[12px] text-text-secondary mb-4">
          {t('org_settings.mfa_desc')}
        </p>
        <label className="flex items-center justify-between px-4 py-3 bg-surface-card border border-border-default rounded-card cursor-pointer hover:bg-surface-hover transition-colors">
          <div>
            <p className="text-[13px] text-text-primary">{t('org_settings.mfa_required_label')}</p>
            <p className="text-[12px] text-text-secondary">{t('org_settings.mfa_required_desc')}</p>
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
        <h2 className="text-[14px] font-medium text-text-primary mb-1">{t('org_settings.jwt_title')}</h2>
        <p className="text-[12px] text-text-secondary mb-4">
          {t('org_settings.jwt_desc')}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] text-text-secondary mb-1 block">{t('org_settings.access_token_label')}</label>
            <input
              type="number"
              min={1}
              value={jwtAccessMin}
              onChange={(e) => setJwtAccessMin(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 text-sm font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary focus:outline-none focus:border-border-accent"
            />
          </div>
          <div>
            <label className="text-[12px] text-text-secondary mb-1 block">{t('org_settings.refresh_token_label')}</label>
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

      {/* Rate Limits */}
      <section>
        <h2 className="text-[14px] font-medium text-text-primary mb-1">{t('org_settings.rate_limits_title')}</h2>
        <p className="text-[12px] text-text-secondary mb-4">
          {t('org_settings.rate_limits_desc')}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] text-text-secondary mb-1 block">{t('org_settings.check_per_min_label')}</label>
            <input
              data-testid="input-check-per-min"
              type="number"
              min={1}
              placeholder={t('org_settings.rate_limit_default_placeholder')}
              value={checkPerMin}
              onChange={(e) => setCheckPerMin(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 text-sm font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary focus:outline-none focus:border-border-accent"
            />
          </div>
          <div>
            <label className="text-[12px] text-text-secondary mb-1 block">{t('org_settings.check_batch_per_min_label')}</label>
            <input
              data-testid="input-check-batch-per-min"
              type="number"
              min={1}
              placeholder={t('org_settings.rate_limit_default_placeholder')}
              value={checkBatchPerMin}
              onChange={(e) => setCheckBatchPerMin(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 text-sm font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary focus:outline-none focus:border-border-accent"
            />
          </div>
        </div>
      </section>

      {/* Salvar */}
      <div className="flex items-center gap-3">
        <button
          data-testid="btn-save"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-accent-primary text-black text-sm font-medium rounded-button hover:bg-accent-hover transition-colors disabled:opacity-60 cursor-pointer"
        >
          {saving ? t('org_settings.saving') : t('org_settings.save')}
        </button>
        {saved && (
          <span className="text-[13px] text-status-allow">{t('org_settings.saved')}</span>
        )}
      </div>
    </div>
  )
}
