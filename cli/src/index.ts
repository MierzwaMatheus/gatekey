// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import * as p from "@clack/prompts";
import { hashPassword } from "./crypto.js";
import { saveEnvConfig, saveRootCredentials, type ColdStorageConfig } from "./config-writer.js";
import { ConvexRunner } from "./convex-runner.js";
import { runSetupSteps } from "./orchestrator.js";
import { validateConvexUrl } from "./validators.js";

export interface MainOptions {
  dryRun?: boolean;
}

export async function main(options: MainOptions = {}): Promise<void> {
  if (options.dryRun) return;

  p.intro("gatekey init — configuração da instância GateKey");

  const instanceName = await p.text({
    message: "Nome da instância",
    placeholder: "minha-empresa",
    validate: (v) => (v.trim().length === 0 ? "O nome não pode ser vazio" : undefined),
  });
  if (p.isCancel(instanceName)) { p.cancel("Configuração cancelada."); process.exit(0); }

  const convexUrl = await p.text({
    message: "URL do deployment Convex (ex: https://myapp.convex.cloud)",
    validate: (v) => {
      if (!v.startsWith("https://")) return "A URL deve começar com https://";
      return undefined;
    },
  });
  if (p.isCancel(convexUrl)) { p.cancel("Configuração cancelada."); process.exit(0); }

  const convexDeployKey = await p.password({
    message: "Convex deploy key",
  });
  if (p.isCancel(convexDeployKey)) { p.cancel("Configuração cancelada."); process.exit(0); }

  const coldStorageType = await p.select({
    message: "Tipo de cold storage para audit logs",
    options: [
      { value: "r2", label: "Cloudflare R2" },
      { value: "s3", label: "AWS S3" },
      { value: "skip", label: "Pular (configurar depois)" },
    ],
  });
  if (p.isCancel(coldStorageType)) { p.cancel("Configuração cancelada."); process.exit(0); }

  let coldStorage: ColdStorageConfig | undefined;
  if (coldStorageType === "r2" || coldStorageType === "s3") {
    const bucket = await p.text({ message: "Nome do bucket" });
    if (p.isCancel(bucket)) { p.cancel("Configuração cancelada."); process.exit(0); }

    const accessKeyId = await p.password({ message: "Access Key ID" });
    if (p.isCancel(accessKeyId)) { p.cancel("Configuração cancelada."); process.exit(0); }

    const secretAccessKey = await p.password({ message: "Secret Access Key" });
    if (p.isCancel(secretAccessKey)) { p.cancel("Configuração cancelada."); process.exit(0); }

    let accountId: string | undefined;
    if (coldStorageType === "r2") {
      const id = await p.text({ message: "Account ID do Cloudflare R2" });
      if (p.isCancel(id)) { p.cancel("Configuração cancelada."); process.exit(0); }
      accountId = id;
    }

    coldStorage = {
      provider: coldStorageType,
      bucket,
      accessKeyId,
      secretAccessKey,
      accountId,
    };
  }

  const rootEmail = await p.text({
    message: "Email do usuário Root",
    validate: (v) => (v.includes("@") ? undefined : "Email inválido"),
  });
  if (p.isCancel(rootEmail)) { p.cancel("Configuração cancelada."); process.exit(0); }

  const rootPassword = await p.password({
    message: "Senha do usuário Root",
    validate: (v) => (v.length < 8 ? "A senha deve ter pelo menos 8 caracteres" : undefined),
  });
  if (p.isCancel(rootPassword)) { p.cancel("Configuração cancelada."); process.exit(0); }

  const rootPasswordConfirm = await p.password({
    message: "Confirme a senha do Root",
    validate: (v) => (v !== rootPassword ? "As senhas não coincidem" : undefined),
  });
  if (p.isCancel(rootPasswordConfirm)) { p.cancel("Configuração cancelada."); process.exit(0); }

  const spinner = p.spinner();

  spinner.start("Calculando hash da senha...");
  const rootPasswordHash = await hashPassword(rootPassword);
  spinner.stop("Hash calculado.");

  const runner = new ConvexRunner();

  const result = await runSetupSteps(
    {
      instanceName,
      convexUrl,
      convexDeployKey,
      rootEmail,
      rootPasswordHash,
    },
    runner,
    {
      onRootExists: async () => {
        const confirm = await p.confirm({
          message: "Um usuário Root já existe. Deseja sobrescrever?",
          initialValue: false,
        });
        return confirm === true;
      },
    }
  );

  if (!result.success) {
    p.outro(`Falha no step "${result.failedStep}": ${result.error ?? "erro desconhecido"}`);
    process.exit(1);
  }

  spinner.start("Salvando configurações...");
  await saveEnvConfig({ instanceName, convexUrl, convexDeployKey, coldStorage });
  await saveRootCredentials({ email: rootEmail, password: rootPassword });
  spinner.stop("Configurações salvas.");

  p.note(
    "⚠️  IMPORTANTE: Adicione `.gatekey-root` ao seu `.gitignore` IMEDIATAMENTE.\n" +
    "   Ele contém as credenciais do Root e não deve ser versionado.",
    "Segurança"
  );

  p.outro("Instância GateKey configurada com sucesso! Acesse o dashboard para fazer login.");
}

// Executa apenas quando invocado diretamente (não em testes)
const isMain = process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js");
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
