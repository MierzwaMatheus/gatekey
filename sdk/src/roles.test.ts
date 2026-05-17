import { describe, it, expect, vi, beforeEach } from "vitest";
import { GatekeyClient } from "./client.js";
import { GatekeyApiError } from "./errors.js";

const BASE = "https://api.example.com";

function mockResponse(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("client.roles.list", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls GET /v1/roles with workspaceId query param", async () => {
    const fetchMock = mockResponse({ roles: [] });
    vi.stubGlobal("fetch", fetchMock);
    const client = new GatekeyClient({ baseUrl: BASE });

    await client.roles.list("ws1");

    const call = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe(`${BASE}/v1/roles?workspaceId=ws1`);
    expect(call[1].method).toBe("GET");
  });

  it("returns array of roles", async () => {
    vi.stubGlobal("fetch", mockResponse({ roles: [{ id: "r1", name: "admin" }] }));
    const client = new GatekeyClient({ baseUrl: BASE });

    const result = await client.roles.list("ws1");

    expect(result).toEqual([{ id: "r1", name: "admin" }]);
  });
});

describe("client.roles.create", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls POST /v1/roles with role data", async () => {
    const fetchMock = mockResponse({ id: "r1", name: "editor", workspaceId: "ws1" }, 201);
    vi.stubGlobal("fetch", fetchMock);
    const client = new GatekeyClient({ baseUrl: BASE });

    await client.roles.create({ name: "editor", workspaceId: "ws1" });

    const call = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe(`${BASE}/v1/roles`);
    expect(call[1].method).toBe("POST");
    expect(JSON.parse(call[1].body as string)).toEqual({ name: "editor", workspaceId: "ws1" });
  });

  it("returns created role", async () => {
    vi.stubGlobal("fetch", mockResponse({ id: "r1", name: "editor", workspaceId: "ws1" }, 201));
    const client = new GatekeyClient({ baseUrl: BASE });

    const result = await client.roles.create({ name: "editor", workspaceId: "ws1" });

    expect(result).toMatchObject({ id: "r1", name: "editor" });
  });
});

describe("client.roles.delete", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls DELETE /v1/roles/:id", async () => {
    const fetchMock = mockResponse({ success: true });
    vi.stubGlobal("fetch", fetchMock);
    const client = new GatekeyClient({ baseUrl: BASE });

    await client.roles.delete("r1");

    const call = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe(`${BASE}/v1/roles/r1`);
    expect(call[1].method).toBe("DELETE");
  });

  it("throws GatekeyApiError with RoleHasActiveBindings on 409", async () => {
    vi.stubGlobal("fetch", mockResponse({ error: "RoleHasActiveBindings", message: "Role has bindings" }, 409));
    const client = new GatekeyClient({ baseUrl: BASE });

    const err = await client.roles.delete("r1").catch((e) => e) as GatekeyApiError;

    expect(err).toBeInstanceOf(GatekeyApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("RoleHasActiveBindings");
  });
});
