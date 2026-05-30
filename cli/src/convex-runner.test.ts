import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";
import { ConvexRunner } from "./convex-runner.js";
import type { SetupConfig } from "./orchestrator.js";

const baseConfig: SetupConfig = {
  instanceName: "test",
  convexUrl: "https://myapp.convex.cloud",
  convexDeployKey: "prod:abc123",
  rootEmail: "root@example.com",
  rootPasswordHash: "$2b$12$hash",
};

describe("ConvexRunner", () => {
  let runner: ConvexRunner;
  const mockExeca = vi.mocked(execa);

  beforeEach(() => {
    runner = new ConvexRunner();
    vi.clearAllMocks();
  });

  describe("deploySchema", () => {
    it("chama npx convex deploy com a deploy key", async () => {
      mockExeca.mockResolvedValue({ stdout: "", stderr: "" } as never);

      await runner.deploySchema(baseConfig);

      expect(mockExeca).toHaveBeenCalledWith(
        "npx",
        ["convex", "deploy", "--yes"],
        expect.objectContaining({
          env: expect.objectContaining({ CONVEX_DEPLOY_KEY: "prod:abc123" }),
        })
      );
    });

    it("lança erro quando deploy falha", async () => {
      mockExeca.mockRejectedValue(new Error("deploy error"));

      await expect(runner.deploySchema(baseConfig)).rejects.toThrow("deploy error");
    });
  });

  describe("generateKeyPair", () => {
    it("chama npx convex run com internal.jwt.initializeKeyPair", async () => {
      mockExeca.mockResolvedValue({
        stdout: JSON.stringify({ kid: "abc", keyPairId: "id-123" }),
        stderr: "",
      } as never);

      const result = await runner.generateKeyPair(baseConfig);

      expect(mockExeca).toHaveBeenCalledWith(
        "npx",
        ["convex", "run", "internal.jwt.initializeKeyPair", "--prod"],
        expect.objectContaining({
          env: expect.objectContaining({ CONVEX_DEPLOY_KEY: "prod:abc123" }),
        })
      );
      expect(result.kid).toBe("abc");
    });
  });

  describe("createRootUser", () => {
    it("chama npx convex run com internal.setup.bootstrapRootUser e as credenciais", async () => {
      mockExeca.mockResolvedValue({
        stdout: JSON.stringify({ success: true, userId: "user-xyz" }),
        stderr: "",
      } as never);

      const result = await runner.createRootUser(baseConfig);

      expect(mockExeca).toHaveBeenCalledWith(
        "npx",
        expect.arrayContaining([
          "convex",
          "run",
          "internal.setup.bootstrapRootUser",
        ]),
        expect.objectContaining({
          env: expect.objectContaining({ CONVEX_DEPLOY_KEY: "prod:abc123" }),
        })
      );
      expect(result.success).toBe(true);
    });

    it("retorna success:false quando root já existe", async () => {
      mockExeca.mockResolvedValue({
        stdout: JSON.stringify({ success: false, error: "root_user_already_exists" }),
        stderr: "",
      } as never);

      const result = await runner.createRootUser(baseConfig);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("root_user_already_exists");
    });
  });
});
