import type { ReactNode } from 'react'
import { useAuth, type UserRole } from '../lib/auth-context'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  root: 4,
  org_admin: 3,
  workspace_admin: 2,
  member: 1,
}

interface ProtectedRouteProps {
  requiredRole: UserRole
  children: ReactNode
}

export function ProtectedRoute({ requiredRole, children }: ProtectedRouteProps) {
  const { token, role } = useAuth()

  const hasAccess = token && role && ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole]

  if (!hasAccess) {
    return <div data-testid="redirect-to-login" />
  }

  return <>{children}</>
}
