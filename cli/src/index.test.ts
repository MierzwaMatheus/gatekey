import { describe, expect, it } from "vitest";
import { main } from "./index.js";

describe("main", () => {
  it("é uma função exportada", () => {
    expect(typeof main).toBe("function");
  });

  it("retorna uma Promise", () => {
    // Não executa o fluxo interativo, apenas verifica que main() retorna Promise
    // O fluxo real usa @clack/prompts que requer TTY
    const result = main({ dryRun: true });
    expect(result).toBeInstanceOf(Promise);
    return result;
  });
});
