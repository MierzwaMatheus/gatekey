// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { useContext } from "react";
import { AuthStateContext } from "./provider.js";
import type { AuthState } from "./types.js";

export { AuthState };
export function useAuthState(): AuthState {
  return useContext(AuthStateContext);
}
