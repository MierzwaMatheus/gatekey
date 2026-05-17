import { GatekeyApiError } from "./errors.js";
import type { CheckResult } from "./types.js";

type Request = (path: string, options?: RequestInit) => Promise<Response>;

export class PermissionsModule {
  constructor(private readonly request: Request) {}

  async check(capability: string, resourceType?: string, resourceId?: string): Promise<CheckResult> {
    const body: Record<string, string> = { capability };
    if (resourceType !== undefined) body.resourceType = resourceType;
    if (resourceId !== undefined) body.resourceId = resourceId;

    const res = await this.request("/v1/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      throw new GatekeyApiError(res.status, String(data.error ?? "unknown"));
    }

    return { allow: Boolean(data.allow), reason: data.reason as string | undefined };
  }
}
