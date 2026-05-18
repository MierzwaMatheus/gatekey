// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../lib/auth-context'

const MOCK_ROOT_JWT = [
  'header',
  btoa(JSON.stringify({
    sub: 'root_user_1',
    orgId: null,
    sessionId: 'session_root',
    workspaceIds: [],
    roles: {},
    capabilities: [],
    exp: Math.floor(Date.now() / 1000) + 3600,
  })),
  'signature',
].join('.')

function ImpersonationStateDisplay() {
  const { impersonationSession } = useAuth()
  if (!impersonationSession) return <span data-testid="no-session">null</span>
  return (
    <div>
      <span data-testid="imp-user-id">{impersonationSession.targetUser.id}</span>
      <span data-testid="imp-user-name">{impersonationSession.targetUser.name}</span>
      <span data-testid="imp-token">{impersonationSession.token}</span>
    </div>
  )
}

function ImpersonationControls() {
  const { startImpersonation, endImpersonation } = useAuth()
  return (
    <div>
      <button onClick={() => void startImpersonation('target_user_1')}>
        Entrar como
      </button>
      <button onClick={() => void endImpersonation()}>
        Encerrar
      </button>
    </div>
  )
}

describe('AuthContext — impersonation session', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('impersonationSession inicia como null', () => {
    render(
      <AuthProvider initialState={{ token: MOCK_ROOT_JWT, role: 'root', orgId: null }}>
        <ImpersonationStateDisplay />
      </AuthProvider>
    )
    expect(screen.getByTestId('no-session').textContent).toBe('null')
  })

  it('startImpersonation armazena token e targetUser no contexto', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        impersonationToken: 'imp_token_abc',
        expiresAt: Date.now() + 3600000,
        sessionId: 'imp_session_1',
      }),
    } as Response).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'Ana Silva', email: 'ana@example.com' }),
    } as Response)

    render(
      <AuthProvider initialState={{ token: MOCK_ROOT_JWT, role: 'root', orgId: null }}>
        <ImpersonationStateDisplay />
        <ImpersonationControls />
      </AuthProvider>
    )

    expect(screen.getByTestId('no-session')).toBeDefined()

    await act(async () => {
      screen.getByRole('button', { name: /Entrar como/i }).click()
    })

    expect(screen.queryByTestId('no-session')).toBeNull()
    expect(screen.getByTestId('imp-token').textContent).toBe('imp_token_abc')
    expect(screen.getByTestId('imp-user-id').textContent).toBe('target_user_1')
  })

  it('endImpersonation limpa impersonationSession do contexto', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          impersonationToken: 'imp_token_abc',
          expiresAt: Date.now() + 3600000,
          sessionId: 'imp_session_1',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Ana Silva', email: 'ana@example.com' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ended: true }),
      } as Response)

    render(
      <AuthProvider initialState={{ token: MOCK_ROOT_JWT, role: 'root', orgId: null }}>
        <ImpersonationStateDisplay />
        <ImpersonationControls />
      </AuthProvider>
    )

    await act(async () => {
      screen.getByRole('button', { name: /Entrar como/i }).click()
    })

    expect(screen.queryByTestId('no-session')).toBeNull()

    await act(async () => {
      screen.getByRole('button', { name: /Encerrar/i }).click()
    })

    expect(screen.getByTestId('no-session').textContent).toBe('null')
  })
})
