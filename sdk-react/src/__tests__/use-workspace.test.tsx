import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { GatekeyProvider } from "../provider.js";
import { useWorkspace } from "../use-workspace.js";
import type { GatekeyClient } from "@gatekey/sdk";

const fakeWorkspace = { id: "ws1", name: "Engineering", orgId: "org1" };

type WorkspaceClient = { workspaces: { get: (id: string) => Promise<Record<string, unknown>> } };

const makeClient = (getImpl: (id: string) => Promise<Record<string, unknown>>) =>
  ({
    workspaces: { get: vi.fn().mockImplementation(getImpl) },
  }) as unknown as GatekeyClient;

function WorkspaceDisplay({ workspaceId }: { workspaceId: string }) {
  const { workspace, loading, error } = useWorkspace(workspaceId);
  if (loading) return <div data-testid="state">loading</div>;
  if (error) return <div data-testid="state">error:{error.message}</div>;
  if (workspace) return <div data-testid="state">ws:{(workspace as typeof fakeWorkspace).name}</div>;
  return <div data-testid="state">none</div>;
}

describe("useWorkspace", () => {
  it("returns loading:true initially", async () => {
    let resolve: (v: Record<string, unknown>) => void = () => {};
    const client = makeClient(() => new Promise((r) => { resolve = r; }));

    render(
      <GatekeyProvider client={client}>
        <WorkspaceDisplay workspaceId="ws1" />
      </GatekeyProvider>
    );

    expect(screen.getByTestId("state").textContent).toBe("loading");
    resolve(fakeWorkspace);
  });

  it("returns workspace data after successful fetch", async () => {
    const client = makeClient(() => Promise.resolve(fakeWorkspace));

    render(
      <GatekeyProvider client={client}>
        <WorkspaceDisplay workspaceId="ws1" />
      </GatekeyProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toBe("ws:Engineering")
    );
  });

  it("returns error when fetch fails", async () => {
    const client = makeClient(() => Promise.reject(new Error("not found")));

    render(
      <GatekeyProvider client={client}>
        <WorkspaceDisplay workspaceId="ws-bad" />
      </GatekeyProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toBe("error:not found")
    );
  });
});
