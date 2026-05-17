import { createContext, useContext, useState, type ReactNode } from 'react'

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

export function AuthProvider({ children, initialRole = null }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    token: initialRole ? 'mock-token' : null,
    role: initialRole,
    orgId: null,
  })

  return (
    <AuthContext.Provider value={{
      ...state,
      setAuth: setState,
      clearAuth: () => setState({ token: null, role: null, orgId: null }),
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
