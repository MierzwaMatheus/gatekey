// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, renderHook } from '@testing-library/react'
import React from 'react'
import { AuthProvider, useAuth } from '../lib/auth-context'
import { useImpersonationExpiry } from '../lib/use-impersonation-expiry'
import type { ImpersonationSession } from '../lib/auth-context'

vi.mock('../lib/use-auth-interceptor', () => ({
  useAuthInterceptor: () => ({}),
}))

const ROOT_TOKEN = 'root_token'

const ACTIVE_SESSION: ImpersonationSession = {
  token: 'imp_token_active',
  targetUser: { id: 'user_1', name: 'Ana' },
  expiresAt: Date.now() + 3600000,
  sessionId: 'sess_1',
}

const EXPIRED_SESSION: ImpersonationSession = {
  token: 'imp_token_expired',
  targetUser: { id: 'user_1', name: 'Ana' },
  expiresAt: Date.now() - 1000,
  sessionId: 'sess_expired',
}

describe('useImpersonationExpiry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('não chama endImpersonation quando sessão ainda é válida', async () => {
    const endImpersonation = vi.fn()

    function TestComponent() {
      useImpersonationExpiry({ impersonationSession: ACTIVE_SESSION, endImpersonation })
      return null
    }

    render(
      <AuthProvider initialState={{ token: ROOT_TOKEN, role: 'root', orgId: null, impersonationSession: ACTIVE_SESSION }}>
        <TestComponent />
      </AuthProvider>
    )

    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })

    expect(endImpersonation).not.toHaveBeenCalled()
  })

  it('chama endImpersonation quando sessão expirou', async () => {
    const endImpersonation = vi.fn().mockResolvedValue(undefined)

    function TestComponent() {
      useImpersonationExpiry({ impersonationSession: EXPIRED_SESSION, endImpersonation })
      return null
    }

    render(
      <AuthProvider initialState={{ token: ROOT_TOKEN, role: 'root', orgId: null, impersonationSession: EXPIRED_SESSION }}>
        <TestComponent />
      </AuthProvider>
    )

    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })

    expect(endImpersonation).toHaveBeenCalledOnce()
  })

  it('não faz nada quando impersonationSession é null', async () => {
    const endImpersonation = vi.fn()

    function TestComponent() {
      useImpersonationExpiry({ impersonationSession: null, endImpersonation })
      return null
    }

    render(
      <AuthProvider initialState={{ token: ROOT_TOKEN, role: 'root', orgId: null, impersonationSession: null }}>
        <TestComponent />
      </AuthProvider>
    )

    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })

    expect(endImpersonation).not.toHaveBeenCalled()
  })
})

describe('getActiveToken — seleção do token ativo', () => {
  it('retorna o impersonation token quando sessão está ativa', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(AuthProvider, {
          initialState: {
            token: ROOT_TOKEN,
            role: 'root',
            orgId: null,
            impersonationSession: ACTIVE_SESSION,
          },
        }, children),
    })
    expect(result.current.getActiveToken()).toBe(ACTIVE_SESSION.token)
  })

  it('retorna o root token quando não há impersonation ativa', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(AuthProvider, {
          initialState: {
            token: ROOT_TOKEN,
            role: 'root',
            orgId: null,
            impersonationSession: null,
          },
        }, children),
    })
    expect(result.current.getActiveToken()).toBe(ROOT_TOKEN)
  })
})

describe('token de impersonation usado nos headers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([]),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('startImpersonation faz chamada POST /v1/impersonation/start com token raiz no header', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          impersonationToken: 'imp_tok',
          expiresAt: Date.now() + 3600000,
          sessionId: 'sess_1',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ _id: 'user_1', name: 'Ana', email: 'ana@test.com' }),
      } as Response)

    const { useAuth } = await import('../lib/auth-context')

    function TestComponent() {
      const { startImpersonation } = useAuth()
      return (
        <button onClick={() => void startImpersonation('user_1')}>start</button>
      )
    }

    const { getByRole } = render(
      <AuthProvider initialState={{ token: ROOT_TOKEN, role: 'root', orgId: null, impersonationSession: null }}>
        <TestComponent />
      </AuthProvider>
    )

    await act(async () => {
      getByRole('button').click()
    })

    const [startCall] = vi.mocked(fetch).mock.calls
    const [, startOptions] = startCall
    expect((startOptions as RequestInit).headers).toMatchObject({
      Authorization: `Bearer ${ROOT_TOKEN}`,
    })
    expect(JSON.parse((startOptions as RequestInit).body as string)).toMatchObject({
      targetUserId: 'user_1',
    })
  })
})
