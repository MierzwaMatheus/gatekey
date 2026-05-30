// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authService } from '../lib/auth-service'
import {
  refreshToken,
  registerRefreshCallback,
  registerRefreshFailedCallback,
  unregisterRefreshCallback,
} from '../lib/token-refresh'

vi.mock('../lib/auth-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/auth-service')>()
  return {
    ...actual,
    authService: {
      refresh: vi.fn(),
      getStoredTokens: vi.fn(),
    },
  }
})

function makeJwtWithExp(expOffsetSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds
  const payload = btoa(JSON.stringify({ sub: 'u', orgId: 'o', sessionId: 's', exp }))
  return `header.${payload}.sig`
}

describe('refreshToken - onRefreshFailed', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    unregisterRefreshCallback()
  })

  it('chama onRefreshFailed com o sessionId que estava sendo renovado', async () => {
    vi.mocked(authService.getStoredTokens).mockReturnValue({
      accessToken: makeJwtWithExp(-60),
      refreshToken: 'ref_old',
      sessionId: 'session_old',
      orgId: 'org_1',
    })
    vi.mocked(authService.refresh).mockRejectedValue(new Error('expired'))

    const onFailed = vi.fn()
    registerRefreshFailedCallback(onFailed)

    await refreshToken()

    expect(onFailed).toHaveBeenCalledWith('session_old')
  })

  it('chama onRefreshed com o novo token quando refresh tem sucesso', async () => {
    const newToken = makeJwtWithExp(3600)
    vi.mocked(authService.getStoredTokens).mockReturnValue({
      accessToken: makeJwtWithExp(-60),
      refreshToken: 'ref_old',
      sessionId: 'session_old',
      orgId: 'org_1',
    })
    vi.mocked(authService.refresh).mockResolvedValue({
      accessToken: newToken,
      refreshToken: 'ref_new',
      sessionId: 'session_new',
      orgId: 'org_1',
    })

    const onRefreshed = vi.fn()
    registerRefreshCallback(onRefreshed)

    await refreshToken()

    expect(onRefreshed).toHaveBeenCalledWith(newToken, 'org_1', 'org_admin')
  })
})
