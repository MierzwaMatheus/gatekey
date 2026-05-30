import { authService, parseJwtPayload } from './auth-service'
import type { UserRole } from './auth-context'

type RefreshCallback = (token: string, orgId: string, role: UserRole) => void
type RefreshFailedCallback = (sessionId: string) => void

let onRefreshed: RefreshCallback | null = null
let onRefreshFailed: RefreshFailedCallback | null = null
let pendingRefresh: Promise<string | null> | null = null

export function registerRefreshCallback(cb: RefreshCallback) {
  onRefreshed = cb
}

export function registerRefreshFailedCallback(cb: RefreshFailedCallback) {
  onRefreshFailed = cb
}

export function unregisterRefreshCallback() {
  onRefreshed = null
  onRefreshFailed = null
}

export async function refreshToken(): Promise<string | null> {
  if (pendingRefresh) return pendingRefresh

  pendingRefresh = (async () => {
    const stored = authService.getStoredTokens()
    if (!stored) return null
    const sessionId = stored.sessionId
    try {
      const result = await authService.refresh(sessionId, stored.refreshToken, stored.orgId)
      const current = authService.getStoredTokens()
      if (current && current.sessionId !== sessionId) {
        return null
      }
      authService.saveTokens(result, result.orgId)
      const payload = parseJwtPayload(result.accessToken)
      const role: UserRole = payload.orgId ? 'org_admin' : 'root'
      onRefreshed?.(result.accessToken, result.orgId, role)
      return result.accessToken
    } catch {
      onRefreshFailed?.(sessionId)
      return null
    } finally {
      pendingRefresh = null
    }
  })()

  return pendingRefresh
}
