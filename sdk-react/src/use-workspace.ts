// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { useState, useEffect } from "react";
import type { WorkspaceState } from "./types.js";
import { useGatekey } from "./provider.js";

export function useWorkspace(workspaceId: string): WorkspaceState {
  const client = useGatekey();
  const [state, setState] = useState<WorkspaceState>({ workspace: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    (client as unknown as { workspaces?: { get: (id: string) => Promise<Record<string, unknown>> } })
      .workspaces?.get(workspaceId)
      .then(
        (ws) => { if (!cancelled) setState({ workspace: ws, loading: false, error: null }); },
        (e: unknown) => { if (!cancelled) setState({ workspace: null, loading: false, error: e instanceof Error ? e : new Error(String(e)) }); }
      );
    return () => { cancelled = true; };
  }, [client, workspaceId]);

  return state;
}
