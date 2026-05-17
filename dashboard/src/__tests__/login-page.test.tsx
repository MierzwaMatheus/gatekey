import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginPage } from '../routes/login'
import { AuthProvider } from '../lib/auth-context'
import { authService, AuthError } from '../lib/auth-service'

vi.mock('../lib/auth-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/auth-service')>()
  return {
    ...actual,
    authService: {
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    },
  }
})

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

function renderLoginPage() {
  return render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza campo de email', () => {
    renderLoginPage()
    expect(screen.getByLabelText(/email/i)).toBeDefined()
  })

  it('renderiza campo de senha', () => {
    renderLoginPage()
    expect(screen.getByLabelText(/senha/i)).toBeDefined()
  })

  it('renderiza botão de submit', () => {
    renderLoginPage()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeDefined()
  })

  it('renderiza título GateKey', () => {
    renderLoginPage()
    expect(screen.getByText('GateKey')).toBeDefined()
  })

  it('exibe erro de email inválido ao submeter', async () => {
    renderLoginPage()
    const emailInput = screen.getByLabelText(/email/i)
    const submitButton = screen.getByRole('button', { name: /entrar/i })

    await userEvent.type(emailInput, 'nao-e-email')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/email inválido/i)).toBeDefined()
    })
  })

  it('exibe erro de senha obrigatória ao submeter sem senha', async () => {
    renderLoginPage()
    const emailInput = screen.getByLabelText(/email/i)
    const submitButton = screen.getByRole('button', { name: /entrar/i })

    await userEvent.type(emailInput, 'user@example.com')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/senha obrigatória/i)).toBeDefined()
    })
  })

  it('botão tem classe de design system accent-primary', () => {
    renderLoginPage()
    const button = screen.getByRole('button', { name: /entrar/i })
    expect(button.className).toContain('accent-primary')
  })

  it('card de login tem classe bg-surface-card', () => {
    const { container } = renderLoginPage()
    const card = container.querySelector('.bg-surface-card')
    expect(card).not.toBeNull()
  })

  it('mostra estado de loading durante o submit', async () => {
    vi.mocked(authService.login).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 200))
    )

    renderLoginPage()
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/senha/i), 'minhasenha')

    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /entrando/i })).toBeDefined()
    })
  })

  it('exibe mensagem de credenciais inválidas retornada pela API', async () => {
    vi.mocked(authService.login).mockRejectedValue(
      new AuthError('invalid_credentials')
    )

    renderLoginPage()
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/senha/i), 'senhaerrada')

    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(screen.getByText(/email ou senha incorretos/i)).toBeDefined()
    })
  })

  it('exibe mensagem de conta bloqueada quando API retorna account_locked', async () => {
    vi.mocked(authService.login).mockRejectedValue(
      new AuthError('account_locked', Date.now() + 900_000)
    )

    renderLoginPage()
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/senha/i), 'senhaerrada')

    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(screen.getByText(/conta bloqueada/i)).toBeDefined()
    })
  })
})
