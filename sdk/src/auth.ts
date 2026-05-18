import { GatekeyApiError, GatekeyAuthError } from "./errors.js";
import { MfaModule } from "./mfa.js";
import type { LoginResult, TokenStore } from "./types.js";

function parseJwtClaim(token: string, claim: string): string | undefined {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
    const val = decoded[claim];
    return typeof val === "string" && val ? val : undefined;
  } catch {
    return undefined;
  }
}

type RawFetch = (path: string, options?: RequestInit) => Promise<Response>;

export class AuthModule {
  private tokens: TokenStore | null = null;
  private mfaSetupTokenStored: string | null = null;
  readonly mfa: MfaModule;

  constructor(private readonly rawFetch: RawFetch) {
    this.mfa = new MfaModule(
      rawFetch,
      () => this.mfaSetupTokenStored,
      (tokens) => { this.tokens = tokens; },
    );
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const res = await this.rawFetch("/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      throw new GatekeyApiError(res.status, String(data.error ?? "unknown"));
    }

    // Backend returns snake_case field names
    const mfaToken = data.mfa_token ?? data.mfaToken;
    const mfaSetupToken = data.mfa_setup_token ?? data.mfaSetupToken;

    if (mfaToken) {
      return { type: "mfa_challenge", mfaToken: String(mfaToken) };
    }

    if (mfaSetupToken) {
      this.mfaSetupTokenStored = String(mfaSetupToken);
      return { type: "mfa_setup_required", mfaSetupToken: String(mfaSetupToken) };
    }

    const accessToken = String(data.accessToken);
    const refreshToken = String(data.refreshToken);
    const sessionId = data.sessionId ? String(data.sessionId) : undefined;
    const orgId = parseJwtClaim(accessToken, "orgId");
    this.tokens = { accessToken, refreshToken, sessionId, orgId };
    return { type: "success", accessToken, refreshToken };
  }

  async refresh(): Promise<void> {
    if (!this.tokens?.refreshToken) {
      throw new GatekeyAuthError("not_authenticated");
    }

    const res = await this.rawFetch("/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refreshToken: this.tokens.refreshToken,
        sessionId: this.tokens.sessionId,
        orgId: this.tokens.orgId,
      }),
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      throw new GatekeyApiError(res.status, String(data.error ?? "unknown"));
    }

    const accessToken = String(data.accessToken);
    const refreshToken = String(data.refreshToken);
    const sessionId = data.sessionId ? String(data.sessionId) : undefined;
    const orgId = parseJwtClaim(accessToken, "orgId");
    this.tokens = { accessToken, refreshToken, sessionId, orgId };
  }

  async logout(): Promise<void> {
    if (!this.tokens?.accessToken) {
      throw new GatekeyAuthError("not_authenticated");
    }

    const res = await this.rawFetch("/v1/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.tokens.accessToken}` },
    });

    if (!res.ok) {
      const data = await res.json() as Record<string, unknown>;
      throw new GatekeyApiError(res.status, String(data.error ?? "unknown"));
    }

    this.tokens = null;
  }

  getTokens(): TokenStore | null {
    return this.tokens;
  }
}
