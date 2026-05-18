// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProtectedRoute } from '../components/protected-route'
import { AuthProvider } from '../lib/auth-context'
import type { UserRole } from '../lib/auth-context'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => (
      <div data-testid="navigate-to-login" data-to={to} />
    ),
  }
})

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

  it('renders Navigate to /login when user has no role (unauthenticated)', () => {
    renderWithAuth(null, (
      <ProtectedRoute requiredRole="root">
        <div data-testid="protected-content">secret</div>
      </ProtectedRoute>
    ))
    expect(screen.queryByTestId('protected-content')).toBeNull()
    const nav = screen.getByTestId('navigate-to-login')
    expect(nav.getAttribute('data-to')).toBe('/login')
  })

  it('renders Navigate to /login when user has insufficient role', () => {
    renderWithAuth('org_admin', (
      <ProtectedRoute requiredRole="root">
        <div data-testid="protected-content">secret</div>
      </ProtectedRoute>
    ))
    expect(screen.queryByTestId('protected-content')).toBeNull()
    const nav = screen.getByTestId('navigate-to-login')
    expect(nav.getAttribute('data-to')).toBe('/login')
  })
})
