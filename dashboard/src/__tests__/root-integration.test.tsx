import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RootLayout, type RootSection } from '../components/root/root-layout'
import { AuthProvider } from '../lib/auth-context'

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

function renderRootLayout(
  activeSection: RootSection = 'orgs',
  onSectionChange = vi.fn(),
) {
  return render(
    <AuthProvider initialRole="root">
      <RootLayout activeSection={activeSection} onSectionChange={onSectionChange}>
        <div data-testid="section-content">conteúdo da seção</div>
      </RootLayout>
    </AuthProvider>,
  )
}

describe('RootLayout — integração de navegação', () => {
  it('marks orgs nav item as active by default', () => {
    renderRootLayout('orgs')
    const orgsBtn = screen.getByTestId('nav-orgs')
    expect(orgsBtn.className).toContain('text-text-primary')
  })

  it('calls onSectionChange when clicking a nav item', async () => {
    const onSectionChange = vi.fn()
    renderRootLayout('orgs', onSectionChange)
    await userEvent.click(screen.getByTestId('nav-sessions'))
    expect(onSectionChange).toHaveBeenCalledWith('sessions')
  })

  it('calls onSectionChange for audit-log nav', async () => {
    const onSectionChange = vi.fn()
    renderRootLayout('orgs', onSectionChange)
    await userEvent.click(screen.getByTestId('nav-audit-log'))
    expect(onSectionChange).toHaveBeenCalledWith('audit-log')
  })

  it('calls onSectionChange for capabilities nav', async () => {
    const onSectionChange = vi.fn()
    renderRootLayout('orgs', onSectionChange)
    await userEvent.click(screen.getByTestId('nav-capabilities'))
    expect(onSectionChange).toHaveBeenCalledWith('capabilities')
  })

  it('renders children in main content area', () => {
    renderRootLayout()
    expect(screen.getByTestId('section-content')).toBeDefined()
  })

  it('active section nav item has accent border styling', () => {
    renderRootLayout('audit-log')
    const auditBtn = screen.getByTestId('nav-audit-log')
    expect(auditBtn.className).toContain('border-accent-primary')
  })

  it('inactive nav items have transparent border', () => {
    renderRootLayout('orgs')
    const sessionsBtn = screen.getByTestId('nav-sessions')
    expect(sessionsBtn.className).toContain('border-transparent')
  })
})

describe('RootPage — composição completa', () => {
  it('renders RootPage component without crashing', async () => {
    const { RootPage } = await import('../routes/root/root-page')
    render(
      <AuthProvider initialRole="root">
        <RootPage />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('root-sidebar')).toBeDefined())
  })

  it('default section is orgs', async () => {
    const { RootPage } = await import('../routes/root/root-page')
    render(
      <AuthProvider initialRole="root">
        <RootPage />
      </AuthProvider>,
    )
    await waitFor(() => {
      const orgsBtn = screen.getByTestId('nav-orgs')
      expect(orgsBtn.className).toContain('border-accent-primary')
    })
  })
})
