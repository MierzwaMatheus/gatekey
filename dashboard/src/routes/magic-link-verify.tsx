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
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying')
  const [errorMsg, setErrorMsg] = useState('')
  const didVerify = useRef(false)

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
      const payload = parseJwtPayload(result.accessToken)
      const role = payload.orgId ? 'org_admin' : 'root'
      setAuth({ token: result.accessToken, role, orgId: result.orgId })
      if (role === 'root') {
        navigate({ to: '/root' })
      } else {
        navigate({ to: '/org/$orgId', params: { orgId: result.orgId } })
      }
    }).catch((err) => {
      if (err instanceof AuthError && err.reason === 'invalid_or_expired') {
        setErrorMsg('LINK EXPIRADO OU JÁ UTILIZADO.')
      } else {
        setErrorMsg('FALHA NA VERIFICAÇÃO. TENTE NOVAMENTE.')
      }
      setStatus('error')
    })
  }, [])

  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center p-4">
      <div className="w-full max-w-[480px] bg-surface-card border border-border-default p-8 text-center space-y-4">
        <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase">
          <span className="text-accent-primary">//</span> MAGIC LINK / VERIFICAÇÃO
        </p>

        {status === 'verifying' ? (
          <>
            <div className="w-6 h-6 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-mono text-[13px] text-text-secondary">VALIDANDO CREDENCIAL…</p>
          </>
        ) : (
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
      </div>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/magic-link/verify',
  component: MagicLinkVerifyPage,
})
