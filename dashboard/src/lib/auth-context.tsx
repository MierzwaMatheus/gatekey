import { createContext, useContext, useState, type ReactNode } from 'react'
import { getStoredTokens, parseJwtPayload } from './auth-service'

export type UserRole = 'root' | 'org_admin' | 'workspace_admin' | 'member'

interface AuthState {
  token: string | null
  role: UserRole | null
  orgId: string | null
}

interface AuthContextValue extends AuthState {
  setAuth: (state: AuthState) => void
  clearAuth: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
  initialRole?: UserRole | null
}

function loadInitialState(initialRole?: UserRole | null): AuthState {
  if (initialRole) {
    return { token: 'mock-token', role: initialRole, orgId: null }
  }

  const stored = getStoredTokens()
  if (!stored) {
    return { token: null, role: null, orgId: null }
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
  }
}

function clearStoredTokens() {
  const keys = ['gk_access_token', 'gk_refresh_token', 'gk_session_id', 'gk_org_id']
  keys.forEach((key) => localStorage.removeItem(key))
}

export function AuthProvider({ children, initialRole = null }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(() => loadInitialState(initialRole))

  function clearAuth() {
    clearStoredTokens()
    setState({ token: null, role: null, orgId: null })
  }

  return (
    <AuthContext.Provider value={{
      ...state,
      setAuth: setState,
      clearAuth,
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
