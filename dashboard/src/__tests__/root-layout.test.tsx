// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RootLayout } from '../components/root/root-layout'
import { AuthProvider } from '../lib/auth-context'
import type { UserRole } from '../lib/auth-context'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => (
      <div data-testid="navigate-to-login" data-to={to} />
    ),
    useRouterState: () => ({ location: { pathname: '/root' } }),
  }
})

function renderWithAuth(role: UserRole | null, children?: React.ReactNode) {
  return render(
    <AuthProvider initialRole={role}>
      <RootLayout>{children ?? <div data-testid="page-content">content</div>}</RootLayout>
    </AuthProvider>
  )
}

describe('RootLayout', () => {
  it('redirects to /login when user has no role', () => {
    renderWithAuth(null)
    const nav = screen.getByTestId('navigate-to-login')
    expect(nav.getAttribute('data-to')).toBe('/login')
    expect(screen.queryByTestId('root-sidebar')).toBeNull()
  })

  it('redirects to /login when user is not root', () => {
    renderWithAuth('org_admin')
    const nav = screen.getByTestId('navigate-to-login')
    expect(nav.getAttribute('data-to')).toBe('/login')
  })

  it('renders sidebar when user has root role', () => {
    renderWithAuth('root')
    expect(screen.getByTestId('root-sidebar')).toBeDefined()
  })

  it('sidebar has 220px width class', () => {
    renderWithAuth('root')
    const sidebar = screen.getByTestId('root-sidebar')
    expect(sidebar.className).toContain('w-[220px]')
  })

  it('sidebar renders all expected nav items', () => {
    renderWithAuth('root')
    expect(screen.getByTestId('nav-orgs')).toBeDefined()
    expect(screen.getByTestId('nav-sessions')).toBeDefined()
    expect(screen.getByTestId('nav-audit-log')).toBeDefined()
    expect(screen.getByTestId('nav-capabilities')).toBeDefined()
    expect(screen.getByTestId('nav-api-keys')).toBeDefined()
    expect(screen.getByTestId('nav-quotas')).toBeDefined()
    expect(screen.getByTestId('nav-cold-storage')).toBeDefined()
  })

  it('renders GateKey Root header in sidebar', () => {
    renderWithAuth('root')
    expect(screen.getByText('GateKey')).toBeDefined()
    expect(screen.getByText('Root')).toBeDefined()
  })

  it('renders children content area', () => {
    renderWithAuth('root')
    expect(screen.getByTestId('page-content')).toBeDefined()
  })

  it('renders circuit texture background element', () => {
    renderWithAuth('root')
    expect(screen.getByTestId('circuit-texture')).toBeDefined()
  })
})
