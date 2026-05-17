export interface GatekeyClientOptions {
  baseUrl: string;
  apiKey?: string;
}

export interface TokenStore {
  accessToken: string;
  refreshToken: string;
}

export type LoginResult =
  | { type: "success"; accessToken: string; refreshToken: string }
  | { type: "mfa_challenge"; mfaToken: string }
  | { type: "mfa_setup_required"; mfaSetupToken: string };

export interface MfaChallengeResult {
  accessToken: string;
  refreshToken: string;
}

export interface MfaSetupInitResult {
  secret: string;
  qrCode: string;
}

export type MfaVerifySetupResult =
  | { success: true; backupCodes: string[] }
  | { success: false; error: string };

export interface CheckResult {
  allow: boolean;
  reason?: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  role: string;
  orgId?: string;
}

export interface UpdateUserData {
  email?: string;
  password?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  role?: string;
  [key: string]: unknown;
}

export interface CreateRoleData {
  name: string;
  workspaceId: string;
}

export interface RoleResponse {
  id: string;
  name: string;
  workspaceId: string;
  [key: string]: unknown;
}

export interface BindingFilters {
  workspaceId: string;
  userId?: string;
  resourceType?: string;
}

export interface CreateBindingData {
  userId: string;
  roleId: string;
  resourceType: string;
  resourceId?: string;
  parentResourceId?: string;
  workspaceId: string;
}

export interface BindingResponse {
  id: string;
  userId: string;
  roleId: string;
  resourceType: string;
  resourceId?: string;
  workspaceId: string;
  [key: string]: unknown;
}

export interface CreateApiKeyData {
  scopes?: string[];
  description?: string;
}

export interface ApiKeyResponse {
  id: string;
  scopes: string[];
  description?: string;
  createdAt?: number;
  [key: string]: unknown;
}

export interface ApiKeyCreatedResponse extends ApiKeyResponse {
  key: string;
}
