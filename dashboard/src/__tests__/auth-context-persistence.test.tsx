// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../lib/auth-context'

const MOCK_JWT = [
  'header',
  btoa(JSON.stringify({
    sub: 'user_123',
    orgId: 'org_456',
    sessionId: 'session_789',
    workspaceIds: [],
    roles: {},
    capabilities: [],
    exp: Math.floor(Date.now() / 1000) + 3600,
  })),
  'signature',
].join('.')

function AuthStateDisplay() {
  const { token, role, orgId } = useAuth()
  return (
    <div>
      <span data-testid="token">{token ?? 'null'}</span>
      <span data-testid="role">{role ?? 'null'}</span>
      <span data-testid="org-id">{orgId ?? 'null'}</span>
    </div>
  )
}

describe('AuthProvider - persistência localStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('inicia com estado nulo quando localStorage está vazio', () => {
    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>
    )

    expect(screen.getByTestId('token').textContent).toBe('null')
    expect(screen.getByTestId('role').textContent).toBe('null')
  })

  it('carrega accessToken do localStorage na inicialização', () => {
    localStorage.setItem('gk_access_token', MOCK_JWT)
    localStorage.setItem('gk_refresh_token', 'refresh_abc')
    localStorage.setItem('gk_session_id', 'session_789')
    localStorage.setItem('gk_org_id', 'org_456')

    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>
    )

    expect(screen.getByTestId('token').textContent).toBe(MOCK_JWT)
  })

  it('carrega orgId do localStorage na inicialização', () => {
    localStorage.setItem('gk_access_token', MOCK_JWT)
    localStorage.setItem('gk_refresh_token', 'refresh_abc')
    localStorage.setItem('gk_session_id', 'session_789')
    localStorage.setItem('gk_org_id', 'org_456')

    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>
    )

    expect(screen.getByTestId('org-id').textContent).toBe('org_456')
  })

  it('clearAuth() remove tokens do localStorage', async () => {
    localStorage.setItem('gk_access_token', MOCK_JWT)
    localStorage.setItem('gk_refresh_token', 'refresh')
    localStorage.setItem('gk_session_id', 'session')
    localStorage.setItem('gk_org_id', 'org')

    function ClearAuthButton() {
      const { clearAuth } = useAuth()
      return <button onClick={clearAuth}>Limpar</button>
    }

    render(
      <AuthProvider>
        <ClearAuthButton />
        <AuthStateDisplay />
      </AuthProvider>
    )

    await act(async () => {
      screen.getByRole('button').click()
    })

    expect(localStorage.getItem('gk_access_token')).toBeNull()
    expect(localStorage.getItem('gk_refresh_token')).toBeNull()
    expect(screen.getByTestId('token').textContent).toBe('null')
  })
})
