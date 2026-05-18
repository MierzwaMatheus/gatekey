import { createContext, useContext, useState, type ReactNode } from 'react'
import { getStoredTokens, parseJwtPayload } from './auth-service'
import { startImpersonation as apiStartImpersonation, endImpersonation as apiEndImpersonation, getUser } from './root-api'

export type UserRole = 'root' | 'org_admin' | 'workspace_admin' | 'member'

export interface ImpersonationSession {
  token: string
  targetUser: { id: string; name: string }
  expiresAt: number
  sessionId: string
}

interface AuthState {
  token: string | null
  role: UserRole | null
  orgId: string | null
  impersonationSession: ImpersonationSession | null
}

interface AuthContextValue extends AuthState {
  setAuth: (state: AuthState) => void
  clearAuth: () => void
  startImpersonation: (targetUserId: string) => Promise<void>
  endImpersonation: () => Promise<void>
  getActiveToken: () => string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
  initialRole?: UserRole | null
  initialState?: AuthState
}

function loadInitialState(initialRole?: UserRole | null, initialState?: AuthState): AuthState {
  if (initialState) {
    return initialState
  }
  if (initialRole) {
    return { token: 'mock-token', role: initialRole, orgId: null, impersonationSession: null }
  }

  const stored = getStoredTokens()
  if (!stored) {
    return { token: null, role: null, orgId: null, impersonationSession: null }
  }

  let role: UserRole | null = null
  try {
    const payload = parseJwtPayload(stored.accessToken)
    role = payload.orgId ? 'org_admin' : 'root'
  } catch {
    // token malformed, leave role as null
  }

  return {
    token: stored.accessToken,
    role,
    orgId: stored.orgId,
    impersonationSession: null,
  }
}

function clearStoredTokens() {
  const keys = ['gk_access_token', 'gk_refresh_token', 'gk_session_id', 'gk_org_id']
  keys.forEach((key) => localStorage.removeItem(key))
}

export function AuthProvider({ children, initialRole = null, initialState }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(() => loadInitialState(initialRole, initialState))

  function clearAuth() {
    clearStoredTokens()
    setState({ token: null, role: null, orgId: null, impersonationSession: null })
  }

  async function startImpersonation(targetUserId: string) {
    if (!state.token) throw new Error('Not authenticated')
    const result = await apiStartImpersonation(state.token, targetUserId)
    let targetName = targetUserId
    try {
      const user = await getUser(state.token, targetUserId)
      targetName = user.name ?? user.email
    } catch {
      // use targetUserId as fallback name
    }
    setState((prev) => ({
      ...prev,
      impersonationSession: {
        token: result.impersonationToken,
        targetUser: { id: targetUserId, name: targetName },
        expiresAt: result.expiresAt,
        sessionId: result.sessionId,
      },
    }))
  }

  async function endImpersonation() {
    if (!state.token || !state.impersonationSession) return
    await apiEndImpersonation(state.token, state.impersonationSession.sessionId)
    setState((prev) => ({ ...prev, impersonationSession: null }))
  }

  return (
    <AuthContext.Provider value={{
      ...state,
      setAuth: setState,
      clearAuth,
      startImpersonation,
      endImpersonation,
      getActiveToken: () => state.impersonationSession?.token ?? state.token,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
