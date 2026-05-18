import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { hashPassword } from "./crypto.js";

describe("hashPassword", () => {
  it("retorna uma string diferente da senha original", async () => {
    const hash = await hashPassword("minha-senha-secreta");
    expect(hash).not.toBe("minha-senha-secreta");
  });

  it("hash gerado é verificável com bcrypt.compare", async () => {
    const plain = "senha-do-root-123";
    const hash = await hashPassword(plain);
    const valid = await bcrypt.compare(plain, hash);
    expect(valid).toBe(true);
  });

  it("senhas diferentes produzem hashes diferentes", async () => {
    const hash1 = await hashPassword("senha-a");
    const hash2 = await hashPassword("senha-b");
    expect(hash1).not.toBe(hash2);
  });

  it("bcrypt.compare retorna false para senha errada", async () => {
    const hash = await hashPassword("correta");
    const valid = await bcrypt.compare("errada", hash);
    expect(valid).toBe(false);
  });
});
