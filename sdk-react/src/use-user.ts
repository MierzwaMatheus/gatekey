import { useState, useEffect } from "react";
import type { UserState } from "./types.js";
import { useGatekey } from "./provider.js";

function getUserIdFromTokens(client: { auth: { getTokens: () => { accessToken: string } | null } }): string | null {
  try {
    const tokens = client.auth.getTokens();
    if (!tokens?.accessToken) return null;
    const payload = tokens.accessToken.split(".")[1];
    const decoded = JSON.parse(atob(payload)) as Record<string, unknown>;
    return typeof decoded.sub === "string" ? decoded.sub : null;
  } catch {
    return null;
  }
}

export function useUser(): UserState {
  const client = useGatekey();
  const [state, setState] = useState<UserState>({ user: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    const userId = getUserIdFromTokens(client as Parameters<typeof getUserIdFromTokens>[0]);
    const id = userId ?? "me";

    client.users.get(id).then(
      (user) => { if (!cancelled) setState({ user, loading: false, error: null }); },
      (e: unknown) => { if (!cancelled) setState({ user: null, loading: false, error: e instanceof Error ? e : new Error(String(e)) }); }
    );
    return () => { cancelled = true; };
  }, [client]);

  return state;
}
