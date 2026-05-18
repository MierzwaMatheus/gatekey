import { describe, expect, it, vi } from "vitest";
import { validateConvexUrl } from "./validators.js";

describe("validateConvexUrl", () => {
  it("rejeita URL sem protocolo https", async () => {
    const result = await validateConvexUrl("http://example.convex.cloud");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/https/i);
  });

  it("rejeita string vazia", async () => {
    const result = await validateConvexUrl("");
    expect(result.ok).toBe(false);
  });

  it("rejeita URL malformada", async () => {
    const result = await validateConvexUrl("not-a-url");
    expect(result.ok).toBe(false);
  });

  it("retorna ok:true quando health check responde", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
    const result = await validateConvexUrl("https://myapp.convex.cloud");
    expect(result.ok).toBe(true);
  });

  it("retorna ok:false quando health check falha", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false } as Response);
    const result = await validateConvexUrl("https://myapp.convex.cloud");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/health|acess|reach/i);
  });

  it("retorna ok:false quando fetch lança exceção", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ENOTFOUND"));
    const result = await validateConvexUrl("https://bad.convex.cloud");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/reach|connect|ENOTFOUND/i);
  });
});
