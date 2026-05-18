// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

export { GatekeyClient } from "./client.js";
export { AuthModule } from "./auth.js";
export { MfaModule } from "./mfa.js";
export { PermissionsModule } from "./permissions.js";
export { UsersModule } from "./users.js";
export { RolesModule } from "./roles.js";
export { BindingsModule } from "./bindings.js";
export { ApiKeysModule } from "./api-keys.js";
export { GatekeyAuthError, GatekeyApiError } from "./errors.js";
export type {
  GatekeyClientOptions,
  TokenStore,
  LoginResult,
  MfaChallengeResult,
  MfaSetupInitResult,
  MfaVerifySetupResult,
  CheckResult,
  CreateUserData,
  UpdateUserData,
  UserResponse,
  CreateRoleData,
  RoleResponse,
  BindingFilters,
  CreateBindingData,
  BindingResponse,
  CreateApiKeyData,
  ApiKeyResponse,
  ApiKeyCreatedResponse,
} from "./types.js";
