import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import React from "react";
import { GatekeyProvider } from "../provider.js";
import { usePermission } from "../use-permission.js";
import type { GatekeyClient } from "@gatekey/sdk";

function makeClient(checkFn: () => Promise<{ allow: boolean }>) {
  return {
    permissions: { check: vi.fn().mockImplementation(checkFn) },
  } as unknown as GatekeyClient;
}

function PermissionDisplay({ capability, options }: {
  capability: string;
  options?: Parameters<typeof usePermission>[3];
}) {
  const { allowed, loading } = usePermission(capability, undefined, undefined, options);
  return <div data-testid="state">{loading ? "loading" : allowed ? "allowed" : "denied"}</div>;
}

describe("usePermission revalidation", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("revalidates at pollingInterval", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let callCount = 0;
    const client = makeClient(async () => {
      callCount++;
      return { allow: callCount > 1 };
    });

    render(
      <GatekeyProvider client={client}>
        <PermissionDisplay capability="doc:read" options={{ pollingInterval: 500 }} />
      </GatekeyProvider>
    );

    await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1), { timeout: 2000 });
    expect(screen.getByTestId("state").textContent).toBe("denied");

    await act(async () => { vi.advanceTimersByTime(600); });
    await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(2), { timeout: 2000 });
    expect(screen.getByTestId("state").textContent).toBe("allowed");
  }, 10000);

  it("revalidates on window focus when revalidateOnFocus is true", async () => {
    let callCount = 0;
    const client = makeClient(async () => {
      callCount++;
      return { allow: callCount > 1 };
    });

    render(
      <GatekeyProvider client={client}>
        <PermissionDisplay capability="doc:read" options={{ revalidateOnFocus: true }} />
      </GatekeyProvider>
    );

    await waitFor(() => expect(callCount).toBe(1));
    expect(screen.getByTestId("state").textContent).toBe("denied");

    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(callCount).toBe(2));
    expect(screen.getByTestId("state").textContent).toBe("allowed");
  });
});
