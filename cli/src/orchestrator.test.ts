import { describe, expect, it, vi } from "vitest";
import { runSetupSteps, type SetupConfig, type StepRunner } from "./orchestrator.js";

function makeRunner(overrides: Partial<StepRunner> = {}): StepRunner {
  return {
    deploySchema: vi.fn().mockResolvedValue(undefined),
    generateKeyPair: vi.fn().mockResolvedValue({ kid: "test-kid" }),
    createRootUser: vi
      .fn()
      .mockResolvedValue({ success: true, userId: "user-123" }),
    ...overrides,
  };
}

const baseConfig: SetupConfig = {
  instanceName: "test-instance",
  convexUrl: "https://myapp.convex.cloud",
  convexDeployKey: "prod:abc",
  rootEmail: "root@example.com",
  rootPasswordHash: "$2b$12$hashedpassword",
};

describe("runSetupSteps", () => {
  it("chama todos os steps em ordem", async () => {
    const calls: string[] = [];
    const runner = makeRunner({
      deploySchema: vi.fn().mockImplementation(async () => { calls.push("deploySchema"); }),
      generateKeyPair: vi.fn().mockImplementation(async () => { calls.push("generateKeyPair"); return { kid: "k" }; }),
      createRootUser: vi.fn().mockImplementation(async () => { calls.push("createRootUser"); return { success: true, userId: "u" }; }),
    });

    await runSetupSteps(baseConfig, runner);

    expect(calls).toEqual(["deploySchema", "generateKeyPair", "createRootUser"]);
  });

  it("interrompe sequência quando deploySchema lança erro", async () => {
    const runner = makeRunner({
      deploySchema: vi.fn().mockRejectedValue(new Error("deploy failed")),
    });

    const result = await runSetupSteps(baseConfig, runner);

    expect(result.success).toBe(false);
    expect(result.failedStep).toBe("deploySchema");
    expect(runner.generateKeyPair).not.toHaveBeenCalled();
    expect(runner.createRootUser).not.toHaveBeenCalled();
  });

  it("interrompe sequência quando generateKeyPair lança erro", async () => {
    const runner = makeRunner({
      generateKeyPair: vi.fn().mockRejectedValue(new Error("key pair failed")),
    });

    const result = await runSetupSteps(baseConfig, runner);

    expect(result.success).toBe(false);
    expect(result.failedStep).toBe("generateKeyPair");
    expect(runner.createRootUser).not.toHaveBeenCalled();
  });

  it("retorna success:true quando todos os steps passam", async () => {
    const runner = makeRunner();
    const result = await runSetupSteps(baseConfig, runner);
    expect(result.success).toBe(true);
  });

  it("retorna error root_user_already_exists quando Root já existe", async () => {
    const runner = makeRunner({
      createRootUser: vi
        .fn()
        .mockResolvedValue({ success: false, error: "root_user_already_exists" }),
    });

    const result = await runSetupSteps(baseConfig, runner);

    expect(result.success).toBe(false);
    expect(result.rootAlreadyExists).toBe(true);
  });
});
