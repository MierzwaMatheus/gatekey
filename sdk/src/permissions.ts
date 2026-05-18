import { GatekeyApiError } from "./errors.js";
import type { CheckResult } from "./types.js";

type Request = (path: string, options?: RequestInit) => Promise<Response>;

export class PermissionsModule {
  constructor(private readonly request: Request) {}

  async check<TCap extends string = string, TRes extends string = string>(
    capability: TCap,
    resourceType?: TRes,
    resourceId?: string,
    options?: { userId?: string; workspaceId?: string }
  ): Promise<CheckResult> {
    const body: Record<string, string> = { capability };
    if (resourceType !== undefined) body.resourceType = resourceType;
    if (resourceId !== undefined) body.resourceId = resourceId;
    if (options?.userId !== undefined) body.userId = options.userId;
    if (options?.workspaceId !== undefined) body.workspaceId = options.workspaceId;

    const res = await this.request("/v1/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      throw new GatekeyApiError(res.status, String(data.error ?? "unknown"));
    }

    // Backend returns `allowed`, SDK type exposes `allow`
    const allowed = data.allowed !== undefined ? data.allowed : data.allow;
    return { allow: Boolean(allowed), reason: data.reason as string | undefined };
  }
}
