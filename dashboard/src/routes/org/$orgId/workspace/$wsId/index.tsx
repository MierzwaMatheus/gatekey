import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/org/$orgId/workspace/$wsId/')({
  component: () => <div data-testid="workspace-page">Workspace Dashboard</div>,
})
