# GateKey

GateKey is a self-hosted authorization and authentication platform. It provides role-based access control (RBAC), JWT authentication, API keys with scopes, audit logging, MFA, magic links, and OAuth — all running on [Convex](https://convex.dev) as the backend.

Designed for teams that need fine-grained permission management without handing off their auth infrastructure to a third party.

## Features

- **RBAC** with hierarchical resource types and capability inheritance
- **JWT RS256** with JWKS endpoint, access + refresh token rotation
- **API Keys** with per-key scope enforcement
- **MFA TOTP** with backup codes
- **Magic link** and OAuth (Google, GitHub) login
- **Audit log** with hot tier (Convex) and cold tier export (R2 / S3)
- **Dashboard** for Root, Org Admin, and Workspace Admin roles
- **SDK** for TypeScript and React
- **CLI** wizard (`npx gatekey init`) for zero-config setup

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+ (`npm install -g pnpm`)
- **Convex CLI** (`npm install -g convex`)
- A [Convex](https://dashboard.convex.dev) account and project (free tier works)

## Quick Start — `npx gatekey init`

The CLI wizard handles the full initial setup interactively:

```bash
npx gatekey init
```

The wizard will prompt for:

1. **Instance name** — a label for this deployment
2. **Convex deployment URL** — found in your Convex dashboard (e.g. `https://happy-animal-123.convex.cloud`)
3. **Convex deploy key** — generated in Convex dashboard under Settings → Deploy Keys
4. **Cold storage provider** — choose `R2`, `S3`, or `skip` (can be configured later)
5. **Cold storage credentials** — bucket name, region, and access keys (if not skipped)
6. **Root user email** — the superadmin account
7. **Root user password** — masked input with confirmation

The wizard then runs these steps automatically:

- Deploys the Convex schema
- Generates the RS256 key pair
- Creates the Root user
- Saves environment config to `.env.gatekey`
- Saves root credentials to `.gatekey-root`

> **Important:** Add `.gatekey-root` to your `.gitignore` immediately. It contains plaintext root credentials.

## First Login

After `npx gatekey init` completes:

1. Start the dashboard:
   ```bash
   cd dashboard
   pnpm install
   pnpm dev
   ```
2. Open `http://localhost:5173` in your browser
3. Log in with the email and password you provided during `gatekey init`
4. You will land on the **Root panel** (`/root`) — from here you can create organizations, manage quotas, view the global audit log, and revoke sessions

## Cold Storage Configuration

Audit events older than 30 days are automatically exported to cold storage. Configure the provider in the Root panel under **Settings → Cold Storage**, or set these environment variables in `.env.gatekey`:

**Cloudflare R2:**
```env
COLD_STORAGE_PROVIDER=r2
R2_BUCKET=gatekey-audit
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
```

**AWS S3:**
```env
COLD_STORAGE_PROVIDER=s3
S3_BUCKET=gatekey-audit
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

Exported files are stored at `{orgId}/{YYYY}/{MM}/{DD}/logs.ndjson.gz`. Download links are pre-signed with a 15-minute TTL and available from the Org Admin panel under **Audit Log → Cold Tier**.

## Integrating `@gatekey/sdk`

Install the SDK in your application:

```bash
npm install @gatekey/sdk
```

Initialize the client:

```ts
import { GatekeyClient } from "@gatekey/sdk";

const client = new GatekeyClient({
  baseUrl: "https://happy-animal-123.convex.cloud",
  apiKey: "gk_live_pk_...", // optional — use for server-side calls
});
```

Authenticate a user:

```ts
const { accessToken } = await client.auth.login("user@example.com", "password");
```

Check a permission:

```ts
const { allowed } = await client.permissions.check(
  "document:read",
  "document",
  "doc_abc123"
);

if (!allowed) {
  throw new Error("Forbidden");
}
```

Other available methods:

```ts
// Users
await client.users.create({ email, name, password, role });
await client.users.get(userId);
await client.users.update(userId, { name });
await client.users.delete(userId);

// Roles
await client.roles.list();
await client.roles.create({ name, capabilities });
await client.roles.delete(roleId);

// Bindings
await client.bindings.list({ userId });
await client.bindings.create({ userId, roleId, resourceType, resourceId });
await client.bindings.delete(bindingId);

// API Keys
await client.apiKeys.list();
await client.apiKeys.create({ description, scopes: ["check", "users:read"] });
await client.apiKeys.revoke(keyId);
```

## Using `@gatekey/react`

Install the React package:

```bash
npm install @gatekey/react @gatekey/sdk
```

Wrap your app with `GatekeyProvider`:

```tsx
import { GatekeyClient } from "@gatekey/sdk";
import { GatekeyProvider } from "@gatekey/react";

const client = new GatekeyClient({ baseUrl: "https://happy-animal-123.convex.cloud" });

export function App() {
  return (
    <GatekeyProvider client={client}>
      <Router />
    </GatekeyProvider>
  );
}
```

Guard a component with `usePermission`:

```tsx
import { usePermission } from "@gatekey/react";

function DeleteButton({ documentId }: { documentId: string }) {
  const { allowed, loading } = usePermission(
    "document:write",
    "document",
    documentId
  );

  if (loading) return null;
  if (!allowed) return null;

  return <button onClick={handleDelete}>Delete</button>;
}
```

Available hooks:

```ts
// Check if the authenticated user has a capability
const { allowed, loading, error } = usePermission("document:read", "document", id);

// Get the authenticated user's profile
const { user, loading } = useUser();

// Get workspace data
const { workspace, loading } = useWorkspace(workspaceId);

// Access the raw GatekeyClient instance
const client = useGatekey();
```

## Playground

The interactive Playground is available in the dashboard under each organization's panel.

Use it to:

- **Explore endpoints** — select any API route to see its description, parameters, and example response
- **Send requests** — choose HTTP method, enter the URL path, edit the JSON body, and select an API Key to authenticate
- **Inspect responses** — syntax-highlighted response body with HTTP status badge
- **Copy as cURL** — generates the equivalent `curl` command for use in a terminal
- **Copy as SDK call** — generates the equivalent TypeScript snippet using `@gatekey/sdk`
- **Session history** — previous requests in the current session are saved and accessible from the history panel

The Playground also links directly to the full OpenAPI documentation at `/v1/docs`.

## License

GateKey is licensed under the [GNU General Public License v3.0](LICENSE).
