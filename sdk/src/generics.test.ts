import { describe, it, expect, vi, expectTypeOf, beforeEach } from "vitest";
import { GatekeyClient } from "./client.js";
import type { CheckResult } from "./types.js";

type AppCapability = "users:read" | "users:write" | "documents:read";
type AppResource = "document" | "folder";

function mockResponse(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("permissions.check generic typing", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("accepts typed capability string and returns CheckResult", async () => {
    vi.stubGlobal("fetch", mockResponse({ allow: true }));
    const client = new GatekeyClient({ baseUrl: "https://api.example.com" });

    const result = await client.permissions.check<AppCapability, AppResource>(
      "users:read",
      "document",
      "doc-1"
    );

    expectTypeOf(result).toMatchTypeOf<CheckResult>();
    expect(result.allow).toBe(true);
  });

  it("works without generics (defaults to string)", async () => {
    vi.stubGlobal("fetch", mockResponse({ allow: false }));
    const client = new GatekeyClient({ baseUrl: "https://api.example.com" });

    const result = await client.permissions.check("any:capability");

    expectTypeOf(result).toMatchTypeOf<CheckResult>();
    expect(result.allow).toBe(false);
  });
});
