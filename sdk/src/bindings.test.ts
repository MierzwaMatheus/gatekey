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

describe("client.bindings.list", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls GET /v1/bindings with workspaceId", async () => {
    const fetchMock = mockResponse({ bindings: [] });
    vi.stubGlobal("fetch", fetchMock);
    const client = new GatekeyClient({ baseUrl: BASE });

    await client.bindings.list({ workspaceId: "ws1" });

    const call = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain(`${BASE}/v1/bindings`);
    expect(call[0]).toContain("workspaceId=ws1");
    expect(call[1].method).toBe("GET");
  });

  it("appends optional userId and resourceType filters", async () => {
    const fetchMock = mockResponse({ bindings: [] });
    vi.stubGlobal("fetch", fetchMock);
    const client = new GatekeyClient({ baseUrl: BASE });

    await client.bindings.list({ workspaceId: "ws1", userId: "u1", resourceType: "document" });

    const url: string = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(url).toContain("userId=u1");
    expect(url).toContain("resourceType=document");
  });

  it("returns array of bindings", async () => {
    vi.stubGlobal("fetch", mockResponse({ bindings: [{ id: "b1" }, { id: "b2" }] }));
    const client = new GatekeyClient({ baseUrl: BASE });

    const result = await client.bindings.list({ workspaceId: "ws1" });

    expect(result).toHaveLength(2);
  });
});

describe("client.bindings.create", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls POST /v1/bindings with binding data", async () => {
    const fetchMock = mockResponse({ id: "b1", userId: "u1", roleId: "r1" }, 201);
    vi.stubGlobal("fetch", fetchMock);
    const client = new GatekeyClient({ baseUrl: BASE });

    await client.bindings.create({ userId: "u1", roleId: "r1", resourceType: "workspace", workspaceId: "ws1" });

    const call = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe(`${BASE}/v1/bindings`);
    expect(call[1].method).toBe("POST");
    expect(JSON.parse(call[1].body as string)).toMatchObject({ userId: "u1", roleId: "r1" });
  });

  it("returns created binding", async () => {
    vi.stubGlobal("fetch", mockResponse({ id: "b1", userId: "u1", roleId: "r1", workspaceId: "ws1" }, 201));
    const client = new GatekeyClient({ baseUrl: BASE });

    const result = await client.bindings.create({ userId: "u1", roleId: "r1", resourceType: "workspace", workspaceId: "ws1" });

    expect(result).toMatchObject({ id: "b1", userId: "u1" });
  });

  it("throws GatekeyApiError with InvalidRoleWorkspace on 422", async () => {
    vi.stubGlobal("fetch", mockResponse({ error: "InvalidRoleWorkspace", message: "Role belongs to another workspace" }, 422));
    const client = new GatekeyClient({ baseUrl: BASE });

    const err = await client.bindings.create({ userId: "u1", roleId: "r1", resourceType: "workspace", workspaceId: "ws1" }).catch(e => e) as GatekeyApiError;

    expect(err).toBeInstanceOf(GatekeyApiError);
    expect(err.status).toBe(422);
    expect(err.code).toBe("InvalidRoleWorkspace");
  });
});

describe("client.bindings.delete", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls DELETE /v1/bindings/:id with workspaceId query param", async () => {
    const fetchMock = mockResponse({ success: true });
    vi.stubGlobal("fetch", fetchMock);
    const client = new GatekeyClient({ baseUrl: BASE });

    await client.bindings.delete("b1", "ws1");

    const call = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe(`${BASE}/v1/bindings/b1?workspaceId=ws1`);
    expect(call[1].method).toBe("DELETE");
  });

  it("returns success", async () => {
    vi.stubGlobal("fetch", mockResponse({ success: true }));
    const client = new GatekeyClient({ baseUrl: BASE });

    const result = await client.bindings.delete("b1", "ws1");

    expect(result).toEqual({ success: true });
  });
});
