import { createRoute } from '@tanstack/react-router'
import { Route as orgRoute } from '../../index'
import { WorkspacePage } from './workspace-page'

export const Route = createRoute({
  getParentRoute: () => orgRoute,
  path: '/workspace/$wsId',
  component: WorkspacePage,
})
