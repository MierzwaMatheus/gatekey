// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../lib/auth-context'
import { ImpersonationUsersList } from '../components/root/impersonation-users-list'
import { ImpersonationBanner } from '../components/root/impersonation-banner'

const MOCK_USERS = [
  { id: 'user_1', name: 'Ana Lima', email: 'ana@example.com' },
  { id: 'user_2', name: 'Bruno Souza', email: 'bruno@example.com' },
]

vi.mock('../lib/use-auth-interceptor', () => ({
  useAuthInterceptor: () => ({}),
}))

const ROOT_TOKEN = 'root_token_xyz'

function TestApp() {
  const { impersonationSession, startImpersonation, endImpersonation } = useAuth()
  return (
    <div>
      {impersonationSession && (
        <ImpersonationBanner
          impersonating={impersonationSession.targetUser}
          onEnd={() => void endImpersonation()}
        />
      )}
      <ImpersonationUsersList
        users={MOCK_USERS}
        onImpersonate={(userId) => void startImpersonation(userId)}
      />
    </div>
  )
}

describe('Impersonation — fluxo de integração no dashboard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exibe tabela com botão "Entrar como" para cada usuário', () => {
    render(
      <AuthProvider initialState={{ token: ROOT_TOKEN, role: 'root', orgId: null, impersonationSession: null }}>
        <ImpersonationUsersList users={MOCK_USERS} onImpersonate={vi.fn()} />
      </AuthProvider>
    )
    expect(screen.getByText('Ana Lima')).toBeDefined()
    expect(screen.getByText('Bruno Souza')).toBeDefined()
    const buttons = screen.getAllByRole('button', { name: /Entrar como/i })
    expect(buttons).toHaveLength(2)
  })

  it('banner não aparece antes de iniciar impersonation', () => {
    render(
      <AuthProvider initialState={{ token: ROOT_TOKEN, role: 'root', orgId: null, impersonationSession: null }}>
        <TestApp />
      </AuthProvider>
    )
    expect(screen.queryByTestId('impersonation-banner')).toBeNull()
  })

  it('fluxo completo: clicar "Entrar como" → banner aparece → clicar "Encerrar" → banner desaparece', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          impersonationToken: 'imp_tok_123',
          expiresAt: Date.now() + 3600000,
          sessionId: 'imp_sess_1',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ _id: 'user_1', name: 'Ana Lima', email: 'ana@example.com' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ended: true }),
      } as Response)

    render(
      <AuthProvider initialState={{ token: ROOT_TOKEN, role: 'root', orgId: null, impersonationSession: null }}>
        <TestApp />
      </AuthProvider>
    )

    expect(screen.queryByTestId('impersonation-banner')).toBeNull()

    const [firstButton] = screen.getAllByRole('button', { name: /Entrar como/i })
    await act(async () => {
      await userEvent.click(firstButton)
    })

    const banner = screen.getByTestId('impersonation-banner')
    expect(banner).toBeDefined()
    expect(banner.textContent).toContain('Ana Lima')

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /Encerrar/i }))
    })

    expect(screen.queryByTestId('impersonation-banner')).toBeNull()
  })
})

describe('ImpersonationUsersList', () => {
  it('renderiza email quando name não está disponível', () => {
    const users = [{ id: 'u1', name: '', email: 'only@example.com' }]
    render(
      <AuthProvider initialState={{ token: ROOT_TOKEN, role: 'root', orgId: null, impersonationSession: null }}>
        <ImpersonationUsersList users={users} onImpersonate={vi.fn()} />
      </AuthProvider>
    )
    const nameCell = screen.getByTestId('user-name-u1')
    expect(nameCell.textContent).toBe('only@example.com')
  })

  it('chama onImpersonate com o userId correto ao clicar no botão', async () => {
    const onImpersonate = vi.fn()
    render(
      <AuthProvider initialState={{ token: ROOT_TOKEN, role: 'root', orgId: null, impersonationSession: null }}>
        <ImpersonationUsersList users={MOCK_USERS} onImpersonate={onImpersonate} />
      </AuthProvider>
    )
    const buttons = screen.getAllByRole('button', { name: /Entrar como/i })
    await userEvent.click(buttons[1])
    expect(onImpersonate).toHaveBeenCalledWith('user_2')
  })
})
