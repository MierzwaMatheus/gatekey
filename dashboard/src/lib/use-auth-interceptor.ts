import { useEffect, useCallback } from 'react'
import { useAuth } from './auth-context'
import { authService, parseJwtPayload } from './auth-service'
import { registerRefreshCallback, registerRefreshFailedCallback, unregisterRefreshCallback } from './token-refresh'

function base64urlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
  return atob(padded)
}

export function parseJwtExp(token: string): number {
  const [, payload] = token.split('.')
  const decoded = JSON.parse(base64urlDecode(payload)) as { exp: number }
  return decoded.exp
}

export function isTokenExpiringSoon(token: string): boolean {
  const exp = parseJwtExp(token)
  return exp * 1000 - Date.now() < 60_000
}

export function useAuthInterceptor() {
  const { token, orgId, setAuth, clearAuth } = useAuth()

  const tryRefresh = useCallback(async () => {
    if (!token || !isTokenExpiringSoon(token)) return

    const stored = authService.getStoredTokens()
    if (!stored) {
      clearAuth()
      return
    }

    try {
      const result = await authService.refresh(
        stored.sessionId,
        stored.refreshToken,
        stored.orgId ?? orgId ?? ''
      )
      const payload = parseJwtPayload(result.accessToken)
      const role = payload.orgId ? 'org_admin' : 'root'
      setAuth({
        token: result.accessToken,
        role,
        orgId: result.orgId,
        impersonationSession: null,
      })
    } catch {
      clearAuth()
    }
  }, [token, orgId, setAuth, clearAuth])

  // Register callback so token-refresh.ts can update the auth context
  // when apiFetch triggers a reactive 401 refresh
  useEffect(() => {
    registerRefreshCallback((newToken, newOrgId, role) => {
      setAuth({ token: newToken, role, orgId: newOrgId, impersonationSession: null })
    })
    registerRefreshFailedCallback(() => {
      clearAuth()
    })
    return () => unregisterRefreshCallback()
  }, [setAuth, clearAuth])

  // Run immediately on mount so an expired token at page-load is refreshed
  // before the first API calls fail
  useEffect(() => {
    void tryRefresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const interval = setInterval(() => { void tryRefresh() }, 30_000)
    return () => clearInterval(interval)
  }, [tryRefresh])

  return { tryRefresh }
}
