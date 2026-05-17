import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import { RootPage } from './root-page'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/root',
  component: RootPage,
})
