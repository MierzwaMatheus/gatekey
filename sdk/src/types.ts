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
