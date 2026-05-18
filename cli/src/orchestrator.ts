export interface SetupConfig {
  instanceName: string;
  convexUrl: string;
  convexDeployKey: string;
  rootEmail: string;
  rootPasswordHash: string;
  coldStorageProvider?: "r2" | "s3" | "skip";
}

export interface StepRunner {
  deploySchema(config: SetupConfig): Promise<void>;
  generateKeyPair(config: SetupConfig): Promise<{ kid: string }>;
  createRootUser(
    config: SetupConfig
  ): Promise<{ success: true; userId: string } | { success: false; error: string }>;
}

export type SetupResult =
  | { success: true }
  | { success: false; failedStep: string; error?: string; rootAlreadyExists?: boolean };

export interface SetupOptions {
  onRootExists?: () => Promise<boolean>;
}

export async function runSetupSteps(
  config: SetupConfig,
  runner: StepRunner,
  options: SetupOptions = {}
): Promise<SetupResult> {
  try {
    await runner.deploySchema(config);
  } catch (err) {
    return { success: false, failedStep: "deploySchema", error: String(err) };
  }

  try {
    await runner.generateKeyPair(config);
  } catch (err) {
    return { success: false, failedStep: "generateKeyPair", error: String(err) };
  }

  let rootResult: { success: true; userId: string } | { success: false; error: string };
  try {
    rootResult = await runner.createRootUser(config);
  } catch (err) {
    return { success: false, failedStep: "createRootUser", error: String(err) };
  }

  if (!rootResult.success && rootResult.error === "root_user_already_exists") {
    const shouldOverwrite = options.onRootExists ? await options.onRootExists() : false;
    if (!shouldOverwrite) {
      return { success: false, failedStep: "createRootUser", error: rootResult.error, rootAlreadyExists: true };
    }
    // Retry after user confirmed overwrite
    try {
      rootResult = await runner.createRootUser(config);
    } catch (err) {
      return { success: false, failedStep: "createRootUser", error: String(err) };
    }
  }

  if (!rootResult.success) {
    return {
      success: false,
      failedStep: "createRootUser",
      error: rootResult.error,
      rootAlreadyExists: rootResult.error === "root_user_already_exists",
    };
  }

  return { success: true };
}
