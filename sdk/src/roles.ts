// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { GatekeyApiError } from "./errors.js";
import type { CreateRoleData, RoleResponse } from "./types.js";

type Request = (path: string, options?: RequestInit) => Promise<Response>;

export class RolesModule {
  constructor(private readonly request: Request) {}

  async list(workspaceId: string): Promise<RoleResponse[]> {
    const res = await this.request(`/v1/roles?workspaceId=${encodeURIComponent(workspaceId)}`, { method: "GET" });
    const body = await res.json() as { roles: RoleResponse[] };
    if (!res.ok) throw new GatekeyApiError(res.status, "unknown");
    return body.roles;
  }

  async create(data: CreateRoleData): Promise<RoleResponse> {
    const res = await this.request("/v1/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new GatekeyApiError(res.status, String(body.error ?? "unknown"));
    return body as RoleResponse;
  }

  async delete(id: string): Promise<{ success: true }> {
    const res = await this.request(`/v1/roles/${id}`, { method: "DELETE" });
    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new GatekeyApiError(res.status, String(body.error ?? "unknown"));
    return { success: true };
  }
}
