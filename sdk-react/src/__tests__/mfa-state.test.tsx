import { describe, it, expect, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import React from "react";
import { GatekeyProvider, useGatekey } from "../provider.js";
import { useAuthState } from "../auth-state.js";
import type { GatekeyClient } from "@gatekey/sdk";

type AuthStateType = ReturnType<typeof useAuthState>;

function AuthStateDisplay() {
  const state = useAuthState();
  return <div data-testid="auth-state">{state.type}</div>;
}

describe("useAuthState", () => {
  it("returns unauthenticated when no tokens present", () => {
    const client = {
      auth: { getTokens: vi.fn().mockReturnValue(null) },
    } as unknown as GatekeyClient;

    render(
      <GatekeyProvider client={client}>
        <AuthStateDisplay />
      </GatekeyProvider>
    );

    expect(screen.getByTestId("auth-state").textContent).toBe("unauthenticated");
  });

  it("returns authenticated with userId when valid tokens present", () => {
    // Build a minimal JWT with sub claim
    const payload = btoa(JSON.stringify({ sub: "user-123", exp: 9999999999 }));
    const fakeJwt = `header.${payload}.sig`;

    const client = {
      auth: { getTokens: vi.fn().mockReturnValue({ accessToken: fakeJwt, refreshToken: "rt" }) },
    } as unknown as GatekeyClient;

    render(
      <GatekeyProvider client={client}>
        <AuthStateDisplay />
      </GatekeyProvider>
    );

    expect(screen.getByTestId("auth-state").textContent).toBe("authenticated");
  });
});

describe("GatekeyProvider onAuthStateChange", () => {
  it("calls onAuthStateChange with mfa_required when login returns mfa_required", async () => {
    const onAuthStateChange = vi.fn();
    const client = {
      auth: { getTokens: vi.fn().mockReturnValue(null) },
    } as unknown as GatekeyClient;

    render(
      <GatekeyProvider client={client} onAuthStateChange={onAuthStateChange}>
        <div />
      </GatekeyProvider>
    );

    // Simulate the provider being notified of mfa_required state
    // (this would happen after the app calls client.auth.login and gets mfa_required back)
    // The provider exposes a setAuthState function via a ref/context for app code to call
    // We test this via the exported notifyAuthState helper
    const { notifyAuthState } = await import("../provider.js");

    act(() => {
      notifyAuthState({ type: "mfa_required", mfaToken: "tok123" });
    });

    expect(onAuthStateChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: "mfa_required", mfaToken: "tok123" })
    );
  });

  it("calls onAuthStateChange with mfa_setup_required", async () => {
    const onAuthStateChange = vi.fn();
    const client = {
      auth: { getTokens: vi.fn().mockReturnValue(null) },
    } as unknown as GatekeyClient;

    render(
      <GatekeyProvider client={client} onAuthStateChange={onAuthStateChange}>
        <div />
      </GatekeyProvider>
    );

    const { notifyAuthState } = await import("../provider.js");

    act(() => {
      notifyAuthState({ type: "mfa_setup_required", mfaSetupToken: "setup-tok" });
    });

    expect(onAuthStateChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: "mfa_setup_required" })
    );
  });
});
