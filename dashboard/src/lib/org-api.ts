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

export interface UserSummary {
  _id: string
  email: string
  status: 'active' | 'suspended' | 'deleted'
  loginAttempts: number
  updatedAt: number
  orgRole: string
  orgStatus: string
}

export function listUsers(token: string): Promise<UserSummary[]> {
  return apiFetch<UserSummary[]>('/v1/users', token)
}

export function createUser(
  token: string,
  data: { email: string; password: string; role: string },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/v1/users', token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function suspendUser(token: string, userId: string): Promise<void> {
  return apiFetch<void>(`/v1/users/${userId}`, token, { method: 'DELETE' })
}

export function reactivateUser(token: string, userId: string): Promise<void> {
  return apiFetch<void>(`/v1/users/${userId}/reactivate`, token, { method: 'POST' })
}

export function removeUserFromOrg(
  token: string,
  userId: string,
): Promise<{ workspacesAffected: number; bindingsRevoked: number }> {
  return apiFetch<{ workspacesAffected: number; bindingsRevoked: number }>(
    `/v1/users/${userId}/org-membership`,
    token,
    { method: 'DELETE' },
  )
}

export function resetUserPassword(token: string, userId: string, newPassword: string): Promise<void> {
  return apiFetch<void>(`/v1/users/${userId}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ password: newPassword }),
  })
}

export interface WorkspaceSummary {
  _id: string
  name: string
  status: string
  membersCount: number
  createdAt: number
}

export function listWorkspaces(token: string): Promise<WorkspaceSummary[]> {
  return apiFetch<WorkspaceSummary[]>('/v1/workspaces', token)
}

export function createWorkspace(token: string, data: { name: string }): Promise<{ workspaceId: string }> {
  return apiFetch<{ workspaceId: string }>('/v1/workspaces', token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
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

export interface CapabilityUsageRole {
  roleId: string
  roleName: string
  workspaceId?: string
}

export function getCapabilityUsage(
  token: string,
  capabilityId: string,
): Promise<{ roles: CapabilityUsageRole[] }> {
  return apiFetch<{ roles: CapabilityUsageRole[] }>(
    `/v1/capabilities/${capabilityId}/usage`,
    token,
  )
}

export function deleteCapability(token: string, capabilityId: string): Promise<void> {
  return apiFetch<void>(`/v1/capabilities/${capabilityId}`, token, { method: 'DELETE' })
}

export interface ApiKeySummary {
  _id: string
  publicId: string
  scopes: string[]
  description?: string
  lastUsedAt?: number
  status: 'active' | 'revoked'
}

export interface ApiKeyCreated {
  publicId: string
  secret: string
  keyId: string
  scopes: string[]
  description: string
}

export function listApiKeys(token: string): Promise<ApiKeySummary[]> {
  return apiFetch<ApiKeySummary[]>('/v1/api-keys', token)
}

export function createApiKey(
  token: string,
  data: { scopes: string[]; description: string },
): Promise<ApiKeyCreated> {
  return apiFetch<ApiKeyCreated>('/v1/api-keys', token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function revokeApiKey(token: string, keyId: string): Promise<void> {
  return apiFetch<void>(`/v1/api-keys/${keyId}`, token, { method: 'DELETE' })
}

export interface AuditEvent {
  _id: string
  timestamp: number
  actorType: string
  actorId: string
  actorRole?: string
  action: string
  target: { type: string; id?: string }
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

export function getUserAccessHistory(
  token: string,
  userId: string,
  params: {
    action?: string
    result?: 'allow' | 'deny'
    from?: number
    to?: number
    cursor?: string
    numItems?: number
  } = {},
): Promise<AuditLogPage> {
  const qs = new URLSearchParams({ userId })
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) qs.set(k, String(v))
  })
  return apiFetch<AuditLogPage>(`/v1/audit-log?${qs}`, token)
}

export interface OrgSettings {
  quotas: Record<string, number>
  loginMethods: string[]
  mfaRequired: boolean
  jwtExpiryAccess: number
  jwtExpiryRefresh: number
  rateLimits?: { checkPerMin?: number; checkBatchPerMin?: number }
}

export function getOrgSettings(token: string, orgId: string): Promise<OrgSettings> {
  return apiFetch<OrgSettings>(`/v1/orgs/${orgId}/settings`, token)
}

export function updateOrgSettings(
  token: string,
  orgId: string,
  data: Partial<{
    quotas: Record<string, number>
    loginMethods: string[]
    mfaRequired: boolean
    jwtExpiryAccess: number
    jwtExpiryRefresh: number
    rateLimits: { checkPerMin?: number; checkBatchPerMin?: number }
  }>,
): Promise<void> {
  return apiFetch<void>(`/v1/orgs/${orgId}/settings`, token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}
