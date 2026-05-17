import { GatekeyApiError, GatekeyAuthError } from "./errors.js";
import type { MfaChallengeResult, MfaSetupInitResult, MfaVerifySetupResult, TokenStore } from "./types.js";

type RawFetch = (path: string, options?: RequestInit) => Promise<Response>;

export class MfaModule {
  constructor(
    private readonly rawFetch: RawFetch,
    private readonly getSetupToken: () => string | null,
    private readonly storeTokens: (tokens: TokenStore) => void,
  ) {}

  async challenge(mfaToken: string, totpCode: string): Promise<MfaChallengeResult> {
    const res = await this.rawFetch("/v1/auth/mfa/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfaToken, totpCode }),
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      throw new GatekeyApiError(res.status, String(data.error ?? "unknown"));
    }

    const accessToken = String(data.accessToken);
    const refreshToken = String(data.refreshToken);
    const sessionId = data.sessionId ? String(data.sessionId) : undefined;
    this.storeTokens({ accessToken, refreshToken, sessionId });
    return { accessToken, refreshToken };
  }

  async setup(mfaSetupToken?: string): Promise<MfaSetupInitResult> {
    const token = mfaSetupToken ?? this.getSetupToken();
    if (!token) throw new GatekeyAuthError("no_mfa_setup_token");

    const res = await this.rawFetch("/v1/auth/mfa/setup", {
      method: "POST",
      headers: { Authorization: `MfaSetup ${token}` },
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      throw new GatekeyApiError(res.status, String(data.error ?? "unknown"));
    }

    return { secret: String(data.secret), qrCode: String(data.qrCode) };
  }

  async verifySetup(totpCode: string, mfaSetupToken?: string): Promise<MfaVerifySetupResult> {
    const token = mfaSetupToken ?? this.getSetupToken();
    if (!token) throw new GatekeyAuthError("no_mfa_setup_token");

    const res = await this.rawFetch("/v1/auth/mfa/verify-setup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `MfaSetup ${token}`,
      },
      body: JSON.stringify({ totpCode }),
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      throw new GatekeyApiError(res.status, String(data.error ?? "unknown"));
    }

    if (data.success === true) {
      return { success: true, backupCodes: data.backupCodes as string[] };
    }
    return { success: false, error: String(data.error ?? "unknown") };
  }
}
