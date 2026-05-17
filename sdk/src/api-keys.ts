import { GatekeyApiError } from "./errors.js";
import type { ApiKeyCreatedResponse, ApiKeyResponse, CreateApiKeyData } from "./types.js";

type Request = (path: string, options?: RequestInit) => Promise<Response>;

export class ApiKeysModule {
  constructor(private readonly request: Request) {}

  async list(): Promise<ApiKeyResponse[]> {
    const res = await this.request("/v1/api-keys", { method: "GET" });
    const body = await res.json() as ApiKeyResponse[];
    if (!res.ok) throw new GatekeyApiError(res.status, "unknown");
    return body;
  }

  async create(data: CreateApiKeyData): Promise<ApiKeyCreatedResponse> {
    const res = await this.request("/v1/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new GatekeyApiError(res.status, String(body.error ?? "unknown"));
    return body as ApiKeyCreatedResponse;
  }

  async revoke(id: string): Promise<{ success: true }> {
    const res = await this.request(`/v1/api-keys/${id}`, { method: "DELETE" });
    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new GatekeyApiError(res.status, String(body.error ?? "unknown"));
    return { success: true };
  }
}
