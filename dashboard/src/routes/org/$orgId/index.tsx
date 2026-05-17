import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../../__root'
import { OrgPage } from './org-page'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/org/$orgId',
  component: OrgPage,
})
