import { GatekeyApiError } from "./errors.js";
import type { CreateUserData, UpdateUserData, UserResponse } from "./types.js";

type Request = (path: string, options?: RequestInit) => Promise<Response>;

export class UsersModule {
  constructor(private readonly request: Request) {}

  async create(data: CreateUserData): Promise<UserResponse> {
    const res = await this.request("/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new GatekeyApiError(res.status, String(body.error ?? "unknown"));
    return body as UserResponse;
  }

  async get(id: string): Promise<UserResponse> {
    const res = await this.request(`/v1/users/${id}`, { method: "GET" });
    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new GatekeyApiError(res.status, String(body.error ?? "unknown"));
    return body as UserResponse;
  }

  async list(): Promise<UserResponse[]> {
    const res = await this.request("/v1/users", { method: "GET" });
    const body = await res.json() as { users: UserResponse[] };
    if (!res.ok) throw new GatekeyApiError(res.status, "unknown");
    return body.users;
  }

  async update(id: string, data: UpdateUserData): Promise<{ success: true }> {
    const res = await this.request(`/v1/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new GatekeyApiError(res.status, String(body.error ?? "unknown"));
    return { success: true };
  }

  async delete(id: string): Promise<{ success: true }> {
    const res = await this.request(`/v1/users/${id}`, { method: "DELETE" });
    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new GatekeyApiError(res.status, String(body.error ?? "unknown"));
    return { success: true };
  }
}
