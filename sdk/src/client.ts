import { AuthModule } from "./auth.js";
import { PermissionsModule } from "./permissions.js";
import { UsersModule } from "./users.js";
import { RolesModule } from "./roles.js";
import { BindingsModule } from "./bindings.js";
import { ApiKeysModule } from "./api-keys.js";
import type { GatekeyClientOptions } from "./types.js";

function parseJwtExp(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString()) as Record<string, unknown>;
    return typeof decoded.exp === "number" ? decoded.exp : null;
  } catch {
    return null;
  }
}

export class GatekeyClient {
  readonly auth: AuthModule;
  readonly permissions: PermissionsModule;
  readonly users: UsersModule;
  readonly roles: RolesModule;
  readonly bindings: BindingsModule;
  readonly apiKeys: ApiKeysModule;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly _fetch: (url: string, init?: RequestInit) => Promise<Response>;

  constructor(options: GatekeyClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this._fetch = options.fetchFn ?? ((url, init) => fetch(url, init));
    this.auth = new AuthModule(this._rawFetch.bind(this));
    this.permissions = new PermissionsModule(this._request.bind(this));
    this.users = new UsersModule(this._request.bind(this));
    this.roles = new RolesModule(this._request.bind(this));
    this.bindings = new BindingsModule(this._request.bind(this));
    this.apiKeys = new ApiKeysModule(this._request.bind(this));
  }

  /** Direct fetch without auto-refresh interceptor. Used by auth endpoints internally. */
  private async _rawFetch(path: string, options: RequestInit = {}): Promise<Response> {
    return this._fetch(`${this.baseUrl}${path}`, options);
  }

  /** Fetch with auto-refresh interceptor. Use for all non-auth API calls. */
  async _request(path: string, options: RequestInit = {}): Promise<Response> {
    const tokens = this.auth.getTokens();

    if (tokens?.accessToken) {
      const exp = parseJwtExp(tokens.accessToken);
      if (exp !== null && exp - Date.now() / 1000 < 60) {
        await this.auth.refresh();
      }
    }

    const freshTokens = this.auth.getTokens();
    const headers = new Headers(options.headers as HeadersInit);

    if (freshTokens?.accessToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${freshTokens.accessToken}`);
    }

    if (this.apiKey && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }

    return this._fetch(`${this.baseUrl}${path}`, { ...options, headers });
  }
}
