import { describe, expect, it } from "vitest";
import argon2 from "argon2";
import { hashPassword } from "./crypto.js";

describe("hashPassword", () => {
  it("retorna uma string diferente da senha original", async () => {
    const hash = await hashPassword("minha-senha-secreta");
    expect(hash).not.toBe("minha-senha-secreta");
  });

  it("hash gerado é verificável com argon2.verify", async () => {
    const plain = "senha-do-root-123";
    const hash = await hashPassword(plain);
    const valid = await argon2.verify(hash, plain);
    expect(valid).toBe(true);
  });

  it("senhas diferentes produzem hashes diferentes", async () => {
    const hash1 = await hashPassword("senha-a");
    const hash2 = await hashPassword("senha-b");
    expect(hash1).not.toBe(hash2);
  });

  it("argon2.verify retorna false para senha errada", async () => {
    const hash = await hashPassword("correta");
    const valid = await argon2.verify(hash, "errada");
    expect(valid).toBe(false);
  });
});
