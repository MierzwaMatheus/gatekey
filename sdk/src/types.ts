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
