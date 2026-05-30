// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { useState, useEffect, useCallback, useRef } from "react";
import type { PermissionState } from "./types.js";
import { useGatekey } from "./provider.js";

export interface UsePermissionOptions {
  pollingInterval?: number;
  revalidateOnFocus?: boolean;
  /** userId to check permissions for. Defaults to the authenticated user when omitted. */
  userId?: string;
  /** workspaceId context for the permission check. */
  workspaceId?: string;
}

export function usePermission(
  capability: string,
  resourceType?: string,
  resourceId?: string,
  options: UsePermissionOptions = {}
): PermissionState {
  const client = useGatekey();
  const [state, setState] = useState<PermissionState>({
    allowed: false,
    loading: true,
    error: null,
  });

  const check = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await client.permissions.check(capability, resourceType, resourceId, {
        userId: options.userId,
        workspaceId: options.workspaceId,
      });
      setState({ allowed: result.allow, loading: false, error: null });
    } catch (e) {
      setState({ allowed: false, loading: false, error: e instanceof Error ? e : new Error(String(e)) });
    }
  }, [client, capability, resourceType, resourceId, options.userId, options.workspaceId]);

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    if (!options.pollingInterval) return;
    const id = setInterval(check, options.pollingInterval);
    return () => clearInterval(id);
  }, [check, options.pollingInterval]);

  const focusRef = useRef(check);
  focusRef.current = check;

  useEffect(() => {
    if (!options.revalidateOnFocus) return;
    const handler = () => focusRef.current();
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [options.revalidateOnFocus]);

  return state;
}
