import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { saveEnvConfig, saveRootCredentials } from "./config-writer.js";

describe("saveEnvConfig", () => {
  let dir: string;

  beforeEach(async () => {
    dir = join(tmpdir(), `gatekey-test-${Date.now()}`);
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("cria arquivo .env.gatekey com as variáveis fornecidas", async () => {
    await saveEnvConfig(
      {
        instanceName: "my-instance",
        convexUrl: "https://myapp.convex.cloud",
        convexDeployKey: "prod:abc123",
      },
      dir
    );

    const content = await readFile(join(dir, ".env.gatekey"), "utf-8");
    expect(content).toContain("GATEKEY_INSTANCE_NAME=my-instance");
    expect(content).toContain("CONVEX_URL=https://myapp.convex.cloud");
    expect(content).toContain("CONVEX_DEPLOY_KEY=prod:abc123");
  });

  it("inclui variáveis de cold storage quando fornecidas", async () => {
    await saveEnvConfig(
      {
        instanceName: "my-instance",
        convexUrl: "https://myapp.convex.cloud",
        convexDeployKey: "prod:abc123",
        coldStorage: {
          provider: "r2",
          bucket: "my-bucket",
          accountId: "acc-id",
          accessKeyId: "key-id",
          secretAccessKey: "secret-key",
        },
      },
      dir
    );

    const content = await readFile(join(dir, ".env.gatekey"), "utf-8");
    expect(content).toContain("R2_BUCKET_NAME=my-bucket");
    expect(content).toContain("R2_ACCOUNT_ID=acc-id");
    expect(content).toContain("R2_ACCESS_KEY_ID=key-id");
    expect(content).toContain("R2_SECRET_ACCESS_KEY=secret-key");
  });

  it("não inclui variáveis de cold storage quando omitidas", async () => {
    await saveEnvConfig(
      {
        instanceName: "my-instance",
        convexUrl: "https://myapp.convex.cloud",
        convexDeployKey: "prod:abc123",
      },
      dir
    );

    const content = await readFile(join(dir, ".env.gatekey"), "utf-8");
    expect(content).not.toContain("R2_");
  });
});

describe("saveRootCredentials", () => {
  let dir: string;

  beforeEach(async () => {
    dir = join(tmpdir(), `gatekey-root-test-${Date.now()}`);
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("cria arquivo .gatekey-root com JSON contendo email e password", async () => {
    await saveRootCredentials({ email: "root@example.com", password: "s3cr3t" }, dir);
    const content = await readFile(join(dir, ".gatekey-root"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.email).toBe("root@example.com");
    expect(parsed.password).toBe("s3cr3t");
  });

  it("arquivo .gatekey-root é JSON válido", async () => {
    await saveRootCredentials({ email: "root@example.com", password: "pass" }, dir);
    const content = await readFile(join(dir, ".gatekey-root"), "utf-8");
    expect(() => JSON.parse(content)).not.toThrow();
  });
});
