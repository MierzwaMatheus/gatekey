import type { UserResponse } from "@gatekey/sdk";

export type AuthState =
  | { type: "unauthenticated" }
  | { type: "authenticated"; userId: string }
  | { type: "mfa_required"; mfaToken: string }
  | { type: "mfa_setup_required"; mfaSetupToken: string };

export interface PermissionState {
  allowed: boolean;
  loading: boolean;
  error: Error | null;
}

export interface UserState {
  user: UserResponse | null;
  loading: boolean;
  error: Error | null;
}

export interface WorkspaceState {
  workspace: Record<string, unknown> | null;
  loading: boolean;
  error: Error | null;
}
