// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import React from 'react'
import { AuthProvider } from '../lib/auth-context'
import { authService, AuthError } from '../lib/auth-service'
import { parseJwtExp, isTokenExpiringSoon, useAuthInterceptor } from '../lib/use-auth-interceptor'

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

function makeJwtWithExp(expOffsetSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds
  const payload = btoa(JSON.stringify({ sub: 'u', orgId: 'o', sessionId: 's', exp }))
  return `header.${payload}.sig`
}

describe('parseJwtExp', () => {
  it('extrai exp do payload JWT', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const token = `h.${btoa(JSON.stringify({ exp: futureExp }))}.s`

    expect(parseJwtExp(token)).toBe(futureExp)
  })
})

describe('isTokenExpiringSoon', () => {
  it('retorna true quando token expira em menos de 60 segundos', () => {
    const token = makeJwtWithExp(30)
    expect(isTokenExpiringSoon(token)).toBe(true)
  })

  it('retorna false quando token expira em mais de 60 segundos', () => {
    const token = makeJwtWithExp(300)
    expect(isTokenExpiringSoon(token)).toBe(false)
  })

  it('retorna true quando token já expirou', () => {
    const token = makeJwtWithExp(-60)
    expect(isTokenExpiringSoon(token)).toBe(true)
  })
})

describe('useAuthInterceptor - tryRefresh', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  function makeWrapper(token: string | null) {
    // Seed localStorage so AuthProvider can load it
    if (token) {
      localStorage.setItem('gk_access_token', token)
      localStorage.setItem('gk_refresh_token', 'refresh_abc')
      localStorage.setItem('gk_session_id', 'session_789')
      localStorage.setItem('gk_org_id', 'org_456')
    }
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(AuthProvider, null, children)
  }

  it('chama authService.refresh() quando token está prestes a expirar', async () => {
    const expiringToken = makeJwtWithExp(30)
    const storedTokens = {
      accessToken: expiringToken,
      refreshToken: 'refresh_abc',
      sessionId: 'session_789',
      orgId: 'org_456',
    }
    vi.mocked(authService.getStoredTokens).mockReturnValue(storedTokens)

    const newToken = makeJwtWithExp(3600)
    vi.mocked(authService.refresh).mockResolvedValue({
      accessToken: newToken,
      refreshToken: 'new_refresh',
      sessionId: 'new_session',
      orgId: 'org_456',
    })

    const { result } = renderHook(() => useAuthInterceptor(), {
      wrapper: makeWrapper(expiringToken),
    })

    await act(async () => {
      await result.current.tryRefresh()
    })

    expect(authService.refresh).toHaveBeenCalledWith('session_789', 'refresh_abc', 'org_456')
  })

  it('não chama refresh() quando token ainda tem mais de 60 segundos', async () => {
    const freshToken = makeJwtWithExp(3600)

    const { result } = renderHook(() => useAuthInterceptor(), {
      wrapper: makeWrapper(freshToken),
    })

    await act(async () => {
      await result.current.tryRefresh()
    })

    expect(authService.refresh).not.toHaveBeenCalled()
  })

  it('limpa localStorage quando refresh falha com AuthError', async () => {
    const expiringToken = makeJwtWithExp(30)
    const storedTokens = {
      accessToken: expiringToken,
      refreshToken: 'refresh_abc',
      sessionId: 'session_789',
      orgId: 'org_456',
    }
    vi.mocked(authService.getStoredTokens).mockReturnValue(storedTokens)
    vi.mocked(authService.refresh).mockRejectedValue(new AuthError('refresh_failed'))

    const { result } = renderHook(() => useAuthInterceptor(), {
      wrapper: makeWrapper(expiringToken),
    })

    await act(async () => {
      await result.current.tryRefresh()
    })

    expect(localStorage.getItem('gk_access_token')).toBeNull()
  })

  it('não chama refresh() quando não há token no contexto', async () => {
    const { result } = renderHook(() => useAuthInterceptor(), {
      wrapper: makeWrapper(null),
    })

    await act(async () => {
      await result.current.tryRefresh()
    })

    expect(authService.refresh).not.toHaveBeenCalled()
  })
})

describe('useAuthInterceptor - onRefreshFailed race condition', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('preserva tokens do novo login quando refresh antigo falha com sessionId diferente', async () => {
    // session_old estava no localStorage quando o refresh foi disparado
    vi.mocked(authService.getStoredTokens)
      .mockReturnValueOnce({
        // primeira chamada: dentro de refreshToken() captura session_old
        accessToken: makeJwtWithExp(-60),
        refreshToken: 'refresh_old',
        sessionId: 'session_old',
        orgId: 'org_1',
      })
      .mockReturnValue({
        // chamadas subsequentes: usuário já fez login, session_new no localStorage
        accessToken: makeJwtWithExp(3600),
        refreshToken: 'refresh_new',
        sessionId: 'session_new',
        orgId: 'org_1',
      })

    vi.mocked(authService.refresh).mockRejectedValue(new Error('expired'))

    // Semente: novo login já salvou tokens frescos (JWT válido não expirado)
    const freshToken = makeJwtWithExp(3600)
    localStorage.setItem('gk_access_token', freshToken)
    localStorage.setItem('gk_refresh_token', 'refresh_new')
    localStorage.setItem('gk_session_id', 'session_new')
    localStorage.setItem('gk_org_id', 'org_1')

    renderHook(() => useAuthInterceptor(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(AuthProvider, null, children),
    })

    // refreshToken() usa session_old → falha → onRefreshFailed('session_old')
    // mas localStorage agora tem session_new → clearAuth() NÃO deve ser chamado
    const { refreshToken } = await import('../lib/token-refresh')
    await act(async () => {
      await refreshToken()
    })

    expect(localStorage.getItem('gk_session_id')).toBe('session_new')
    expect(localStorage.getItem('gk_access_token')).toBe(freshToken)
  })
})
