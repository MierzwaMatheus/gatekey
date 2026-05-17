# @gatekey/react

Official React SDK for GateKey — hooks and provider for permission checks, auth state, and user/workspace data.

## Installation

```bash
npm install @gatekey/react @gatekey/sdk
```

## Setup

Wrap your app with `GatekeyProvider` and pass a configured `GatekeyClient` instance:

```tsx
import { GatekeyClient } from "@gatekey/sdk";
import { GatekeyProvider } from "@gatekey/react";

const client = new GatekeyClient({ baseUrl: "https://your-convex-url.convex.site" });

function App() {
  return (
    <GatekeyProvider client={client} onAuthStateChange={handleAuthState}>
      <YourApp />
    </GatekeyProvider>
  );
}
```

### Handling MFA state

The `onAuthStateChange` callback is called whenever the auth state changes. Use it to redirect users who need to complete MFA setup before accessing the app:

```tsx
import { GatekeyProvider, useAuthState } from "@gatekey/react";
import { notifyAuthState } from "@gatekey/react";

function App() {
  const handleAuthState = (state) => {
    if (state.type === "mfa_setup_required") {
      // Redirect to MFA setup flow before granting access
      router.push("/mfa-setup?token=" + state.mfaSetupToken);
    }
    if (state.type === "mfa_required") {
      router.push("/mfa-challenge?token=" + state.mfaToken);
    }
  };

  return (
    <GatekeyProvider client={client} onAuthStateChange={handleAuthState}>
      <YourApp />
    </GatekeyProvider>
  );
}

// After calling client.auth.login(), notify the provider of the result:
async function handleLogin(email: string, password: string) {
  const result = await client.auth.login(email, password);
  if (result.type !== "success") {
    notifyAuthState(result); // triggers onAuthStateChange
  }
}
```

### Reading auth state from any component

```tsx
import { useAuthState } from "@gatekey/react";

function Header() {
  const state = useAuthState();

  if (state.type === "unauthenticated") return <LoginButton />;
  if (state.type === "authenticated") return <UserMenu userId={state.userId} />;
  return null;
}
```

## Hooks

### `usePermission(capability, resourceType?, resourceId?, options?)`

Check if the current user has a specific permission.

```tsx
import { usePermission } from "@gatekey/react";

function DocumentEditor({ docId }: { docId: string }) {
  const { allowed, loading, error } = usePermission(
    "document:write",
    "document",
    docId,
    { pollingInterval: 30_000, revalidateOnFocus: true }
  );

  if (loading) return <Spinner />;
  if (!allowed) return <AccessDenied />;
  return <Editor docId={docId} />;
}
```

**Options:**
- `pollingInterval` — re-check permission every N milliseconds
- `revalidateOnFocus` — re-check when the browser tab regains focus

### `useUser()`

Get the currently authenticated user.

```tsx
import { useUser } from "@gatekey/react";

function Profile() {
  const { user, loading, error } = useUser();

  if (loading) return <Spinner />;
  if (error) return <p>Failed to load profile</p>;
  return <p>Hello, {user?.email}</p>;
}
```

### `useWorkspace(workspaceId)`

Get workspace data by ID.

```tsx
import { useWorkspace } from "@gatekey/react";

function WorkspaceHeader({ workspaceId }: { workspaceId: string }) {
  const { workspace, loading } = useWorkspace(workspaceId);

  if (loading) return <Skeleton />;
  return <h1>{(workspace as { name: string })?.name}</h1>;
}
```

### `useGatekey()`

Access the raw `GatekeyClient` instance from any component inside the Provider.

```tsx
import { useGatekey } from "@gatekey/react";

function CreateUser() {
  const client = useGatekey();

  async function handleSubmit(data: CreateUserData) {
    await client.users.create(data);
  }

  return <form onSubmit={...}>...</form>;
}
```
