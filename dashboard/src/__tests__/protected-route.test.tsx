import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProtectedRoute } from '../components/protected-route'
import { AuthProvider } from '../lib/auth-context'
import type { UserRole } from '../lib/auth-context'

function renderWithAuth(role: UserRole | null, children: React.ReactNode) {
  return render(
    <AuthProvider initialRole={role}>
      {children}
    </AuthProvider>
  )
}

describe('ProtectedRoute', () => {
  it('renders children when user has required role', () => {
    renderWithAuth('root', (
      <ProtectedRoute requiredRole="root">
        <div data-testid="protected-content">secret</div>
      </ProtectedRoute>
    ))
    expect(screen.getByTestId('protected-content')).toBeDefined()
  })

  it('renders redirect when user has no role (unauthenticated)', () => {
    renderWithAuth(null, (
      <ProtectedRoute requiredRole="root">
        <div data-testid="protected-content">secret</div>
      </ProtectedRoute>
    ))
    expect(screen.queryByTestId('protected-content')).toBeNull()
    expect(screen.getByTestId('redirect-to-login')).toBeDefined()
  })

  it('renders redirect when user has insufficient role', () => {
    renderWithAuth('org_admin', (
      <ProtectedRoute requiredRole="root">
        <div data-testid="protected-content">secret</div>
      </ProtectedRoute>
    ))
    expect(screen.queryByTestId('protected-content')).toBeNull()
    expect(screen.getByTestId('redirect-to-login')).toBeDefined()
  })
})
