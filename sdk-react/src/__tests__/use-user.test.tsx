import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { GatekeyProvider } from "../provider.js";
import { useUser } from "../use-user.js";
import type { GatekeyClient, UserResponse } from "@gatekey/sdk";

const fakeUser: UserResponse = { id: "u1", email: "alice@example.com" };

const makeClient = (getUserImpl: () => Promise<UserResponse>) =>
  ({
    users: { get: vi.fn().mockImplementation(getUserImpl) },
  }) as unknown as GatekeyClient;

function UserDisplay() {
  const { user, loading, error } = useUser();
  if (loading) return <div data-testid="state">loading</div>;
  if (error) return <div data-testid="state">error:{error.message}</div>;
  if (user) return <div data-testid="state">user:{user.email}</div>;
  return <div data-testid="state">none</div>;
}

describe("useUser", () => {
  it("returns loading:true initially", async () => {
    let resolve: (v: UserResponse) => void = () => {};
    const client = makeClient(() => new Promise((r) => { resolve = r; }));

    render(
      <GatekeyProvider client={client}>
        <UserDisplay />
      </GatekeyProvider>
    );

    expect(screen.getByTestId("state").textContent).toBe("loading");
    resolve(fakeUser);
  });

  it("returns user data after successful fetch", async () => {
    const client = makeClient(() => Promise.resolve(fakeUser));

    render(
      <GatekeyProvider client={client}>
        <UserDisplay />
      </GatekeyProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toBe("user:alice@example.com")
    );
  });

  it("returns error when fetch fails", async () => {
    const client = makeClient(() => Promise.reject(new Error("unauthorized")));

    render(
      <GatekeyProvider client={client}>
        <UserDisplay />
      </GatekeyProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toBe("error:unauthorized")
    );
  });
});
