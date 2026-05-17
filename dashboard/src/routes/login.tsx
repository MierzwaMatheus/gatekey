import { createRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useEffect } from 'react'
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
        setMfaToken(result.mfa_setup_token)
        setPhase('mfa_setup')
        return
      }
      navigateAfterLogin(result.accessToken, result.orgId, result.mustChangePassword)
    } catch (err) {
      if (err instanceof AuthError) {
        if (err.reason === 'invalid_credentials') {
          setApiError('CREDENCIAIS INVÁLIDAS. ACESSO NEGADO.')
        } else if (err.reason === 'account_locked') {
          setApiError('PORTADOR BLOQUEADO TEMPORARIAMENTE.')
        } else {
          setApiError('FALHA NA AUTENTICAÇÃO. TENTE NOVAMENTE.')
        }
      } else {
        setApiError('ERRO INESPERADO. TENTE NOVAMENTE.')
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
      setApiError('CÓDIGO INVÁLIDO OU EXPIRADO.')
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
        setApiError('MÉTODO NÃO HABILITADO NESTA ORG.')
      } else {
        setApiError('ERRO AO ENVIAR LINK. TENTE NOVAMENTE.')
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
                {isSetup ? 'MFA · CONFIGURAÇÃO OBRIGATÓRIA' : 'MFA · VERIFICAÇÃO DOIS FATORES'}
              </span>
            </div>
            <div className="px-6 py-6 space-y-5">
              <p className="font-mono text-[11px] text-text-muted">
                {isSetup
                  ? 'Sua conta requer configuração de MFA. Acesse as configurações de segurança para configurar.'
                  : 'Informe o código de 6 dígitos do seu aplicativo autenticador, ou um código de backup.'}
              </p>
              {apiError && (
                <div role="alert" className="px-3 py-2 border border-status-deny text-status-deny font-mono text-[10px] uppercase tracking-wide">
                  {apiError}
                </div>
              )}
              {isSetup ? (
                <div className="space-y-4">
                  <p className="font-mono text-[11px] text-text-secondary">
                    Use o token temporário abaixo para configurar MFA via app autenticador:
                  </p>
                  <div className="bg-surface-elevated border border-border-default px-3 py-2 font-mono text-[11px] text-accent-primary break-all">
                    {mfaToken}
                  </div>
                  <button
                    onClick={() => { setPhase('credentials'); setMfaToken(''); setMfaCode('') }}
                    className="font-mono text-[10px] text-text-muted hover:text-text-secondary uppercase tracking-widest transition-colors"
                  >
                    ← VOLTAR AO LOGIN
                  </button>
                </div>
              ) : (
                <form onSubmit={onMfaChallenge} noValidate className="space-y-4">
                  <div>
                    <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-1.5">
                      <span className="text-accent-primary">A</span> CÓDIGO TOTP / BACKUP
                    </p>
                    <div className="relative flex items-center border border-border-default bg-surface-elevated focus-within:border-border-accent transition-colors">
                      <span className="pl-3 pr-1 font-mono text-[13px] text-accent-primary select-none">›</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
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
                      ← VOLTAR
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || !mfaCode}
                      className="flex-1 py-3 font-mono text-[11px] font-bold tracking-widest uppercase transition-colors disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-90 active:brightness-75"
                      style={{ backgroundColor: '#F0A500', color: '#0D1117' }}
                    >
                      {isLoading ? 'VERIFICANDO…' : 'CONFIRMAR CÓDIGO →'}
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
      {/* card with orange left border */}
      <div className="w-full max-w-[560px] relative" style={{ borderLeft: '3px solid #F0A500' }}>
        {/* top-right corner bracket */}
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-border-accent" />

        <div className="bg-surface-card border border-border-default border-l-0" style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}>

          {/* header */}
          <div className="px-6 py-3 flex items-center justify-between border-b border-border-subtle">
            <span className="font-mono text-[11px] font-semibold tracking-widest text-accent-primary uppercase">
              CREDENCIAL · SOLICITAÇÃO
            </span>
            <span className="font-mono text-[10px] tracking-widest text-text-muted uppercase">
              FORM · A-014 · REV 07
            </span>
          </div>

          {/* tabs */}
          <div className="flex border-b border-border-subtle">
            {(['password', 'magic-link'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTabChange(t)}
                className={[
                  'flex-1 py-2.5 font-mono text-[10px] tracking-widest uppercase transition-colors',
                  tab === t
                    ? 'text-accent-primary border-b-2 border-accent-primary -mb-px'
                    : 'text-text-muted hover:text-text-secondary',
                ].join(' ')}
              >
                {t === 'password' ? 'SENHA' : 'LINK MÁGICO'}
              </button>
            ))}
          </div>

          {/* metadata */}
          <div className="px-6 py-4 grid grid-cols-2 gap-x-8 gap-y-2 border-b border-border-subtle">
            <div>
              <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-0.5">ORGANIZAÇÃO</p>
              <p className="font-mono text-[12px] text-accent-primary">conduit · ops</p>
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-0.5">ESCOPO</p>
              <p className="font-mono text-[12px] text-text-primary">console · admin</p>
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-0.5">JURISDIÇÃO</p>
              <p className="font-mono text-[12px] text-text-primary">sa-east-1 / br</p>
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-0.5">VALIDADE</p>
              <p className="font-mono text-[12px] text-text-primary">12h · renovável</p>
            </div>
          </div>

          {/* body */}
          <div className="px-6 pt-5 pb-5">
            {/* section label */}
            <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase mb-3">
              <span className="text-accent-primary">//</span> SECURE / AUTHENTICATE
            </p>

            <h1 className="text-[26px] font-semibold text-text-primary leading-tight mb-1">
              Solicitar acesso.
            </h1>
            <p className="font-mono text-[11px] text-text-muted mb-5">
              {tab === 'password'
                ? 'portador deve apresentar credencial válida.'
                : 'informe o identificador para receber o link de acesso.'}
            </p>

            {apiError && (
              <div role="alert" className="mb-4 px-3 py-2 border border-status-deny text-status-deny font-mono text-[10px] uppercase tracking-wide">
                {apiError}
              </div>
            )}

            {/* magic link tab */}
            {tab === 'magic-link' && (
              magicLinkSent ? (
                <div className="py-6 text-center space-y-3">
                  <p className="font-mono text-[11px] tracking-widest text-accent-primary uppercase">LINK TRANSMITIDO</p>
                  <p className="font-mono text-[11px] text-text-muted">
                    Verifique <span className="text-text-primary">{magicEmail}</span>.<br />
                    O link expira em 15 minutos.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setMagicLinkSent(false); setMagicEmail('') }}
                    className="font-mono text-[10px] text-text-muted hover:text-text-secondary uppercase tracking-widest transition-colors"
                  >
                    ← TENTAR OUTRO EMAIL
                  </button>
                </div>
              ) : (
                <form onSubmit={onMagicLinkSubmit} noValidate className="space-y-4">
                  <div>
                    <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-1.5">
                      <span className="text-accent-primary">A</span> PORTADOR / IDENTIFICADOR
                    </p>
                    <div className="relative flex items-center border border-border-default bg-surface-elevated focus-within:border-border-accent transition-colors">
                      <span className="pl-3 pr-1 font-mono text-[13px] text-accent-primary select-none">›</span>
                      <input
                        type="email"
                        autoComplete="email"
                        placeholder="a.ribeiro@conduit.io"
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
                      ESC ·{'\n'}SAIR
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || !magicEmail}
                      className="flex-1 py-3 font-mono text-[11px] font-bold tracking-widest uppercase transition-colors disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-90 active:brightness-75"
                      style={{ backgroundColor: '#F0A500', color: '#0D1117' }}
                    >
                      {isLoading ? 'ENVIANDO…' : 'TRANSMITIR LINK →'}
                    </button>
                  </div>
                </form>
              )
            )}

            {/* password tab */}
            {tab === 'password' && <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              {/* email field */}
              <div>
                <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-1.5">
                  <span className="text-accent-primary">A</span> PORTADOR / IDENTIFICADOR
                </p>
                <div className="relative flex items-center border border-border-default bg-surface-elevated focus-within:border-border-accent transition-colors">
                  <span className="pl-3 pr-1 font-mono text-[13px] text-accent-primary select-none">›</span>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="a.ribeiro@conduit.io"
                    className="flex-1 bg-transparent py-2.5 pr-3 text-[13px] font-mono text-text-primary placeholder:text-text-muted focus:outline-none"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 font-mono text-[10px] text-status-deny uppercase" role="alert">IDENTIFICADOR INVÁLIDO</p>
                )}
              </div>

              {/* password field */}
              <div>
                <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-1.5">
                  <span className="text-accent-primary">B</span> CHAVE CRIPTOGRÁFICA
                </p>
                <div className="relative flex items-center border border-border-default bg-surface-elevated focus-within:border-border-accent transition-colors">
                  <span className="pl-3 pr-1 font-mono text-[13px] text-accent-primary select-none">›</span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="ingresse a chave"
                    className="flex-1 bg-transparent py-2.5 text-[13px] font-mono text-text-primary placeholder:text-text-muted focus:outline-none"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="px-3 font-mono text-[10px] tracking-widest text-text-muted hover:text-text-secondary transition-colors uppercase border-l border-border-default self-stretch flex items-center"
                  >
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 font-mono text-[10px] text-status-deny uppercase" role="alert">CHAVE OBRIGATÓRIA</p>
                )}
              </div>

              {/* trust + recover */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-3.5 h-3.5"
                    style={{ accentColor: '#F0A500' }}
                  />
                  <span className="font-mono text-[11px] text-text-secondary">confiar neste dispositivo · 30d</span>
                </label>
                <span className="font-mono text-[11px] text-text-muted hover:text-text-secondary cursor-pointer transition-colors">
                  recuperar →
                </span>
              </div>

              {/* action buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  disabled
                  className="px-5 py-3 border border-border-default font-mono text-[10px] tracking-widest text-text-muted uppercase leading-tight text-center cursor-not-allowed opacity-60"
                >
                  ESC ·{'\n'}SAIR
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 font-mono text-[11px] font-bold tracking-widest uppercase transition-colors disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-90 active:brightness-75"
                  style={{ backgroundColor: '#F0A500', color: '#0D1117' }}
                >
                  {isLoading ? 'AUTENTICANDO…' : 'EMITIR CREDENCIAL →'}
                </button>
              </div>
            </form>}
          </div>

          {/* status bar */}
          <div className="px-6 py-2.5 border-t border-border-subtle flex items-center justify-between bg-surface-elevated">
            <span className="font-mono text-[10px] tracking-wide" style={{ color: '#3FB950' }}>
              HANDSHAKE ESTÁVEL · TLS 1.3
            </span>
            <span className="font-mono text-[10px] tracking-wide text-text-muted">
              CHAIN · 4A:9C:2E:01:B7
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
