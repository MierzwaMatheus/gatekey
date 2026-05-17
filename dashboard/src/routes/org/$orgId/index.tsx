import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../../__root'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/org/$orgId',
  component: () => <div data-testid="org-page">Org Dashboard</div>,
})
