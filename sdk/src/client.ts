import { AuthModule } from "./auth.js";
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
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(options: GatekeyClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.auth = new AuthModule(this._request.bind(this));
  }

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

    return fetch(`${this.baseUrl}${path}`, { ...options, headers });
  }
}
