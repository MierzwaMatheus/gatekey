import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import type { GatekeyClient } from "@gatekey/sdk";
import type { AuthState } from "./types.js";

const GatekeyContext = createContext<GatekeyClient | null>(null);
export const AuthStateContext = createContext<AuthState>({ type: "unauthenticated" });

// Module-level subscribers for notifyAuthState (one active provider at a time)
type AuthStateListener = (state: AuthState) => void;
const listeners = new Set<AuthStateListener>();

/** Call this after client.auth.login() returns mfa_required / mfa_setup_required */
export function notifyAuthState(state: AuthState): void {
  listeners.forEach((fn) => fn(state));
}

function deriveAuthState(client: GatekeyClient): AuthState {
  try {
    const tokens = (client.auth as unknown as { getTokens?: () => { accessToken: string } | null }).getTokens?.();
    if (!tokens?.accessToken) return { type: "unauthenticated" };
    const payload = tokens.accessToken.split(".")[1];
    const decoded = JSON.parse(atob(payload)) as Record<string, unknown>;
    const userId = typeof decoded.sub === "string" ? decoded.sub : null;
    if (!userId) return { type: "unauthenticated" };
    return { type: "authenticated", userId };
  } catch {
    return { type: "unauthenticated" };
  }
}

export interface GatekeyProviderProps {
  client: GatekeyClient;
  children: React.ReactNode;
  onAuthStateChange?: (state: AuthState) => void;
}

export function GatekeyProvider({ client, children, onAuthStateChange }: GatekeyProviderProps) {
  const [authState, setAuthState] = useState<AuthState>(() => deriveAuthState(client));
  const onChangeRef = useRef(onAuthStateChange);
  onChangeRef.current = onAuthStateChange;

  useEffect(() => {
    // Re-derive from client tokens on mount
    setAuthState(deriveAuthState(client));

    const listener: AuthStateListener = (state) => {
      setAuthState(state);
      onChangeRef.current?.(state);
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, [client]);

  return (
    <GatekeyContext.Provider value={client}>
      <AuthStateContext.Provider value={authState}>
        {children}
      </AuthStateContext.Provider>
    </GatekeyContext.Provider>
  );
}

export function useGatekey(): GatekeyClient {
  const client = useContext(GatekeyContext);
  if (!client) {
    throw new Error("useGatekey must be used within a GatekeyProvider");
  }
  return client;
}
