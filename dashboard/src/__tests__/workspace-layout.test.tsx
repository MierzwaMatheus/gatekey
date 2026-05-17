import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorkspaceLayout } from '../components/workspace/workspace-layout'
import { AuthProvider } from '../lib/auth-context'
import type { UserRole } from '../lib/auth-context'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => (
      <div data-testid="navigate-to-login" data-to={to} />
    ),
    useRouterState: () => ({ location: { pathname: '/org/abc/workspace/xyz' } }),
  }
})

function renderWithAuth(role: UserRole | null, children?: React.ReactNode) {
  return render(
    <AuthProvider initialRole={role}>
      <WorkspaceLayout wsId="xyz">
        {children ?? <div data-testid="page-content">content</div>}
      </WorkspaceLayout>
    </AuthProvider>
  )
}

describe('WorkspaceLayout', () => {
  it('redirects to /login when user has no role', () => {
    renderWithAuth(null)
    const nav = screen.getByTestId('navigate-to-login')
    expect(nav.getAttribute('data-to')).toBe('/login')
    expect(screen.queryByTestId('workspace-sidebar')).toBeNull()
  })

  it('redirects to /login when user is member only', () => {
    renderWithAuth('member')
    const nav = screen.getByTestId('navigate-to-login')
    expect(nav.getAttribute('data-to')).toBe('/login')
  })

  it('renders sidebar when user has workspace_admin role', () => {
    renderWithAuth('workspace_admin')
    expect(screen.getByTestId('workspace-sidebar')).toBeDefined()
  })

  it('renders sidebar when user has org_admin role', () => {
    renderWithAuth('org_admin')
    expect(screen.getByTestId('workspace-sidebar')).toBeDefined()
  })

  it('renders sidebar when user has root role', () => {
    renderWithAuth('root')
    expect(screen.getByTestId('workspace-sidebar')).toBeDefined()
  })

  it('sidebar has 220px width class', () => {
    renderWithAuth('workspace_admin')
    const sidebar = screen.getByTestId('workspace-sidebar')
    expect(sidebar.className).toContain('w-[220px]')
  })

  it('sidebar renders all expected nav items', () => {
    renderWithAuth('workspace_admin')
    expect(screen.getByTestId('nav-members')).toBeDefined()
    expect(screen.getByTestId('nav-roles')).toBeDefined()
    expect(screen.getByTestId('nav-bindings')).toBeDefined()
    expect(screen.getByTestId('nav-resource-types')).toBeDefined()
    expect(screen.getByTestId('nav-audit-log')).toBeDefined()
  })

  it('renders GateKey header with workspace id in sidebar', () => {
    renderWithAuth('workspace_admin')
    expect(screen.getByText('GateKey')).toBeDefined()
    expect(screen.getByText(/ws_/)).toBeDefined()
  })

  it('renders children content area', () => {
    renderWithAuth('workspace_admin')
    expect(screen.getByTestId('page-content')).toBeDefined()
  })

  it('renders circuit texture background element', () => {
    renderWithAuth('workspace_admin')
    expect(screen.getByTestId('circuit-texture')).toBeDefined()
  })
})
