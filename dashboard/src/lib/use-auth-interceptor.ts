import { useEffect, useCallback } from 'react'
import { useAuth } from './auth-context'
import { authService } from './auth-service'

export function parseJwtExp(token: string): number {
  const [, payload] = token.split('.')
  const decoded = JSON.parse(atob(payload)) as { exp: number }
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
      setAuth({
        token: result.accessToken,
        role: null,
        orgId: result.orgId,
      })
    } catch {
      clearAuth()
    }
  }, [token, orgId, setAuth, clearAuth])

  useEffect(() => {
    const interval = setInterval(() => { void tryRefresh() }, 30_000)
    return () => clearInterval(interval)
  }, [tryRefresh])

  return { tryRefresh }
}
