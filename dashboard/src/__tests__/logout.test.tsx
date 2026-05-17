import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthProvider } from '../lib/auth-context'
import { authService } from '../lib/auth-service'
import { useLogout } from '../lib/use-logout'

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

vi.mock('../lib/auth-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/auth-service')>()
  return {
    ...actual,
    authService: {
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      getStoredTokens: vi.fn(),
      clearTokens: vi.fn(),
    },
  }
})

function LogoutButton() {
  const { handleLogout, isLoggingOut } = useLogout()
  return (
    <button onClick={handleLogout} disabled={isLoggingOut}>
      {isLoggingOut ? 'Saindo…' : 'Sair'}
    </button>
  )
}

function renderWithAuth(token: string | null) {
  return render(
    <AuthProvider>
      <LogoutButton />
    </AuthProvider>
  )
}

describe('useLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('chama authService.logout() com o accessToken ao clicar em Sair', async () => {
    const token = 'my_access_token'
    localStorage.setItem('gk_access_token', token)
    localStorage.setItem('gk_refresh_token', 'r')
    localStorage.setItem('gk_session_id', 's')
    localStorage.setItem('gk_org_id', 'o')

    vi.mocked(authService.logout).mockResolvedValue()

    renderWithAuth(token)

    fireEvent.click(screen.getByRole('button', { name: /sair/i }))

    await waitFor(() => {
      expect(authService.logout).toHaveBeenCalledWith(token)
    })
  })

  it('navega para /login após logout bem-sucedido', async () => {
    localStorage.setItem('gk_access_token', 'tok')
    localStorage.setItem('gk_refresh_token', 'r')
    localStorage.setItem('gk_session_id', 's')
    localStorage.setItem('gk_org_id', 'o')

    vi.mocked(authService.logout).mockResolvedValue()

    renderWithAuth('tok')

    fireEvent.click(screen.getByRole('button', { name: /sair/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' })
    })
  })

  it('botão fica desabilitado durante o logout', async () => {
    localStorage.setItem('gk_access_token', 'tok')
    localStorage.setItem('gk_refresh_token', 'r')
    localStorage.setItem('gk_session_id', 's')
    localStorage.setItem('gk_org_id', 'o')

    vi.mocked(authService.logout).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 200))
    )

    renderWithAuth('tok')

    fireEvent.click(screen.getByRole('button', { name: /sair/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saindo/i })).toBeDefined()
      expect(screen.getByRole('button').getAttribute('disabled')).toBeDefined()
    })
  })
})
