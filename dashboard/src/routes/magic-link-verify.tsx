import { createRoute, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Route as rootRoute } from './__root'
import { authService, AuthError, parseJwtPayload } from '../lib/auth-service'
import { useAuth } from '../lib/auth-context'
import { useNavigate } from '@tanstack/react-router'

export function MagicLinkVerifyPage() {
  const { setAuth } = useAuth()
  const navigate = useNavigate()
  const search = useSearch({ from: Route.id }) as { token?: string }
  const [status, setStatus] = useState<'verifying' | 'error' | 'mfa_challenge'>('verifying')
  const [errorMsg, setErrorMsg] = useState('')
  const [mfaToken, setMfaToken] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const didVerify = useRef(false)

  function navigateAfterLogin(accessToken: string, orgId: string) {
    const payload = parseJwtPayload(accessToken)
    const role = payload.orgId ? 'org_admin' : 'root'
    setAuth({ token: accessToken, role, orgId })
    if (role === 'root') {
      navigate({ to: '/root' })
    } else {
      navigate({ to: '/org/$orgId', params: { orgId } })
    }
  }

  useEffect(() => {
    if (didVerify.current) return
    didVerify.current = true

    const token = search.token
    if (!token) {
      setErrorMsg('LINK INVÁLIDO. TOKEN AUSENTE.')
      setStatus('error')
      return
    }

    authService.verifyMagicLink(token).then((result) => {
      if ('mfa_required' in result) {
        setMfaToken(result.mfa_token)
        setStatus('mfa_challenge')
        return
      }
      if ('mfa_setup_required' in result) {
        navigate({ to: '/login' })
        return
      }
      navigateAfterLogin(result.accessToken, result.orgId)
    }).catch((err) => {
      if (err instanceof AuthError && err.reason === 'invalid_or_expired') {
        setErrorMsg('LINK EXPIRADO OU JÁ UTILIZADO.')
      } else {
        setErrorMsg('FALHA NA VERIFICAÇÃO. TENTE NOVAMENTE.')
      }
      setStatus('error')
    })
  }, [])

  async function onMfaChallenge(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    try {
      const result = await authService.challengeMfa(mfaToken, mfaCode)
      navigateAfterLogin(result.accessToken, result.orgId)
    } catch {
      setErrorMsg('CÓDIGO INVÁLIDO OU EXPIRADO.')
      setStatus('error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center p-4">
      <div className="w-full max-w-[480px] bg-surface-card border border-border-default p-8 text-center space-y-4">
        <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase">
          <span className="text-accent-primary">//</span> MAGIC LINK / VERIFICAÇÃO
        </p>

        {status === 'verifying' && (
          <>
            <div className="w-6 h-6 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-mono text-[13px] text-text-secondary">VALIDANDO CREDENCIAL…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="font-mono text-[13px] text-status-deny uppercase">{errorMsg}</p>
            <button
              onClick={() => navigate({ to: '/login' })}
              className="font-mono text-[11px] tracking-widest text-accent-primary hover:brightness-90 uppercase transition-colors"
            >
              ← SOLICITAR NOVO LINK
            </button>
          </>
        )}

        {status === 'mfa_challenge' && (
          <form onSubmit={onMfaChallenge} noValidate className="space-y-4 text-left">
            <p className="font-mono text-[11px] text-text-muted">
              Informe o código TOTP ou código de backup para concluir o acesso.
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
            <button
              type="submit"
              disabled={isLoading || !mfaCode}
              className="w-full py-3 font-mono text-[11px] font-bold tracking-widest uppercase transition-colors disabled:opacity-60 hover:brightness-90"
              style={{ backgroundColor: '#F0A500', color: '#0D1117' }}
            >
              {isLoading ? 'VERIFICANDO…' : 'CONFIRMAR CÓDIGO →'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/magic-link/verify',
  component: MagicLinkVerifyPage,
})
