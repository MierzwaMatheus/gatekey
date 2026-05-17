import { useState, useEffect } from "react";
import type { UserState } from "./types.js";
import { useGatekey } from "./provider.js";

export function useUser(): UserState {
  const client = useGatekey();
  const [state, setState] = useState<UserState>({ user: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    client.users.get("me").then(
      (user) => { if (!cancelled) setState({ user, loading: false, error: null }); },
      (e: unknown) => { if (!cancelled) setState({ user: null, loading: false, error: e instanceof Error ? e : new Error(String(e)) }); }
    );
    return () => { cancelled = true; };
  }, [client]);

  return state;
}
