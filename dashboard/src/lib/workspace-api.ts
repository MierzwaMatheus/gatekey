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

export interface WorkspaceMember {
  userId: string
  userName: string
  userEmail: string
  roleName: string
  addedAt: number
}

export function listMembers(token: string, wsId: string): Promise<WorkspaceMember[]> {
  return apiFetch<WorkspaceMember[]>(`/v1/workspaces/${wsId}/members`, token)
}

export function addMember(token: string, wsId: string, data: { userId: string; roleId?: string }): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/v1/workspaces/${wsId}/members`, token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function removeMember(token: string, wsId: string, userId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/v1/workspaces/${wsId}/members/${userId}`, token, {
    method: 'DELETE',
  })
}

export function changeMemberRole(token: string, wsId: string, userId: string, newRoleId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/v1/workspaces/${wsId}/members/${userId}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ newRoleId }),
  })
}

export interface WorkspaceRole {
  _id: string
  name: string
  isBase: boolean
  capabilities: string[]
}

export function listRoles(token: string, wsId: string): Promise<WorkspaceRole[]> {
  return apiFetch<WorkspaceRole[]>(`/v1/roles?workspaceId=${wsId}`, token)
}

export function createRole(token: string, data: { name: string; workspaceId: string }): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/v1/roles', token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteRole(token: string, roleId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/v1/roles/${roleId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'unknown' }))
    if (err.error === 'RoleInUse' && Array.isArray(err.usedBy)) {
      const emails = (err.usedBy as Array<{ userEmail: string }>).map((u) => u.userEmail)
      throw new Error(`RoleInUse:${emails.join(',')}`)
    }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
}

export function duplicateRole(
  token: string,
  roleId: string,
  workspaceId: string,
): Promise<{ id: string; name: string; isBase: boolean; capabilities: string[] }> {
  return apiFetch(`/v1/roles/${roleId}/duplicate?workspaceId=${workspaceId}`, token, { method: 'POST' })
}

export interface WorkspaceCapability {
  _id: string
  name: string
  description: string
  isBase: boolean
}

export function listCapabilities(token: string): Promise<{ capabilities: WorkspaceCapability[] }> {
  return apiFetch<{ capabilities: WorkspaceCapability[] }>('/v1/capabilities', token)
}

export interface WorkspaceBinding {
  _id: string
  userId: string
  roleId: string
  roleName?: string
  resourceType: string
  resourceId?: string
  workspaceId: string
  type?: 'allow' | 'deny'
  reason?: string
  deniedBy?: string
}

export function listBindings(token: string, wsId: string, filters?: { userId?: string; resourceType?: string }): Promise<WorkspaceBinding[]> {
  const qs = new URLSearchParams({ workspaceId: wsId })
  if (filters?.userId) qs.set('userId', filters.userId)
  if (filters?.resourceType) qs.set('resourceType', filters.resourceType)
  return apiFetch<WorkspaceBinding[]>(`/v1/bindings?${qs}`, token)
}

export function createBinding(
  token: string,
  data: { userId: string; roleId: string; resourceType: string; resourceId?: string; workspaceId: string; type?: 'allow' | 'deny' },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/v1/bindings', token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function createDenyBinding(
  token: string,
  data: { userId: string; roleId: string; resourceType: string; resourceId?: string; workspaceId: string },
): Promise<{ id: string }> {
  return createBinding(token, { ...data, type: 'deny' })
}

export function listDenyBindings(token: string, wsId: string, filters?: { userId?: string; resourceType?: string }): Promise<WorkspaceBinding[]> {
  const qs = new URLSearchParams({ workspaceId: wsId, type: 'deny' })
  if (filters?.userId) qs.set('userId', filters.userId)
  if (filters?.resourceType) qs.set('resourceType', filters.resourceType)
  return apiFetch<WorkspaceBinding[]>(`/v1/bindings?${qs}`, token)
}

export function revokeDenyBinding(token: string, bindingId: string): Promise<void> {
  return deleteBinding(token, bindingId)
}

export function getRoleActiveUserCount(token: string, roleId: string): Promise<{ count: number }> {
  return apiFetch<{ count: number }>(`/v1/roles/${roleId}/active-user-count`, token)
}

export function updateRoleCapabilities(
  token: string,
  roleId: string,
  data: { capabilityIds: string[]; workspaceId: string },
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/v1/roles/${roleId}/capabilities`, token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteBinding(token: string, bindingId: string): Promise<void> {
  return apiFetch<void>(`/v1/bindings/${bindingId}`, token, { method: 'DELETE' })
}

export interface ResourceType {
  _id: string
  name: string
  inheritsFrom?: string
  inheritanceMode?: string
}

export function listResourceTypes(token: string): Promise<ResourceType[]> {
  return apiFetch<ResourceType[]>('/v1/resource-types', token)
}

export function createResourceType(
  token: string,
  data: { name: string; inheritsFrom?: string; inheritanceMode?: string },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/v1/resource-types', token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export interface WorkspaceAccessInfo {
  role: string
  source: 'workspace-binding'
  expiresAt?: number
}

export interface ResourceAccessEntry {
  resourceType: string
  resourceId: string
  effectiveRole: string | null
  source: string
  expiresAt?: number
  deniedBy?: string
}

export interface EffectiveAccessResult {
  workspaceAccess: WorkspaceAccessInfo | null
  resourceAccess: ResourceAccessEntry[]
}

export function getEffectiveAccess(token: string, userId: string, workspaceId: string): Promise<EffectiveAccessResult> {
  return apiFetch<EffectiveAccessResult>(`/v1/users/${userId}/effective-access?workspaceId=${workspaceId}`, token)
}

export interface AuditEvent {
  _id: string
  timestamp: number
  actorType: string
  actorId: string
  actorRole?: string
  action: string
  target: { type: string; id?: string }
  result: 'allow' | 'deny'
  reason?: string
}

export interface AuditLogPage {
  logs: AuditEvent[]
  isDone: boolean
  cursor: string | null
}

export function listWorkspaceAuditLog(
  token: string,
  wsId: string,
  params: { action?: string; result?: 'allow' | 'deny'; from?: number; to?: number; cursor?: string; numItems?: number } = {},
): Promise<AuditLogPage> {
  const qs = new URLSearchParams({ workspaceId: wsId })
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) qs.set(k, String(v))
  })
  return apiFetch<AuditLogPage>(`/v1/audit-log?${qs}`, token)
}
