import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { GatekeyProvider } from "../provider.js";
import { usePermission } from "../use-permission.js";
import type { GatekeyClient } from "@gatekey/sdk";

const makeClient = (checkImpl: () => Promise<{ allow: boolean }>) =>
  ({
    permissions: { check: vi.fn().mockImplementation(checkImpl) },
  }) as unknown as GatekeyClient;

function PermissionDisplay({ capability }: { capability: string }) {
  const state = usePermission(capability);
  if (state.loading) return <div data-testid="state">loading</div>;
  if (state.error) return <div data-testid="state">error:{state.error.message}</div>;
  return <div data-testid="state">{state.allowed ? "allowed" : "denied"}</div>;
}

describe("usePermission", () => {
  it("returns loading:true initially", async () => {
    let resolve: (v: { allow: boolean }) => void = () => {};
    const client = makeClient(() => new Promise((r) => { resolve = r; }));

    render(
      <GatekeyProvider client={client}>
        <PermissionDisplay capability="doc:read" />
      </GatekeyProvider>
    );

    expect(screen.getByTestId("state").textContent).toBe("loading");
    resolve({ allow: true });
  });

  it("returns allowed:true when check resolves allow", async () => {
    const client = makeClient(() => Promise.resolve({ allow: true }));

    render(
      <GatekeyProvider client={client}>
        <PermissionDisplay capability="doc:read" />
      </GatekeyProvider>
    );

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("allowed"));
  });

  it("returns allowed:false when check resolves deny", async () => {
    const client = makeClient(() => Promise.resolve({ allow: false }));

    render(
      <GatekeyProvider client={client}>
        <PermissionDisplay capability="doc:write" />
      </GatekeyProvider>
    );

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("denied"));
  });

  it("returns error state when check throws", async () => {
    const client = makeClient(() => Promise.reject(new Error("network failure")));

    render(
      <GatekeyProvider client={client}>
        <PermissionDisplay capability="doc:read" />
      </GatekeyProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toBe("error:network failure")
    );
  });
});
