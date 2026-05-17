import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/root',
  component: () => <div data-testid="root-page">Root Dashboard</div>,
})
