import React, { createContext, useContext } from "react";
import type { GatekeyClient } from "@gatekey/sdk";

const GatekeyContext = createContext<GatekeyClient | null>(null);

export interface GatekeyProviderProps {
  client: GatekeyClient;
  children: React.ReactNode;
}

export function GatekeyProvider({ client, children }: GatekeyProviderProps) {
  return <GatekeyContext.Provider value={client}>{children}</GatekeyContext.Provider>;
}

export function useGatekey(): GatekeyClient {
  const client = useContext(GatekeyContext);
  if (!client) {
    throw new Error("useGatekey must be used within a GatekeyProvider");
  }
  return client;
}
