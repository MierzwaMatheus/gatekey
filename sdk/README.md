# @gatekey/sdk

TypeScript SDK para o GateKey — autenticação e autorização baseada em papéis e capabilities.

## Instalação

```bash
npm install @gatekey/sdk
```

## Inicialização

```typescript
import { GatekeyClient } from "@gatekey/sdk";

const client = new GatekeyClient({
  baseUrl: "https://your-gatekey-instance.convex.site",
  // apiKey: "gk_live_pk_..." // opcional — alternativa ao login com email/senha
});
```

## Autenticação

### Login com email e senha

```typescript
const result = await client.auth.login("user@example.com", "password");

switch (result.type) {
  case "success":
    // Tokens armazenados automaticamente no cliente
    console.log(result.accessToken);
    break;

  case "mfa_challenge":
    // Usuário tem MFA ativo — solicitar código TOTP
    const tokens = await client.auth.mfa.challenge(result.mfaToken, totpCode);
    break;

  case "mfa_setup_required":
    // Usuário precisa configurar MFA antes de continuar
    const { secret, qrCode } = await client.auth.mfa.setup();
    // Exibir QR code para o usuário escanear com o app autenticador
    const { backupCodes } = await client.auth.mfa.verifySetup(totpCode);
    break;
}
```

### Fluxo MFA — Challenge (usuário já tem MFA configurado)

```typescript
const loginResult = await client.auth.login("user@example.com", "password");
// loginResult.type === "mfa_challenge"

const { accessToken, refreshToken } = await client.auth.mfa.challenge(
  loginResult.mfaToken,
  "123456" // código TOTP de 6 dígitos
);
```

### Fluxo MFA — Setup obrigatório (primeiro login ou org exige MFA)

```typescript
const loginResult = await client.auth.login("user@example.com", "password");
// loginResult.type === "mfa_setup_required"

// O mfaSetupToken é armazenado automaticamente pelo cliente
const { secret, qrCode } = await client.auth.mfa.setup();
// Exibir qrCode ao usuário para escanear com Google Authenticator, Authy, etc.

const { backupCodes } = await client.auth.mfa.verifySetup("123456");
// Guardar backupCodes de forma segura
```

### Refresh e Logout

```typescript
// Refresh manual (normalmente automático via interceptor)
await client.auth.refresh();

// Logout
await client.auth.logout();
```

O cliente faz refresh automático do access token quando ele expira em menos de 60 segundos.

## Verificação de permissões

```typescript
// Verificação simples
const { allow } = await client.permissions.check("users:read");

// Com tipo e ID de recurso
const { allow, reason } = await client.permissions.check(
  "documents:edit",
  "document",
  "doc-abc123"
);

// Com generics para autocomplete (definir seus tipos no projeto)
type MyCapability = "users:read" | "users:write" | "documents:read";
type MyResource = "document" | "folder";

const result = await client.permissions.check<MyCapability, MyResource>(
  "documents:read",
  "document",
  "doc-123"
);
```

## Usuários

```typescript
// Criar usuário
const user = await client.users.create({
  email: "novo@example.com",
  password: "senha-segura",
  role: "member",
});

// Buscar por ID
const user = await client.users.get("user-id");

// Listar todos
const users = await client.users.list();

// Atualizar
await client.users.update("user-id", { email: "novo-email@example.com" });

// Deletar
await client.users.delete("user-id");
```

## Roles

```typescript
// Listar roles de um workspace
const roles = await client.roles.list("workspace-id");

// Criar role
const role = await client.roles.create({
  name: "editor",
  workspaceId: "workspace-id",
});

// Deletar (falha com GatekeyApiError status 409 se houver bindings ativos)
await client.roles.delete("role-id");
```

## Bindings

```typescript
// Listar bindings
const bindings = await client.bindings.list({ workspaceId: "ws-id" });

// Com filtros opcionais
const bindings = await client.bindings.list({
  workspaceId: "ws-id",
  userId: "user-id",
  resourceType: "document",
});

// Com generics para resourceType tipado
type MyResource = "document" | "folder";
const bindings = await client.bindings.list<MyResource>({
  workspaceId: "ws-id",
  resourceType: "document",
});

// Criar binding
const binding = await client.bindings.create({
  userId: "user-id",
  roleId: "role-id",
  resourceType: "document",
  resourceId: "doc-123", // opcional
  workspaceId: "ws-id",
});

// Deletar
await client.bindings.delete("binding-id", "workspace-id");
```

## API Keys

```typescript
// Listar (não retorna a chave completa por segurança)
const keys = await client.apiKeys.list();

// Criar (a chave completa só é retornada uma vez)
const { id, key } = await client.apiKeys.create({
  scopes: ["check", "users:read"],
  description: "Serviço de backend",
});
// Guardar `key` com segurança — não será exibida novamente

// Revogar
await client.apiKeys.revoke("key-id");
```

## Tratamento de erros

```typescript
import { GatekeyApiError, GatekeyAuthError } from "@gatekey/sdk";

try {
  await client.auth.login("user@example.com", "senha-errada");
} catch (err) {
  if (err instanceof GatekeyApiError) {
    console.log(err.status); // HTTP status code
    console.log(err.code);   // código de erro da API
  }
  if (err instanceof GatekeyAuthError) {
    console.log(err.code); // ex: "not_authenticated", "no_mfa_setup_token"
  }
}
```
