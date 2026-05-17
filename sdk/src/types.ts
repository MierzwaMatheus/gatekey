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
