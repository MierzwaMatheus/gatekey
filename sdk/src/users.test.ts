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

const BASE = "https://api.example.com";

describe("client.users.create", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls POST /v1/users with user data", async () => {
    const fetchMock = mockResponse({ id: "u1", email: "user@example.com" }, 201);
    vi.stubGlobal("fetch", fetchMock);
    const client = new GatekeyClient({ baseUrl: BASE });

    await client.users.create({ email: "user@example.com", password: "pass123", role: "member" });

    const call = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe(`${BASE}/v1/users`);
    expect(call[1].method).toBe("POST");
    expect(JSON.parse(call[1].body as string)).toMatchObject({ email: "user@example.com" });
  });

  it("returns created user", async () => {
    vi.stubGlobal("fetch", mockResponse({ id: "u1", email: "user@example.com", role: "member" }, 201));
    const client = new GatekeyClient({ baseUrl: BASE });

    const result = await client.users.create({ email: "user@example.com", password: "pass", role: "member" });

    expect(result).toMatchObject({ id: "u1", email: "user@example.com" });
  });

  it("throws GatekeyApiError on API error", async () => {
    vi.stubGlobal("fetch", mockResponse({ error: "email_taken" }, 409));
    const client = new GatekeyClient({ baseUrl: BASE });

    await expect(client.users.create({ email: "dup@example.com", password: "p", role: "member" })).rejects.toThrow(GatekeyApiError);
  });
});

describe("client.users.get", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls GET /v1/users/:id", async () => {
    const fetchMock = mockResponse({ id: "u1", email: "user@example.com" });
    vi.stubGlobal("fetch", fetchMock);
    const client = new GatekeyClient({ baseUrl: BASE });

    await client.users.get("u1");

    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(`${BASE}/v1/users/u1`);
  });

  it("returns user object", async () => {
    vi.stubGlobal("fetch", mockResponse({ id: "u1", email: "user@example.com", role: "admin" }));
    const client = new GatekeyClient({ baseUrl: BASE });

    const result = await client.users.get("u1");

    expect(result).toMatchObject({ id: "u1", email: "user@example.com" });
  });

  it("throws GatekeyApiError on 404", async () => {
    vi.stubGlobal("fetch", mockResponse({ error: "not_found" }, 404));
    const client = new GatekeyClient({ baseUrl: BASE });

    await expect(client.users.get("missing")).rejects.toThrow(GatekeyApiError);
  });
});

describe("client.users.list", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls GET /v1/users", async () => {
    const fetchMock = mockResponse({ users: [] });
    vi.stubGlobal("fetch", fetchMock);
    const client = new GatekeyClient({ baseUrl: BASE });

    await client.users.list();

    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(`${BASE}/v1/users`);
    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][1].method).toBe("GET");
  });

  it("returns array of users", async () => {
    vi.stubGlobal("fetch", mockResponse({ users: [{ id: "u1" }, { id: "u2" }] }));
    const client = new GatekeyClient({ baseUrl: BASE });

    const result = await client.users.list();

    expect(result).toHaveLength(2);
  });
});

describe("client.users.update", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls PATCH /v1/users/:id with update data", async () => {
    const fetchMock = mockResponse({ success: true });
    vi.stubGlobal("fetch", fetchMock);
    const client = new GatekeyClient({ baseUrl: BASE });

    await client.users.update("u1", { email: "new@example.com" });

    const call = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe(`${BASE}/v1/users/u1`);
    expect(call[1].method).toBe("PATCH");
    expect(JSON.parse(call[1].body as string)).toEqual({ email: "new@example.com" });
  });

  it("returns success", async () => {
    vi.stubGlobal("fetch", mockResponse({ success: true }));
    const client = new GatekeyClient({ baseUrl: BASE });

    const result = await client.users.update("u1", { email: "new@example.com" });

    expect(result).toEqual({ success: true });
  });
});

describe("client.users.delete", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls DELETE /v1/users/:id", async () => {
    const fetchMock = mockResponse({ success: true });
    vi.stubGlobal("fetch", fetchMock);
    const client = new GatekeyClient({ baseUrl: BASE });

    await client.users.delete("u1");

    const call = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe(`${BASE}/v1/users/u1`);
    expect(call[1].method).toBe("DELETE");
  });

  it("returns success", async () => {
    vi.stubGlobal("fetch", mockResponse({ success: true }));
    const client = new GatekeyClient({ baseUrl: BASE });

    const result = await client.users.delete("u1");

    expect(result).toEqual({ success: true });
  });
});
