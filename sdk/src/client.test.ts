import { describe, it, expect } from "vitest";
import { GatekeyClient } from "./client.js";

describe("GatekeyClient", () => {
  it("can be instantiated with baseUrl", () => {
    const client = new GatekeyClient({ baseUrl: "https://example.com" });
    expect(client).toBeInstanceOf(GatekeyClient);
  });

  it("can be instantiated with baseUrl and apiKey", () => {
    const client = new GatekeyClient({
      baseUrl: "https://example.com",
      apiKey: "gk_test_key",
    });
    expect(client).toBeInstanceOf(GatekeyClient);
  });

  it("exposes auth module", () => {
    const client = new GatekeyClient({ baseUrl: "https://example.com" });
    expect(client.auth).toBeDefined();
    expect(typeof client.auth.login).toBe("function");
  });
});
