const BASE_URL = (import.meta.env.VITE_CONVEX_SITE_URL ?? import.meta.env.VITE_CONVEX_URL) as string

async function apiFetch<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'unknown' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export interface OrgSummary {
  _id: string
  name: string
  status: 'active' | 'suspended' | 'deleted'
  usersCount: number
  workspacesCount: number
  updatedAt: number
}

export function listOrgs(token: string): Promise<OrgSummary[]> {
  return apiFetch<OrgSummary[]>('/v1/orgs', token)
}

export interface SessionSummary {
  _id: string
  userId: string
  orgId: string
  deviceInfo?: string
  ip?: string
  expiresAt: number
  createdAt: number
}

export function listSessions(token: string, userId?: string): Promise<SessionSummary[]> {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : ''
  return apiFetch<SessionSummary[]>(`/v1/sessions${qs}`, token)
}

export function revokeSession(token: string, sessionId: string): Promise<void> {
  return apiFetch<void>(`/v1/sessions/${sessionId}`, token, { method: 'DELETE' })
}

export interface AuditEvent {
  _id: string
  timestamp: number
  actorType: string
  actorId: string
  actorRole?: string
  action: string
  target: { type: string; id: string }
  orgId?: string
  workspaceId?: string
  result: 'allow' | 'deny'
  reason?: string
}

export interface AuditLogPage {
  logs: AuditEvent[]
  isDone: boolean
  cursor: string | null
}

export function listAuditLog(
  token: string,
  params: {
    orgId?: string
    workspaceId?: string
    action?: string
    result?: 'allow' | 'deny'
    from?: number
    to?: number
    cursor?: string
    numItems?: number
  } = {},
): Promise<AuditLogPage> {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) qs.set(k, String(v))
  })
  const query = qs.toString() ? `?${qs}` : ''
  return apiFetch<AuditLogPage>(`/v1/audit-log${query}`, token)
}

export interface Capability {
  _id: string
  name: string
  description: string
  isBase: boolean
  orgId?: string
}

export function listCapabilities(token: string): Promise<{ capabilities: Capability[] }> {
  return apiFetch<{ capabilities: Capability[] }>('/v1/capabilities', token)
}

export function createCapability(
  token: string,
  data: { name: string; description: string },
): Promise<Capability> {
  return apiFetch<Capability>('/v1/capabilities', token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export interface ApiKeySummary {
  _id: string
  publicId: string
  scopes: string[]
  description?: string
  lastUsedAt?: number
  status: 'active' | 'revoked'
}

export function listApiKeys(token: string): Promise<ApiKeySummary[]> {
  return apiFetch<ApiKeySummary[]>('/v1/api-keys', token)
}

export interface OrgQuotas {
  users_per_org: number
  workspaces_per_org: number
  users_per_workspace: number
  capabilities_per_org: number
  roles_per_workspace: number
  sessions_per_user: number
  api_keys_per_org: number
}

export function getOrgSettings(token: string, orgId: string): Promise<{ quotas: OrgQuotas }> {
  return apiFetch<{ quotas: OrgQuotas }>(`/v1/orgs/${orgId}/settings`, token)
}

export function updateOrgQuotas(token: string, orgId: string, quotas: Partial<OrgQuotas>): Promise<void> {
  return apiFetch<void>(`/v1/orgs/${orgId}/settings`, token, {
    method: 'PATCH',
    body: JSON.stringify({ quotas }),
  })
}

export async function createOrg(token: string, data: { name: string; adminEmail: string }): Promise<{ orgId: string; adminTempPassword: string | null }> {
  const result = await apiFetch<{ orgId: string; adminTempPassword: string | null }>('/v1/orgs', token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  console.log('[createOrg] resposta da API:', result)
  return result
}

export function suspendOrg(token: string, orgId: string): Promise<void> {
  return apiFetch<void>(`/v1/orgs/${orgId}/suspend`, token, { method: 'POST' })
}

export function deleteOrg(token: string, orgId: string): Promise<void> {
  return apiFetch<void>(`/v1/orgs/${orgId}`, token, { method: 'DELETE' })
}

export interface StartImpersonationResult {
  impersonationToken: string
  expiresAt: number
  sessionId: string
}

export function startImpersonation(
  token: string,
  targetUserId: string,
): Promise<StartImpersonationResult> {
  return apiFetch<StartImpersonationResult>('/v1/impersonation/start', token, {
    method: 'POST',
    body: JSON.stringify({ targetUserId }),
  })
}

export function endImpersonation(token: string, sessionId: string): Promise<void> {
  return apiFetch<void>('/v1/impersonation/end', token, {
    method: 'POST',
    body: JSON.stringify({ impersonationSessionId: sessionId }),
  })
}

export interface UserBasic {
  _id: string
  name?: string
  email: string
}

export function getUser(token: string, userId: string): Promise<UserBasic> {
  return apiFetch<UserBasic>(`/v1/users/${userId}`, token)
}

export interface GlobalRateLimitSettings {
  checkPerMin: number
  checkBatchPerMin: number
}

export function getGlobalRateLimits(token: string): Promise<GlobalRateLimitSettings> {
  return apiFetch<GlobalRateLimitSettings>('/v1/global-settings/rate-limits', token)
}

export function updateGlobalRateLimits(
  token: string,
  data: Partial<GlobalRateLimitSettings>,
): Promise<void> {
  return apiFetch<void>('/v1/global-settings/rate-limits', token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export interface RotateKeyResult {
  rotatedAt: number
  newKeyId: string
  previousKeyId?: string
  previousKeyExpiresAt: number
}

export function rotateKey(token: string): Promise<RotateKeyResult> {
  return apiFetch<RotateKeyResult>('/v1/auth/rotate-key', token, { method: 'POST' })
}

// ── Fase 11.1: Gestão global de usuários ─────────────────────────────────────

export interface GlobalUserSummary {
  _id: string
  email: string
  status: 'active' | 'suspended'
  orgId: string
  orgRole: string
  _creationTime: number
  updatedAt: number
  isRoot?: boolean
}

export interface GlobalUsersPage {
  users: GlobalUserSummary[]
  nextCursor: string | null
  isDone: boolean
}

export interface GlobalUsersFilters {
  orgId?: string
  status?: string
  from?: number
  to?: number
  cursor?: string
  limit?: number
}

export function listAllUsers(token: string, filters?: GlobalUsersFilters): Promise<GlobalUsersPage> {
  const params = new URLSearchParams()
  if (filters?.orgId) params.set('orgId', filters.orgId)
  if (filters?.status) params.set('status', filters.status)
  if (filters?.from !== undefined) params.set('from', String(filters.from))
  if (filters?.to !== undefined) params.set('to', String(filters.to))
  if (filters?.cursor) params.set('cursor', filters.cursor)
  if (filters?.limit !== undefined) params.set('limit', String(filters.limit))
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiFetch<GlobalUsersPage>(`/v1/users/global${qs}`, token)
}

export function suspendUserGlobal(token: string, userId: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/v1/users/${userId}/suspend-global`, token, {
    method: 'POST',
  })
}

export function revokeAllUserSessions(
  token: string,
  userId: string,
): Promise<{ sessionsRevoked: number }> {
  return apiFetch<{ sessionsRevoked: number }>(`/v1/users/${userId}/sessions`, token, {
    method: 'DELETE',
  })
}
