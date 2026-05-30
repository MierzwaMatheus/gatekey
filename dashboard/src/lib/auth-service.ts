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
  mustChangePassword?: boolean
}

export interface MfaRequired {
  mfa_required: true
  mfa_token: string
}

export interface MfaSetupRequired {
  mfa_setup_required: true
  mfa_setup_token: string
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

type LoginResult =
  | (AuthTokens & { orgId: string; mustChangePassword: boolean })
  | MfaRequired
  | MfaSetupRequired

async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${CONVEX_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (res.status === 401) {
    const data = await res.json() as { error?: string }
    throw new AuthError(data.error ?? 'invalid_credentials')
  }

  if (res.status === 429) {
    const data = await res.json() as { error: string; lockedUntil?: number }
    if (data.error === 'account_locked') {
      throw new AuthError('account_locked', data.lockedUntil)
    }
    throw new AuthError('rate_limit_exceeded')
  }

  if (res.status === 403) {
    const data = await res.json() as { error: string }
    throw new AuthError(data.error)
  }

  if (!res.ok) {
    throw new AuthError('unknown_error')
  }

  const data = await res.json() as LoginResult & { mfa_required?: boolean; mfa_setup_required?: boolean }

  if (data.mfa_required) return data as MfaRequired
  if (data.mfa_setup_required) return data as MfaSetupRequired

  const tokens = data as AuthTokens & { mustChangePassword?: boolean }
  const { orgId } = parseJwtPayload(tokens.accessToken)
  saveTokens(tokens, orgId)
  return { ...tokens, orgId, mustChangePassword: tokens.mustChangePassword ?? false }
}

async function challengeMfa(mfaToken: string, totpCode: string): Promise<AuthTokens & { orgId: string }> {
  const res = await fetch(`${CONVEX_URL}/v1/auth/mfa/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mfaToken, totpCode }),
  })
  if (!res.ok) {
    const data = await res.json() as { error?: string }
    throw new AuthError(data.error ?? 'mfa_failed')
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
  return { ...tokens, orgId }
}

async function requestMagicLink(email: string): Promise<void> {
  const res = await fetch(`${CONVEX_URL}/v1/auth/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (res.status === 403) throw new AuthError('method_disabled')
  if (!res.ok) throw new AuthError('unknown_error')
}

type MagicLinkVerifyResult =
  | (AuthTokens & { orgId: string })
  | MfaRequired
  | MfaSetupRequired

async function verifyMagicLink(token: string): Promise<MagicLinkVerifyResult> {
  const res = await fetch(`${CONVEX_URL}/v1/auth/magic-link/verify?token=${encodeURIComponent(token)}`)

  if (res.status === 401) throw new AuthError('invalid_or_expired')
  if (res.status === 403) {
    const data = await res.json() as { error: string }
    throw new AuthError(data.error)
  }
  if (!res.ok) throw new AuthError('unknown_error')

  const data = await res.json() as MagicLinkVerifyResult & { mfa_required?: boolean; mfa_setup_required?: boolean }

  if (data.mfa_required) return data as MfaRequired
  if (data.mfa_setup_required) return data as MfaSetupRequired

  const tokens = data as AuthTokens
  const { orgId } = parseJwtPayload(tokens.accessToken)
  saveTokens(tokens, orgId)
  return { ...tokens, orgId }
}

async function setupMfa(mfaSetupToken: string): Promise<{ secret: string; qrCodeUrl: string }> {
  const res = await fetch(`${CONVEX_URL}/v1/auth/mfa/setup`, {
    method: 'POST',
    headers: { Authorization: `MfaSetup ${mfaSetupToken}` },
  })
  if (!res.ok) throw new AuthError('setup_failed')
  return res.json() as Promise<{ secret: string; qrCodeUrl: string }>
}

async function verifyMfaSetup(mfaSetupToken: string, totpCode: string): Promise<{ backupCodes: string[] }> {
  const res = await fetch(`${CONVEX_URL}/v1/auth/mfa/verify-setup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `MfaSetup ${mfaSetupToken}`,
    },
    body: JSON.stringify({ totpCode }),
  })
  if (!res.ok) {
    const data = await res.json() as { error?: string }
    throw new AuthError(data.error ?? 'invalid_code')
  }
  return res.json() as Promise<{ backupCodes: string[] }>
}

export const authService = { login, logout, refresh, getStoredTokens, clearTokens, saveTokens, requestMagicLink, verifyMagicLink, challengeMfa, setupMfa, verifyMfaSetup }
