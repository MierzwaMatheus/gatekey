import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const MOCK_CONVEX_URL = 'https://test.convex.cloud'

vi.stubEnv('VITE_CONVEX_URL', MOCK_CONVEX_URL)

// JWT payload com orgId para parsear
const MOCK_ACCESS_TOKEN = [
  'header',
  btoa(JSON.stringify({
    sub: 'user_123',
    orgId: 'org_456',
    sessionId: 'session_789',
    workspaceIds: ['ws_1'],
    roles: { ws_1: 'admin' },
    capabilities: ['document:read'],
    exp: Math.floor(Date.now() / 1000) + 3600,
  })),
  'signature',
].join('.')

const MOCK_TOKENS = {
  accessToken: MOCK_ACCESS_TOKEN,
  refreshToken: 'refresh_abc',
  sessionId: 'session_789',
}

describe('authService', () => {
  let authService: typeof import('../lib/auth-service').authService
  let AuthError: typeof import('../lib/auth-service').AuthError

  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    global.fetch = vi.fn()
    const mod = await import('../lib/auth-service')
    authService = mod.authService
    AuthError = mod.AuthError
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('login()', () => {
    it('faz fetch para /v1/auth/login com email e password', async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        new Response(JSON.stringify(MOCK_TOKENS), { status: 200 })
      )

      await authService.login('user@example.com', 'senha123')

      expect(global.fetch).toHaveBeenCalledWith(
        `${MOCK_CONVEX_URL}/v1/auth/login`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'user@example.com', password: 'senha123' }),
        })
      )
    })

    it('salva accessToken no localStorage após login bem-sucedido', async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        new Response(JSON.stringify(MOCK_TOKENS), { status: 200 })
      )

      await authService.login('user@example.com', 'senha123')

      expect(localStorage.getItem('gk_access_token')).toBe(MOCK_ACCESS_TOKEN)
    })

    it('salva refreshToken no localStorage após login bem-sucedido', async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        new Response(JSON.stringify(MOCK_TOKENS), { status: 200 })
      )

      await authService.login('user@example.com', 'senha123')

      expect(localStorage.getItem('gk_refresh_token')).toBe('refresh_abc')
    })

    it('salva sessionId no localStorage após login bem-sucedido', async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        new Response(JSON.stringify(MOCK_TOKENS), { status: 200 })
      )

      await authService.login('user@example.com', 'senha123')

      expect(localStorage.getItem('gk_session_id')).toBe('session_789')
    })

    it('retorna tokens e orgId extraído do JWT em sucesso', async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        new Response(JSON.stringify(MOCK_TOKENS), { status: 200 })
      )

      const result = await authService.login('user@example.com', 'senha123')

      expect(result.accessToken).toBe(MOCK_ACCESS_TOKEN)
      expect(result.refreshToken).toBe('refresh_abc')
      expect(result.orgId).toBe('org_456')
    })

    it('lança AuthError com reason=invalid_credentials em resposta 401', async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        new Response(JSON.stringify({ error: 'invalid_credentials' }), { status: 401 })
      )

      await expect(authService.login('user@example.com', 'errada')).rejects.toMatchObject({
        name: 'AuthError',
        reason: 'invalid_credentials',
      })
    })

    it('lança AuthError com reason=account_locked e lockedUntil em resposta 429 account_locked', async () => {
      const lockedUntil = Date.now() + 900_000
      vi.mocked(global.fetch).mockResolvedValue(
        new Response(JSON.stringify({ error: 'account_locked', lockedUntil }), { status: 429 })
      )

      await expect(authService.login('user@example.com', 'errada')).rejects.toMatchObject({
        name: 'AuthError',
        reason: 'account_locked',
        lockedUntil,
      })
    })
  })

  describe('logout()', () => {
    it('faz fetch para /v1/auth/logout com Authorization header', async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )

      await authService.logout('my_access_token')

      expect(global.fetch).toHaveBeenCalledWith(
        `${MOCK_CONVEX_URL}/v1/auth/logout`,
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer my_access_token' },
        })
      )
    })

    it('limpa localStorage após logout', async () => {
      localStorage.setItem('gk_access_token', 'token')
      localStorage.setItem('gk_refresh_token', 'refresh')
      localStorage.setItem('gk_session_id', 'session')
      localStorage.setItem('gk_org_id', 'org')

      vi.mocked(global.fetch).mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )

      await authService.logout('my_access_token')

      expect(localStorage.getItem('gk_access_token')).toBeNull()
      expect(localStorage.getItem('gk_refresh_token')).toBeNull()
      expect(localStorage.getItem('gk_session_id')).toBeNull()
    })

    it('limpa localStorage mesmo se a requisição de logout falhar', async () => {
      localStorage.setItem('gk_access_token', 'token')
      vi.mocked(global.fetch).mockRejectedValue(new Error('network error'))

      await authService.logout('my_access_token').catch(() => {})

      expect(localStorage.getItem('gk_access_token')).toBeNull()
    })
  })

  describe('refresh()', () => {
    it('faz POST /v1/auth/refresh com sessionId, refreshToken e orgId', async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        new Response(JSON.stringify(MOCK_TOKENS), { status: 200 })
      )

      await authService.refresh('session_789', 'refresh_abc', 'org_456')

      expect(global.fetch).toHaveBeenCalledWith(
        `${MOCK_CONVEX_URL}/v1/auth/refresh`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sessionId: 'session_789', refreshToken: 'refresh_abc', orgId: 'org_456' }),
        })
      )
    })

    it('salva novos tokens no localStorage após refresh', async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        new Response(JSON.stringify(MOCK_TOKENS), { status: 200 })
      )

      await authService.refresh('session_789', 'refresh_abc', 'org_456')

      expect(localStorage.getItem('gk_access_token')).toBe(MOCK_ACCESS_TOKEN)
    })

    it('lança AuthError quando refresh retorna erro', async () => {
      vi.mocked(global.fetch).mockResolvedValue(
        new Response(JSON.stringify({ error: 'session_revoked' }), { status: 401 })
      )

      await expect(authService.refresh('session_789', 'refresh_abc', 'org_456')).rejects.toMatchObject({
        name: 'AuthError',
      })
    })
  })

  describe('getStoredTokens()', () => {
    it('retorna null quando não há tokens no localStorage', () => {
      const result = authService.getStoredTokens()
      expect(result).toBeNull()
    })

    it('retorna tokens quando todos estão presentes no localStorage', () => {
      localStorage.setItem('gk_access_token', 'access')
      localStorage.setItem('gk_refresh_token', 'refresh')
      localStorage.setItem('gk_session_id', 'session')
      localStorage.setItem('gk_org_id', 'org')

      const result = authService.getStoredTokens()

      expect(result).toEqual({
        accessToken: 'access',
        refreshToken: 'refresh',
        sessionId: 'session',
        orgId: 'org',
      })
    })
  })
})
