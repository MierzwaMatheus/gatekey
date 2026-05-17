import { describe, it, expect, vi, beforeEach } from "vitest";
import { GatekeyClient } from "./client.js";
import { GatekeyApiError } from "./errors.js";

function makeClient() {
  return new GatekeyClient({ baseUrl: "https://api.example.com" });
}

function mockResponse(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("client.auth.mfa.challenge", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls POST /v1/auth/mfa/challenge with mfaToken and totpCode", async () => {
    const fetchMock = mockResponse({ accessToken: "acc", refreshToken: "ref", sessionId: "s1" });
    vi.stubGlobal("fetch", fetchMock);
    const client = makeClient();

    await client.auth.mfa.challenge("mfa.token", "123456");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/auth/mfa/challenge",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ mfaToken: "mfa.token", totpCode: "123456" }),
      })
    );
  });

  it("stores tokens after successful challenge", async () => {
    vi.stubGlobal("fetch", mockResponse({ accessToken: "acc123", refreshToken: "ref456", sessionId: "s1" }));
    const client = makeClient();

    const result = await client.auth.mfa.challenge("mfa.token", "123456");

    expect(result).toEqual({ accessToken: "acc123", refreshToken: "ref456" });
    expect(client.auth.getTokens()).toMatchObject({ accessToken: "acc123", refreshToken: "ref456", sessionId: "s1" });
  });

  it("throws GatekeyApiError on invalid TOTP code", async () => {
    vi.stubGlobal("fetch", mockResponse({ error: "invalid_code" }, 401));
    const client = makeClient();

    await expect(client.auth.mfa.challenge("mfa.token", "000000")).rejects.toThrow(GatekeyApiError);
  });
});

describe("client.auth.mfa.setup", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls POST /v1/auth/mfa/setup with MfaSetup Authorization header when mfaSetupToken is provided", async () => {
    const fetchMock = mockResponse({ secret: "SECRET32", qrCode: "otpauth://totp/..." });
    vi.stubGlobal("fetch", fetchMock);
    const client = makeClient();

    await client.auth.mfa.setup("setup.token.here");

    const call = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("https://api.example.com/v1/auth/mfa/setup");
    expect(call[1].method).toBe("POST");
    const headers = new Headers(call[1].headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("MfaSetup setup.token.here");
  });

  it("returns secret and qrCode from the API", async () => {
    vi.stubGlobal("fetch", mockResponse({ secret: "MYSECRET", qrCode: "otpauth://totp/app:user" }));
    const client = makeClient();

    const result = await client.auth.mfa.setup("setup.token");

    expect(result).toEqual({ secret: "MYSECRET", qrCode: "otpauth://totp/app:user" });
  });

  it("uses stored mfaSetupToken from login when no token is provided", async () => {
    const loginFetch = mockResponse({ mfaSetupToken: "stored.setup.token" });
    vi.stubGlobal("fetch", loginFetch);
    const client = makeClient();
    await client.auth.login("user@example.com", "password");

    const setupFetch = mockResponse({ secret: "SEC", qrCode: "otpauth://totp/..." });
    vi.stubGlobal("fetch", setupFetch);

    await client.auth.mfa.setup();

    const call = (setupFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = new Headers(call[1].headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("MfaSetup stored.setup.token");
  });

  it("throws GatekeyAuthError when no mfaSetupToken available", async () => {
    vi.stubGlobal("fetch", mockResponse({}));
    const client = makeClient();

    await expect(client.auth.mfa.setup()).rejects.toThrow("no_mfa_setup_token");
  });

  it("throws GatekeyApiError on API error", async () => {
    vi.stubGlobal("fetch", mockResponse({ error: "unauthorized" }, 401));
    const client = makeClient();

    await expect(client.auth.mfa.setup("bad.token")).rejects.toThrow(GatekeyApiError);
  });
});

describe("client.auth.mfa.verifySetup", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("calls POST /v1/auth/mfa/verify-setup with totpCode and MfaSetup header", async () => {
    const fetchMock = mockResponse({ success: true, backupCodes: ["code1", "code2"] });
    vi.stubGlobal("fetch", fetchMock);
    const client = makeClient();

    await client.auth.mfa.verifySetup("123456", "setup.token");

    const call = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("https://api.example.com/v1/auth/mfa/verify-setup");
    expect(call[1].method).toBe("POST");
    expect(JSON.parse(call[1].body as string)).toEqual({ totpCode: "123456" });
    const headers = new Headers(call[1].headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("MfaSetup setup.token");
  });

  it("returns success and backupCodes on valid TOTP", async () => {
    vi.stubGlobal("fetch", mockResponse({ success: true, backupCodes: ["abc", "def"] }));
    const client = makeClient();

    const result = await client.auth.mfa.verifySetup("123456", "setup.token");

    expect(result).toEqual({ success: true, backupCodes: ["abc", "def"] });
  });

  it("uses stored mfaSetupToken from login when no token provided", async () => {
    const loginFetch = mockResponse({ mfaSetupToken: "stored.setup.token" });
    vi.stubGlobal("fetch", loginFetch);
    const client = makeClient();
    await client.auth.login("user@example.com", "password");

    const verifyFetch = mockResponse({ success: true, backupCodes: [] });
    vi.stubGlobal("fetch", verifyFetch);

    await client.auth.mfa.verifySetup("123456");

    const call = (verifyFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = new Headers(call[1].headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("MfaSetup stored.setup.token");
  });

  it("throws GatekeyApiError on invalid TOTP code during setup", async () => {
    vi.stubGlobal("fetch", mockResponse({ error: "invalid_code" }, 400));
    const client = makeClient();

    await expect(client.auth.mfa.verifySetup("000000", "setup.token")).rejects.toThrow(GatekeyApiError);
  });
});
