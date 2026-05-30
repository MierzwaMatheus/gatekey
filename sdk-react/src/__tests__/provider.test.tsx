// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { GatekeyProvider, useGatekey } from "../provider.js";
import type { GatekeyClient } from "@gatekey/sdk";

const mockClient = { auth: {}, permissions: {}, users: {} } as unknown as GatekeyClient;

function ClientConsumer() {
  const client = useGatekey();
  return <div data-testid="result">{client === mockClient ? "correct-client" : "wrong"}</div>;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (e: Error) => void },
  { caught: boolean }
> {
  state = { caught: false };
  componentDidCatch(error: Error) {
    this.props.onError(error);
    this.setState({ caught: true });
  }
  render() {
    if (this.state.caught) return null;
    return this.props.children;
  }
}

function ThrowingConsumer() {
  useGatekey();
  return null;
}

describe("GatekeyProvider + useGatekey", () => {
  it("returns the client instance when inside Provider", () => {
    render(
      <GatekeyProvider client={mockClient}>
        <ClientConsumer />
      </GatekeyProvider>
    );
    expect(screen.getByTestId("result").textContent).toBe("correct-client");
  });

  it("throws a descriptive error when used outside Provider", () => {
    const consoleError = console.error;
    console.error = vi.fn();

    let caughtError: Error | null = null;
    render(
      <ErrorBoundary onError={(e) => { caughtError = e; }}>
        <ThrowingConsumer />
      </ErrorBoundary>
    );

    console.error = consoleError;
    expect(caughtError).not.toBeNull();
    expect((caughtError as unknown as Error).message).toMatch(/GatekeyProvider/);
  });
});
