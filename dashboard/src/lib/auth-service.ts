const CONVEX_URL = (import.meta.env.VITE_CONVEX_SITE_URL ?? import.meta.env.VITE_CONVEX_URL) as string

const STORAGE_KEYS = {
  accessToken: 'gk_access_token',
  refreshToken: 'gk_refresh_token',
  sessionId: 'gk_session_id',
  orgId: 'gk_org_id',
} as const

export interface TokenPayload {
  sub: string
  orgId: string
  sessionId: string
  workspaceIds: string[]
  roles: Record<string, string>
  capabilities: string[]
  exp: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  sessionId: string
}

export class AuthError extends Error {
  readonly reason: string
  readonly lockedUntil?: number

  constructor(reason: string, lockedUntil?: number) {
    super(reason)
    this.name = 'AuthError'
    this.reason = reason
    this.lockedUntil = lockedUntil
  }
}

function saveTokens(tokens: AuthTokens, orgId: string) {
  localStorage.setItem(STORAGE_KEYS.accessToken, tokens.accessToken)
  localStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refreshToken)
  localStorage.setItem(STORAGE_KEYS.sessionId, tokens.sessionId)
  localStorage.setItem(STORAGE_KEYS.orgId, orgId)
}

function clearTokens() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key))
}

export function getStoredTokens(): (AuthTokens & { orgId: string }) | null {
  const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken)
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken)
  const sessionId = localStorage.getItem(STORAGE_KEYS.sessionId)
  const orgId = localStorage.getItem(STORAGE_KEYS.orgId)

  if (!accessToken || !refreshToken || !sessionId || orgId === null) return null

  return { accessToken, refreshToken, sessionId, orgId }
}

function base64urlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
  return atob(padded)
}

export function parseJwtPayload(token: string): TokenPayload {
  const [, payload] = token.split('.')
  return JSON.parse(base64urlDecode(payload)) as TokenPayload
}

async function login(email: string, password: string): Promise<AuthTokens & { orgId: string }> {
  const res = await fetch(`${CONVEX_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (res.status === 401) {
    throw new AuthError('invalid_credentials')
  }

  if (res.status === 429) {
    const data = await res.json() as { error: string; lockedUntil?: number }
    if (data.error === 'account_locked') {
      throw new AuthError('account_locked', data.lockedUntil)
    }
    throw new AuthError('rate_limit_exceeded')
  }

  if (!res.ok) {
    throw new AuthError('unknown_error')
  }

  const tokens = await res.json() as AuthTokens
  const { orgId } = parseJwtPayload(tokens.accessToken)

  saveTokens(tokens, orgId)

  return { ...tokens, orgId }
}

async function logout(accessToken: string): Promise<void> {
  try {
    await fetch(`${CONVEX_URL}/v1/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } finally {
    clearTokens()
  }
}

async function refresh(sessionId: string, refreshToken: string, orgId: string): Promise<AuthTokens & { orgId: string }> {
  const res = await fetch(`${CONVEX_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, refreshToken, orgId }),
  })

  if (!res.ok) {
    throw new AuthError('refresh_failed')
  }

  const tokens = await res.json() as AuthTokens
  saveTokens(tokens, orgId)

  return { ...tokens, orgId }
}

export const authService = { login, logout, refresh, getStoredTokens, clearTokens }
