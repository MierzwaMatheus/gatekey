import { execa } from "execa";
import type { SetupConfig, StepRunner } from "./orchestrator.js";

export class ConvexRunner implements StepRunner {
  async deploySchema(config: SetupConfig): Promise<void> {
    await execa("npx", ["convex", "deploy", "--yes"], {
      env: { ...process.env, CONVEX_DEPLOY_KEY: config.convexDeployKey },
      stdio: "inherit",
    });
  }

  async generateKeyPair(config: SetupConfig): Promise<{ kid: string }> {
    const { stdout } = await execa(
      "npx",
      ["convex", "run", "internal.jwt.initializeKeyPair", "--prod"],
      {
        env: { ...process.env, CONVEX_DEPLOY_KEY: config.convexDeployKey },
      }
    );
    return JSON.parse(stdout) as { kid: string };
  }

  async createRootUser(
    config: SetupConfig
  ): Promise<{ success: true; userId: string } | { success: false; error: string }> {
    const args = JSON.stringify({
      email: config.rootEmail,
      passwordHash: config.rootPasswordHash,
    });

    const { stdout } = await execa(
      "npx",
      ["convex", "run", "internal.setup.bootstrapRootUser", args, "--prod"],
      {
        env: { ...process.env, CONVEX_DEPLOY_KEY: config.convexDeployKey },
      }
    );
    return JSON.parse(stdout) as
      | { success: true; userId: string }
      | { success: false; error: string };
  }
}
