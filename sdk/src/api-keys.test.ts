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

describe("client.apiKeys.list", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls GET /v1/api-keys", async () => {
    const fetchMock = mockResponse([]);
    vi.stubGlobal("fetch", fetchMock);
    const client = new GatekeyClient({ baseUrl: BASE });

    await client.apiKeys.list();

    const call = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe(`${BASE}/v1/api-keys`);
    expect(call[1].method).toBe("GET");
  });

  it("returns array of api keys metadata", async () => {
    vi.stubGlobal("fetch", mockResponse([{ id: "k1", scopes: ["check"] }, { id: "k2", scopes: [] }]));
    const client = new GatekeyClient({ baseUrl: BASE });

    const result = await client.apiKeys.list();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "k1" });
  });
});

describe("client.apiKeys.create", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls POST /v1/api-keys with data", async () => {
    const fetchMock = mockResponse({ id: "k1", key: "gk_live_pk_abc123", scopes: ["check"] }, 201);
    vi.stubGlobal("fetch", fetchMock);
    const client = new GatekeyClient({ baseUrl: BASE });

    await client.apiKeys.create({ scopes: ["check"], description: "My key" });

    const call = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe(`${BASE}/v1/api-keys`);
    expect(call[1].method).toBe("POST");
    expect(JSON.parse(call[1].body as string)).toEqual({ scopes: ["check"], description: "My key" });
  });

  it("returns created key with full key value", async () => {
    vi.stubGlobal("fetch", mockResponse({ id: "k1", key: "gk_live_pk_abc123", scopes: ["check"], description: "My key" }, 201));
    const client = new GatekeyClient({ baseUrl: BASE });

    const result = await client.apiKeys.create({ scopes: ["check"] });

    expect(result).toMatchObject({ id: "k1", key: "gk_live_pk_abc123" });
  });

  it("throws GatekeyApiError on quota exceeded", async () => {
    vi.stubGlobal("fetch", mockResponse({ error: "QuotaExceeded", quota: "api_keys_per_org" }, 429));
    const client = new GatekeyClient({ baseUrl: BASE });

    const err = await client.apiKeys.create({}).catch(e => e) as GatekeyApiError;

    expect(err).toBeInstanceOf(GatekeyApiError);
    expect(err.status).toBe(429);
  });
});

describe("client.apiKeys.revoke", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls DELETE /v1/api-keys/:id", async () => {
    const fetchMock = mockResponse({ success: true });
    vi.stubGlobal("fetch", fetchMock);
    const client = new GatekeyClient({ baseUrl: BASE });

    await client.apiKeys.revoke("k1");

    const call = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe(`${BASE}/v1/api-keys/k1`);
    expect(call[1].method).toBe("DELETE");
  });

  it("returns success", async () => {
    vi.stubGlobal("fetch", mockResponse({ success: true }));
    const client = new GatekeyClient({ baseUrl: BASE });

    const result = await client.apiKeys.revoke("k1");

    expect(result).toEqual({ success: true });
  });

  it("throws GatekeyApiError on 404", async () => {
    vi.stubGlobal("fetch", mockResponse({ error: "not_found" }, 404));
    const client = new GatekeyClient({ baseUrl: BASE });

    await expect(client.apiKeys.revoke("missing")).rejects.toThrow(GatekeyApiError);
  });
});
