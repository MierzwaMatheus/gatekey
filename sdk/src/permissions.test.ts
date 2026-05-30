import { describe, it, expect, vi, beforeEach } from "vitest";
import { GatekeyClient } from "./client.js";
import { GatekeyApiError } from "./errors.js";

function mockResponse(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("client.permissions.check", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls POST /v1/check with capability", async () => {
    const fetchMock = mockResponse({ allow: true });
    vi.stubGlobal("fetch", fetchMock);
    const client = new GatekeyClient({ baseUrl: "https://api.example.com" });

    await client.permissions.check("users:read");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/check",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ capability: "users:read" }),
      })
    );
  });

  it("includes resourceType and resourceId in body when provided", async () => {
    const fetchMock = mockResponse({ allow: true });
    vi.stubGlobal("fetch", fetchMock);
    const client = new GatekeyClient({ baseUrl: "https://api.example.com" });

    await client.permissions.check("documents:read", "document", "doc-123");

    const call = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(call[1].body as string)).toEqual({
      capability: "documents:read",
      resourceType: "document",
      resourceId: "doc-123",
    });
  });

  it("returns allow: true when server grants access", async () => {
    vi.stubGlobal("fetch", mockResponse({ allow: true }));
    const client = new GatekeyClient({ baseUrl: "https://api.example.com" });

    const result = await client.permissions.check("users:read");

    expect(result).toEqual({ allow: true });
  });

  it("returns allow: false when server denies access", async () => {
    vi.stubGlobal("fetch", mockResponse({ allow: false, reason: "no_binding_found" }));
    const client = new GatekeyClient({ baseUrl: "https://api.example.com" });

    const result = await client.permissions.check("admin:write");

    expect(result.allow).toBe(false);
  });

  it("throws GatekeyApiError on 401", async () => {
    vi.stubGlobal("fetch", mockResponse({ error: "unauthorized" }, 401));
    const client = new GatekeyClient({ baseUrl: "https://api.example.com" });

    await expect(client.permissions.check("users:read")).rejects.toThrow(GatekeyApiError);
  });
});
