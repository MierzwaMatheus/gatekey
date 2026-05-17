import { describe, it, expect, vi, beforeEach } from "vitest";
import { GatekeyClient } from "./client.js";
import { GatekeyApiError } from "./errors.js";

function makeClient(fetchImpl: typeof fetch) {
  const client = new GatekeyClient({ baseUrl: "https://api.example.com" });
  vi.stubGlobal("fetch", fetchImpl);
  return client;
}

function mockResponse(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("client.auth.login", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success with tokens on valid credentials", async () => {
    const fetch = mockResponse({ accessToken: "acc123", refreshToken: "ref456" });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    const result = await client.auth.login("user@example.com", "password123");

    expect(result).toEqual({ type: "success", accessToken: "acc123", refreshToken: "ref456" });
    expect(client.auth.getTokens()).toEqual({ accessToken: "acc123", refreshToken: "ref456" });
  });

  it("returns mfa_challenge when API returns mfaToken", async () => {
    const fetch = mockResponse({ mfaToken: "mfa.token.here" });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    const result = await client.auth.login("user@example.com", "password123");

    expect(result).toEqual({ type: "mfa_challenge", mfaToken: "mfa.token.here" });
    expect(client.auth.getTokens()).toBeNull();
  });

  it("returns mfa_setup_required when API returns mfaSetupToken", async () => {
    const fetch = mockResponse({ mfaSetupToken: "setup.token.here" });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    const result = await client.auth.login("user@example.com", "password123");

    expect(result).toEqual({ type: "mfa_setup_required", mfaSetupToken: "setup.token.here" });
  });

  it("throws GatekeyApiError on 401", async () => {
    const fetch = mockResponse({ error: "invalid_credentials" }, 401);
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    await expect(client.auth.login("user@example.com", "wrong")).rejects.toThrow(GatekeyApiError);
  });

  it("calls POST /v1/auth/login with email and password", async () => {
    const fetch = mockResponse({ accessToken: "acc", refreshToken: "ref" });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    await client.auth.login("user@example.com", "pass");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "user@example.com", password: "pass" }),
      })
    );
  });
});

describe("client.auth.refresh", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("updates tokens after successful refresh", async () => {
    const loginFetch = mockResponse({ accessToken: "old.acc", refreshToken: "old.ref" });
    const client = makeClient(loginFetch as unknown as typeof globalThis.fetch);
    await client.auth.login("u@e.com", "p");

    const refreshFetch = mockResponse({ accessToken: "new.acc", refreshToken: "new.ref" });
    vi.stubGlobal("fetch", refreshFetch);

    await client.auth.refresh();

    expect(client.auth.getTokens()).toEqual({ accessToken: "new.acc", refreshToken: "new.ref" });
  });

  it("sends refreshToken in body", async () => {
    const loginFetch = mockResponse({ accessToken: "old.acc", refreshToken: "my.refresh.token" });
    const client = makeClient(loginFetch as unknown as typeof globalThis.fetch);
    await client.auth.login("u@e.com", "p");

    const refreshFetch = mockResponse({ accessToken: "new.acc", refreshToken: "new.ref" });
    vi.stubGlobal("fetch", refreshFetch);

    await client.auth.refresh();

    expect(refreshFetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/auth/refresh",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refreshToken: "my.refresh.token" }),
      })
    );
  });

  it("throws GatekeyAuthError when no refresh token available", async () => {
    vi.stubGlobal("fetch", mockResponse({}));
    const client = new GatekeyClient({ baseUrl: "https://api.example.com" });

    await expect(client.auth.refresh()).rejects.toThrow("not_authenticated");
  });

  it("throws GatekeyApiError when API returns error", async () => {
    const loginFetch = mockResponse({ accessToken: "acc", refreshToken: "ref" });
    const client = makeClient(loginFetch as unknown as typeof globalThis.fetch);
    await client.auth.login("u@e.com", "p");

    vi.stubGlobal("fetch", mockResponse({ error: "invalid_token" }, 401));

    await expect(client.auth.refresh()).rejects.toThrow(GatekeyApiError);
  });
});

describe("client.auth.logout", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("clears tokens after successful logout", async () => {
    const loginFetch = mockResponse({ accessToken: "acc", refreshToken: "ref" });
    const client = makeClient(loginFetch as unknown as typeof globalThis.fetch);
    await client.auth.login("u@e.com", "p");

    vi.stubGlobal("fetch", mockResponse({}, 200));

    await client.auth.logout();

    expect(client.auth.getTokens()).toBeNull();
  });

  it("sends Authorization header with access token", async () => {
    const loginFetch = mockResponse({ accessToken: "my.access.token", refreshToken: "ref" });
    const client = makeClient(loginFetch as unknown as typeof globalThis.fetch);
    await client.auth.login("u@e.com", "p");

    const logoutFetch = mockResponse({}, 200);
    vi.stubGlobal("fetch", logoutFetch);

    await client.auth.logout();

    const call = (logoutFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = call[1].headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer my.access.token");
  });

  it("throws GatekeyAuthError when not authenticated", async () => {
    vi.stubGlobal("fetch", mockResponse({}));
    const client = new GatekeyClient({ baseUrl: "https://api.example.com" });

    await expect(client.auth.logout()).rejects.toThrow("not_authenticated");
  });
});

describe("auto-refresh interceptor (_request)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function makeExpiredJwt(secondsFromNow: number): string {
    const exp = Math.floor(Date.now() / 1000) + secondsFromNow;
    const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
    return `header.${payload}.signature`;
  }

  it("calls refresh when access token expires in less than 60s", async () => {
    const loginFetch = mockResponse({
      accessToken: makeExpiredJwt(30),
      refreshToken: "ref",
    });
    const client = makeClient(loginFetch as unknown as typeof globalThis.fetch);
    await client.auth.login("u@e.com", "p");

    const refreshAndCallFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ accessToken: makeExpiredJwt(3600), refreshToken: "new.ref" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: "ok" }),
      });
    vi.stubGlobal("fetch", refreshAndCallFetch);

    await client._request("/v1/some-endpoint");

    expect(refreshAndCallFetch).toHaveBeenCalledTimes(2);
    const firstCall = refreshAndCallFetch.mock.calls[0][0];
    expect(firstCall).toContain("/v1/auth/refresh");
  });

  it("does not refresh when token expires in more than 60s", async () => {
    const loginFetch = mockResponse({
      accessToken: makeExpiredJwt(3600),
      refreshToken: "ref",
    });
    const client = makeClient(loginFetch as unknown as typeof globalThis.fetch);
    await client.auth.login("u@e.com", "p");

    const callFetch = mockResponse({ data: "ok" });
    vi.stubGlobal("fetch", callFetch);

    await client._request("/v1/some-endpoint");

    expect(callFetch).toHaveBeenCalledTimes(1);
    expect((callFetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain("/v1/some-endpoint");
  });
});
