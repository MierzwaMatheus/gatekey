import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/root/')({
  component: () => <div data-testid="root-page">Root Dashboard</div>,
})
