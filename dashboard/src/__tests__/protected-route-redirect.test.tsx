// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProtectedRoute } from '../components/protected-route'
import { AuthProvider } from '../lib/auth-context'
import type { UserRole } from '../lib/auth-context'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Navigate: ({ to }: { to: string }) => (
      <div data-testid="navigate" data-to={to} />
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

describe('ProtectedRoute com Navigate real', () => {
  it('renderiza children quando usuário tem role suficiente', () => {
    renderWithAuth('root', (
      <ProtectedRoute requiredRole="root">
        <div data-testid="conteudo-protegido">secreto</div>
      </ProtectedRoute>
    ))
    expect(screen.getByTestId('conteudo-protegido')).toBeDefined()
  })

  it('renderiza Navigate para /login quando não autenticado', () => {
    renderWithAuth(null, (
      <ProtectedRoute requiredRole="root">
        <div data-testid="conteudo-protegido">secreto</div>
      </ProtectedRoute>
    ))
    expect(screen.queryByTestId('conteudo-protegido')).toBeNull()
    const nav = screen.getByTestId('navigate')
    expect(nav.getAttribute('data-to')).toBe('/login')
  })

  it('renderiza Navigate para /login quando role é insuficiente', () => {
    renderWithAuth('org_admin', (
      <ProtectedRoute requiredRole="root">
        <div data-testid="conteudo-protegido">secreto</div>
      </ProtectedRoute>
    ))
    expect(screen.queryByTestId('conteudo-protegido')).toBeNull()
    const nav = screen.getByTestId('navigate')
    expect(nav.getAttribute('data-to')).toBe('/login')
  })

  it('não renderiza redirect-to-login stub quando não autenticado', () => {
    renderWithAuth(null, (
      <ProtectedRoute requiredRole="root">
        <div>protegido</div>
      </ProtectedRoute>
    ))
    expect(screen.queryByTestId('redirect-to-login')).toBeNull()
  })
})
