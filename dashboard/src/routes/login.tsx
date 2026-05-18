import { createRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Route as rootRoute } from './__root'
import { loginSchema, type LoginFormData } from '../lib/schemas'
import { authService, AuthError, parseJwtPayload } from '../lib/auth-service'
import { useAuth } from '../lib/auth-context'
import { useNavigate } from '@tanstack/react-router'


function UtcClock() {
  const [time, setTime] = useState(() => {
    const d = new Date()
    return `UTC ${d.toISOString().slice(11, 19)}`
  })
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date()
      setTime(`UTC ${d.toISOString().slice(11, 19)}`)
    }, 1000)
    return () => clearInterval(id)
  }, [])
  return <span>{time}</span>
}

type Tab = 'password' | 'magic-link'
type LoginPhase = 'credentials' | 'mfa_challenge' | 'mfa_setup'

export function LoginPage() {
  const { t } = useTranslation('auth')
  const { setAuth } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('password')
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [magicEmail, setMagicEmail] = useState('')
  const [phase, setPhase] = useState<LoginPhase>('credentials')
  const [mfaToken, setMfaToken] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaSetupSecret, setMfaSetupSecret] = useState('')
  const [mfaSetupQr, setMfaSetupQr] = useState('')
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  function navigateAfterLogin(accessToken: string, orgId: string, mustChangePassword = false) {
    const payload = parseJwtPayload(accessToken)
    const role = payload.orgId ? 'org_admin' : 'root'
    setAuth({ token: accessToken, role, orgId })
    if (mustChangePassword) {
      navigate({ to: '/change-password' })
    } else if (role === 'root') {
      navigate({ to: '/root' })
    } else {
      navigate({ to: '/org/$orgId', params: { orgId } })
    }
  }

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true)
    setApiError(null)
    try {
      const result = await authService.login(data.email, data.password)
      if ('mfa_required' in result) {
        setMfaToken(result.mfa_token)
        setPhase('mfa_challenge')
        return
      }
      if ('mfa_setup_required' in result) {
        const setupToken = result.mfa_setup_token
        setMfaToken(setupToken)
        const setup = await authService.setupMfa(setupToken)
        setMfaSetupSecret(setup.secret)
        setMfaSetupQr(setup.qrCodeUrl)
        setPhase('mfa_setup')
        return
      }
      navigateAfterLogin(result.accessToken, result.orgId, result.mustChangePassword)
    } catch (err) {
      if (err instanceof AuthError) {
        if (err.reason === 'invalid_credentials') {
          setApiError(t('login.error_invalid_credentials'))
        } else if (err.reason === 'account_locked') {
          setApiError(t('login.error_account_locked'))
        } else {
          setApiError(t('login.error_auth_failure'))
        }
      } else {
        setApiError(t('login.error_unexpected'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function onMfaChallenge(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setApiError(null)
    try {
      const result = await authService.challengeMfa(mfaToken, mfaCode)
      navigateAfterLogin(result.accessToken, result.orgId)
    } catch {
      setApiError(t('mfa.error_invalid_code'))
    } finally {
      setIsLoading(false)
    }
  }

  async function onMfaSetupVerify(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setApiError(null)
    try {
      const result = await authService.verifyMfaSetup(mfaToken, mfaCode)
      setMfaBackupCodes(result.backupCodes)
    } catch {
      setApiError(t('mfa.error_invalid_setup_code'))
    } finally {
      setIsLoading(false)
    }
  }

  async function onMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!magicEmail) return
    setIsLoading(true)
    setApiError(null)
    try {
      await authService.requestMagicLink(magicEmail)
      setMagicLinkSent(true)
    } catch (err) {
      if (err instanceof AuthError && err.reason === 'method_disabled') {
        setApiError(t('magic_link.error_method_disabled'))
      } else {
        setApiError(t('magic_link.error_send_failure'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  function handleTabChange(next: Tab) {
    setTab(next)
    setApiError(null)
    setMagicLinkSent(false)
  }

  if (phase === 'mfa_challenge' || phase === 'mfa_setup') {
    const isSetup = phase === 'mfa_setup'
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center p-4">
        <div className="w-full max-w-[480px] relative" style={{ borderLeft: '3px solid #F0A500' }}>
          <div className="bg-surface-card border border-border-default border-l-0">
            <div className="px-6 py-3 flex items-center justify-between border-b border-border-subtle">
              <span className="font-mono text-[11px] font-semibold tracking-widest text-accent-primary uppercase">
                {isSetup ? t('mfa.title_setup') : t('mfa.title_challenge')}
              </span>
            </div>
            <div className="px-6 py-6 space-y-5">
              <p className="font-mono text-[11px] text-text-muted">
                {isSetup ? t('mfa.description_setup') : t('mfa.description_challenge')}
              </p>
              {apiError && (
                <div role="alert" className="px-3 py-2 border border-status-deny text-status-deny font-mono text-[10px] uppercase tracking-wide">
                  {apiError}
                </div>
              )}
              {isSetup ? (
                <div className="space-y-4">
                  {mfaBackupCodes.length > 0 ? (
                    <>
                      <p className="font-mono text-[11px] text-text-secondary">
                        {t('mfa.backup_codes_saved')}
                      </p>
                      <div className="bg-surface-elevated border border-border-default p-3 grid grid-cols-2 gap-1">
                        {mfaBackupCodes.map((c) => (
                          <span key={c} className="font-mono text-[11px] text-accent-primary">{c}</span>
                        ))}
                      </div>
                      <button
                        onClick={() => { setPhase('credentials'); setMfaToken(''); setMfaCode(''); setMfaBackupCodes([]) }}
                        className="w-full py-3 font-mono text-[11px] font-bold tracking-widest uppercase transition-colors hover:brightness-90"
                        style={{ backgroundColor: '#F0A500', color: '#0D1117' }}
                      >
                        {t('mfa.login_after_setup')}
                      </button>
                    </>
                  ) : (
                    <form onSubmit={onMfaSetupVerify} noValidate className="space-y-4">
                      <p className="font-mono text-[11px] text-text-muted">
                        {t('mfa.setup_description')}
                      </p>
                      <div className="bg-surface-elevated border border-border-default px-3 py-2">
                        <p className="font-mono text-[9px] text-text-muted uppercase mb-1">{t('mfa.setup_secret_label')}</p>
                        <p className="font-mono text-[11px] text-accent-primary break-all">{mfaSetupSecret}</p>
                      </div>
                      <div className="bg-surface-elevated border border-border-default px-3 py-2">
                        <p className="font-mono text-[9px] text-text-muted uppercase mb-1">{t('mfa.setup_uri_label')}</p>
                        <p className="font-mono text-[10px] text-text-secondary break-all">{mfaSetupQr}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-1.5">
                          <span className="text-accent-primary">A</span> {t('mfa.field_code_label_setup')}
                        </p>
                        <div className="relative flex items-center border border-border-default bg-surface-elevated focus-within:border-border-accent transition-colors">
                          <span className="pl-3 pr-1 font-mono text-[13px] text-accent-primary select-none">›</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder={t('mfa.field_code_placeholder')}
                            maxLength={6}
                            value={mfaCode}
                            onChange={e => setMfaCode(e.target.value)}
                            className="flex-1 bg-transparent py-2.5 pr-3 text-[13px] font-mono text-text-primary placeholder:text-text-muted focus:outline-none tracking-widest"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="flex gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => { setPhase('credentials'); setMfaToken(''); setMfaCode('') }}
                          className="px-5 py-3 border border-border-default font-mono text-[10px] tracking-widest text-text-muted uppercase hover:text-text-secondary transition-colors"
                        >
                          {t('mfa.back')}
                        </button>
                        <button
                          type="submit"
                          disabled={isLoading || mfaCode.length < 6}
                          className="flex-1 py-3 font-mono text-[11px] font-bold tracking-widest uppercase transition-colors disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-90"
                          style={{ backgroundColor: '#F0A500', color: '#0D1117' }}
                        >
                          {isLoading ? t('mfa.submit_setup_loading') : t('mfa.submit_setup')}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                <form onSubmit={onMfaChallenge} noValidate className="space-y-4">
                  <div>
                    <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-1.5">
                      <span className="text-accent-primary">A</span> {t('mfa.field_code_label')}
                    </p>
                    <div className="relative flex items-center border border-border-default bg-surface-elevated focus-within:border-border-accent transition-colors">
                      <span className="pl-3 pr-1 font-mono text-[13px] text-accent-primary select-none">›</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder={t('mfa.field_code_placeholder')}
                        maxLength={32}
                        value={mfaCode}
                        onChange={e => setMfaCode(e.target.value)}
                        className="flex-1 bg-transparent py-2.5 pr-3 text-[13px] font-mono text-text-primary placeholder:text-text-muted focus:outline-none tracking-widest"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => { setPhase('credentials'); setMfaToken(''); setMfaCode('') }}
                      className="px-5 py-3 border border-border-default font-mono text-[10px] tracking-widest text-text-muted uppercase hover:text-text-secondary transition-colors"
                    >
                      {t('mfa.back')}
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || !mfaCode}
                      className="flex-1 py-3 font-mono text-[11px] font-bold tracking-widest uppercase transition-colors disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-90 active:brightness-75"
                      style={{ backgroundColor: '#F0A500', color: '#0D1117' }}
                    >
                      {isLoading ? t('mfa.submit_challenge_loading') : t('mfa.submit_challenge')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center p-4">
      <div className="w-full max-w-[560px] relative" style={{ borderLeft: '3px solid #F0A500' }}>
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-border-accent" />

        <div className="bg-surface-card border border-border-default border-l-0" style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}>

          <div className="px-6 py-3 flex items-center justify-between border-b border-border-subtle">
            <span className="font-mono text-[11px] font-semibold tracking-widest text-accent-primary uppercase">
              {t('login.header')}
            </span>
            <span className="font-mono text-[10px] tracking-widest text-text-muted uppercase">
              {t('login.form_ref')}
            </span>
          </div>

          <div className="flex border-b border-border-subtle">
            {(['password', 'magic-link'] as Tab[]).map((tabItem) => (
              <button
                key={tabItem}
                type="button"
                onClick={() => handleTabChange(tabItem)}
                className={[
                  'flex-1 py-2.5 font-mono text-[10px] tracking-widest uppercase transition-colors',
                  tab === tabItem
                    ? 'text-accent-primary border-b-2 border-accent-primary -mb-px'
                    : 'text-text-muted hover:text-text-secondary',
                ].join(' ')}
              >
                {tabItem === 'password' ? t('login.tab_password') : t('login.tab_magic_link')}
              </button>
            ))}
          </div>

          <div className="px-6 py-4 grid grid-cols-2 gap-x-8 gap-y-2 border-b border-border-subtle">
            <div>
              <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-0.5">{t('login.meta_org')}</p>
              <p className="font-mono text-[12px] text-accent-primary">{t('login.meta_org_value')}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-0.5">{t('login.meta_scope')}</p>
              <p className="font-mono text-[12px] text-text-primary">{t('login.meta_scope_value')}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-0.5">{t('login.meta_jurisdiction')}</p>
              <p className="font-mono text-[12px] text-text-primary">{t('login.meta_jurisdiction_value')}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-0.5">{t('login.meta_validity')}</p>
              <p className="font-mono text-[12px] text-text-primary">{t('login.meta_validity_value')}</p>
            </div>
          </div>

          <div className="px-6 pt-5 pb-5">
            <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase mb-3">
              <span className="text-accent-primary">//</span> {t('login.section_label').replace('// ', '')}
            </p>

            <h1 className="text-[26px] font-semibold text-text-primary leading-tight mb-1">
              {t('login.title')}
            </h1>
            <p className="font-mono text-[11px] text-text-muted mb-5">
              {tab === 'password' ? t('login.subtitle_password') : t('login.subtitle_magic_link')}
            </p>

            {apiError && (
              <div role="alert" className="mb-4 px-3 py-2 border border-status-deny text-status-deny font-mono text-[10px] uppercase tracking-wide">
                {apiError}
              </div>
            )}

            {tab === 'magic-link' && (
              magicLinkSent ? (
                <div className="py-6 text-center space-y-3">
                  <p className="font-mono text-[11px] tracking-widest text-accent-primary uppercase">{t('magic_link.sent_title')}</p>
                  <p className="font-mono text-[11px] text-text-muted">
                    {t('common:loading', { defaultValue: '' })}
                    Verifique <span className="text-text-primary">{magicEmail}</span>.<br />
                    O link expira em 15 minutos.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setMagicLinkSent(false); setMagicEmail('') }}
                    className="font-mono text-[10px] text-text-muted hover:text-text-secondary uppercase tracking-widest transition-colors"
                  >
                    {t('magic_link.sent_retry')}
                  </button>
                </div>
              ) : (
                <form onSubmit={onMagicLinkSubmit} noValidate className="space-y-4">
                  <div>
                    <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-1.5">
                      <span className="text-accent-primary">A</span> {t('magic_link.field_label')}
                    </p>
                    <div className="relative flex items-center border border-border-default bg-surface-elevated focus-within:border-border-accent transition-colors">
                      <span className="pl-3 pr-1 font-mono text-[13px] text-accent-primary select-none">›</span>
                      <input
                        type="email"
                        autoComplete="email"
                        placeholder={t('login.field_email_placeholder')}
                        value={magicEmail}
                        onChange={e => setMagicEmail(e.target.value)}
                        className="flex-1 bg-transparent py-2.5 pr-3 text-[13px] font-mono text-text-primary placeholder:text-text-muted focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      disabled
                      className="px-5 py-3 border border-border-default font-mono text-[10px] tracking-widest text-text-muted uppercase leading-tight text-center cursor-not-allowed opacity-60"
                    >
                      {t('magic_link.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || !magicEmail}
                      className="flex-1 py-3 font-mono text-[11px] font-bold tracking-widest uppercase transition-colors disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-90 active:brightness-75"
                      style={{ backgroundColor: '#F0A500', color: '#0D1117' }}
                    >
                      {isLoading ? t('magic_link.submit_loading') : t('magic_link.submit')}
                    </button>
                  </div>
                </form>
              )
            )}

            {tab === 'password' && <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div>
                <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-1.5">
                  <span className="text-accent-primary">A</span> {t('login.field_email_label')}
                </p>
                <div className="relative flex items-center border border-border-default bg-surface-elevated focus-within:border-border-accent transition-colors">
                  <span className="pl-3 pr-1 font-mono text-[13px] text-accent-primary select-none">›</span>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t('login.field_email_placeholder')}
                    className="flex-1 bg-transparent py-2.5 pr-3 text-[13px] font-mono text-text-primary placeholder:text-text-muted focus:outline-none"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 font-mono text-[10px] text-status-deny uppercase" role="alert">{t('login.error_email_invalid')}</p>
                )}
              </div>

              <div>
                <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-1.5">
                  <span className="text-accent-primary">B</span> {t('login.field_password_label')}
                </p>
                <div className="relative flex items-center border border-border-default bg-surface-elevated focus-within:border-border-accent transition-colors">
                  <span className="pl-3 pr-1 font-mono text-[13px] text-accent-primary select-none">›</span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={t('login.field_password_placeholder')}
                    className="flex-1 bg-transparent py-2.5 text-[13px] font-mono text-text-primary placeholder:text-text-muted focus:outline-none"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="px-3 font-mono text-[10px] tracking-widest text-text-muted hover:text-text-secondary transition-colors uppercase border-l border-border-default self-stretch flex items-center"
                  >
                    {showPassword ? t('login.field_password_hide') : t('login.field_password_show')}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 font-mono text-[10px] text-status-deny uppercase" role="alert">{t('login.error_password_required')}</p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-3.5 h-3.5"
                    style={{ accentColor: '#F0A500' }}
                  />
                  <span className="font-mono text-[11px] text-text-secondary">{t('login.trust_device')}</span>
                </label>
                <span className="font-mono text-[11px] text-text-muted hover:text-text-secondary cursor-pointer transition-colors">
                  {t('login.recover')}
                </span>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  disabled
                  className="px-5 py-3 border border-border-default font-mono text-[10px] tracking-widest text-text-muted uppercase leading-tight text-center cursor-not-allowed opacity-60"
                >
                  {t('login.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 font-mono text-[11px] font-bold tracking-widest uppercase transition-colors disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-90 active:brightness-75"
                  style={{ backgroundColor: '#F0A500', color: '#0D1117' }}
                >
                  {isLoading ? t('login.submit_loading') : t('login.submit')}
                </button>
              </div>
            </form>}
          </div>

          <div className="px-6 py-2.5 border-t border-border-subtle flex items-center justify-between bg-surface-elevated">
            <span className="font-mono text-[10px] tracking-wide" style={{ color: '#3FB950' }}>
              {t('login.status_handshake')}
            </span>
            <span className="font-mono text-[10px] tracking-wide text-text-muted">
              {t('login.status_chain')}
            </span>
            <span className="font-mono text-[10px] tracking-wide text-text-muted">
              <UtcClock />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})
