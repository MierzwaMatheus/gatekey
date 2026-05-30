// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { GatekeyApiError } from "./errors.js";
import type { BindingFilters, BindingResponse, CreateBindingData } from "./types.js";

type Request = (path: string, options?: RequestInit) => Promise<Response>;

export class BindingsModule {
  constructor(private readonly request: Request) {}

  async list<TRes extends string = string>(filters: BindingFilters<TRes>): Promise<BindingResponse<TRes>[]> {
    const params = new URLSearchParams({ workspaceId: filters.workspaceId });
    if (filters.userId) params.set("userId", filters.userId);
    if (filters.resourceType) params.set("resourceType", filters.resourceType);

    const res = await this.request(`/v1/bindings?${params.toString()}`, { method: "GET" });
    const body = await res.json() as { bindings: BindingResponse[] };
    if (!res.ok) throw new GatekeyApiError(res.status, "unknown");
    return body.bindings as BindingResponse<TRes>[];
  }

  async create<TRes extends string = string>(data: CreateBindingData<TRes>): Promise<BindingResponse<TRes>> {
    const res = await this.request("/v1/bindings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new GatekeyApiError(res.status, String(body.error ?? "unknown"));
    return body as BindingResponse<TRes>;
  }

  async delete(id: string, workspaceId: string): Promise<{ success: true }> {
    const res = await this.request(`/v1/bindings/${id}?workspaceId=${encodeURIComponent(workspaceId)}`, { method: "DELETE" });
    const body = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new GatekeyApiError(res.status, String(body.error ?? "unknown"));
    return { success: true };
  }
}
