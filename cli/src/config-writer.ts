import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface ColdStorageConfig {
  provider: "r2" | "s3";
  bucket: string;
  accountId?: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

export interface EnvConfig {
  instanceName: string;
  convexUrl: string;
  convexDeployKey: string;
  coldStorage?: ColdStorageConfig;
}

export async function saveEnvConfig(config: EnvConfig, dir = "."): Promise<void> {
  const lines: string[] = [
    `GATEKEY_INSTANCE_NAME=${config.instanceName}`,
    `CONVEX_URL=${config.convexUrl}`,
    `CONVEX_DEPLOY_KEY=${config.convexDeployKey}`,
  ];

  if (config.coldStorage) {
    const cs = config.coldStorage;
    if (cs.provider === "r2") {
      lines.push(`R2_BUCKET_NAME=${cs.bucket}`);
      if (cs.accountId) lines.push(`R2_ACCOUNT_ID=${cs.accountId}`);
      lines.push(`R2_ACCESS_KEY_ID=${cs.accessKeyId}`);
      lines.push(`R2_SECRET_ACCESS_KEY=${cs.secretAccessKey}`);
    } else {
      lines.push(`AWS_S3_BUCKET=${cs.bucket}`);
      if (cs.region) lines.push(`AWS_REGION=${cs.region}`);
      lines.push(`AWS_ACCESS_KEY_ID=${cs.accessKeyId}`);
      lines.push(`AWS_SECRET_ACCESS_KEY=${cs.secretAccessKey}`);
    }
  }

  await writeFile(join(dir, ".env.gatekey"), lines.join("\n") + "\n", "utf-8");
}

export async function saveRootCredentials(
  credentials: { email: string; password: string },
  dir = "."
): Promise<void> {
  await writeFile(
    join(dir, ".gatekey-root"),
    JSON.stringify(credentials, null, 2) + "\n",
    "utf-8"
  );
}
