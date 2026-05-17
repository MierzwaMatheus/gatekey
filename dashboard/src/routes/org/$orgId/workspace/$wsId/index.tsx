import { createRoute } from '@tanstack/react-router'
import { Route as orgRoute } from '../../index'

export const Route = createRoute({
  getParentRoute: () => orgRoute,
  path: '/workspace/$wsId',
  component: () => <div data-testid="workspace-page">Workspace Dashboard</div>,
})
