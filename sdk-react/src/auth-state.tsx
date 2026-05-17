import { useContext, createContext } from "react";
import type { AuthState } from "./types.js";

export const AuthStateContext = createContext<AuthState>({ type: "unauthenticated" });

export function useAuthState(): AuthState {
  return useContext(AuthStateContext);
}
