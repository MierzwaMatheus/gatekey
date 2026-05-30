// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AuthProvider } from '../lib/auth-context'
import type { ImpersonationSession } from '../lib/auth-context'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet-content">page content</div>,
    useRouterState: () => ({ location: { pathname: '/root' } }),
  }
})

vi.mock('../lib/use-auth-interceptor', () => ({
  useAuthInterceptor: () => ({}),
}))

const SESSION: ImpersonationSession = {
  token: 'imp_token',
  targetUser: { id: 'user_1', name: 'Carlos Andrade' },
  expiresAt: Date.now() + 3600000,
  sessionId: 'session_imp_1',
}

async function renderRootRoute(impersonationSession: ImpersonationSession | null) {
  const { RootLayout } = await import('../routes/__root')
  render(
    <AuthProvider
      initialState={{
        token: 'root_token',
        role: 'root',
        orgId: null,
        impersonationSession,
      }}
    >
      <RootLayout />
    </AuthProvider>
  )
}

describe('__root RootLayout — impersonation banner', () => {
  it('não exibe banner quando impersonationSession é null', async () => {
    await renderRootRoute(null)
    expect(screen.queryByTestId('impersonation-banner')).toBeNull()
  })

  it('exibe banner com nome do usuário quando impersonationSession está preenchido', async () => {
    await renderRootRoute(SESSION)
    expect(screen.getByTestId('impersonation-banner')).toBeDefined()
    expect(screen.getByText(/Carlos Andrade/)).toBeDefined()
  })

  it('renderiza o Outlet junto com o banner', async () => {
    await renderRootRoute(SESSION)
    expect(screen.getByTestId('outlet-content')).toBeDefined()
  })

  it('banner permanece ao navegar — mantido no mesmo componente pai', async () => {
    await renderRootRoute(SESSION)
    const banner = screen.getByTestId('impersonation-banner')
    expect(banner).toBeDefined()
    expect(screen.getByText(/Carlos Andrade/)).toBeDefined()
  })
})
