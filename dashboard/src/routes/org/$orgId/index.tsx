import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/org/$orgId/')({
  component: () => <div data-testid="org-page">Org Dashboard</div>,
})
