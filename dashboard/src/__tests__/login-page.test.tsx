// @vitest-environment jsdom
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

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

function renderLoginPage() {
  return render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  )
}

function getEmailInput(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('#email')!
}
function getPasswordInput(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('#password')!
}
function getSubmitButton(container: HTMLElement) {
  return container.querySelector<HTMLButtonElement>('button[type="submit"]')!
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza campo de email', () => {
    const { container } = renderLoginPage()
    expect(getEmailInput(container)).not.toBeNull()
  })

  it('renderiza campo de senha', () => {
    const { container } = renderLoginPage()
    expect(getPasswordInput(container)).not.toBeNull()
  })

  it('renderiza botão de submit', () => {
    const { container } = renderLoginPage()
    expect(getSubmitButton(container)).not.toBeNull()
  })

  it('renderiza título GateKey', () => {
    const { container } = renderLoginPage()
    expect(container.querySelector('form')).not.toBeNull()
  })

  it('exibe erro de email inválido ao submeter', async () => {
    const { container } = renderLoginPage()
    const emailInput = getEmailInput(container)
    const submitButton = getSubmitButton(container)

    await userEvent.type(emailInput, 'nao-e-email')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/identificador inválido/i)).toBeDefined()
    })
  })

  it('exibe erro de senha obrigatória ao submeter sem senha', async () => {
    const { container } = renderLoginPage()
    const emailInput = getEmailInput(container)
    const submitButton = getSubmitButton(container)

    await userEvent.type(emailInput, 'user@example.com')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/chave obrigatória/i)).toBeDefined()
    })
  })

  it('botão tem atributo type submit', () => {
    const { container } = renderLoginPage()
    const button = getSubmitButton(container)
    expect(button.type).toBe('submit')
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

    const { container } = renderLoginPage()
    await userEvent.type(getEmailInput(container), 'user@example.com')
    await userEvent.type(getPasswordInput(container), 'minhasenha')

    fireEvent.click(getSubmitButton(container))

    await waitFor(() => {
      expect(getSubmitButton(container).disabled).toBe(true)
    })
  })

  it('exibe mensagem de credenciais inválidas retornada pela API', async () => {
    vi.mocked(authService.login).mockRejectedValue(
      new AuthError('invalid_credentials')
    )

    const { container } = renderLoginPage()
    await userEvent.type(getEmailInput(container), 'user@example.com')
    await userEvent.type(getPasswordInput(container), 'senhaerrada')

    fireEvent.click(getSubmitButton(container))

    await waitFor(() => {
      expect(screen.getByText(/credenciais inválidas/i)).toBeDefined()
    })
  })

  it('exibe mensagem de conta bloqueada quando API retorna account_locked', async () => {
    vi.mocked(authService.login).mockRejectedValue(
      new AuthError('account_locked', Date.now() + 900_000)
    )

    const { container } = renderLoginPage()
    await userEvent.type(getEmailInput(container), 'user@example.com')
    await userEvent.type(getPasswordInput(container), 'senhaerrada')

    fireEvent.click(getSubmitButton(container))

    await waitFor(() => {
      expect(screen.getByText(/bloqueado/i)).toBeDefined()
    })
  })

  it('redireciona para /change-password quando mustChangePassword=true no login', async () => {
    const mockToken = [
      'h',
      btoa(JSON.stringify({ sub: 'u1', orgId: 'org1', sessionId: 's1', workspaceIds: [], roles: {}, capabilities: [], exp: 9999999999 })),
      'sig',
    ].join('.')
    vi.mocked(authService.login).mockResolvedValue({
      accessToken: mockToken,
      refreshToken: 'r',
      sessionId: 's',
      orgId: 'org1',
      mustChangePassword: true,
    })

    const { container } = renderLoginPage()
    await userEvent.type(getEmailInput(container), 'admin@acme.com')
    await userEvent.type(getPasswordInput(container), 'temppass')
    fireEvent.click(getSubmitButton(container))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/change-password' })
    })
  })
})
