import { createRootRoute, createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './routes/__root'
import { Route as loginRoute } from './routes/login'
import { Route as rootIndexRoute } from './routes/root/index'
import { Route as orgIndexRoute } from './routes/org/$orgId/index'
import { Route as workspaceIndexRoute } from './routes/org/$orgId/workspace/$wsId/index'

// Build intermediate routes
const orgRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/org',
})

const orgIdRoute = createRoute({
  getParentRoute: () => orgRoute,
  path: '/$orgId',
})

const workspaceRoute = createRoute({
  getParentRoute: () => orgIdRoute,
  path: '/workspace',
})

const wsIdRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/$wsId',
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  rootIndexRoute,
  orgRoute.addChildren([
    orgIdRoute.addChildren([
      orgIndexRoute,
      workspaceRoute.addChildren([
        wsIdRoute.addChildren([
          workspaceIndexRoute,
        ]),
      ]),
    ]),
  ]),
])

export { routeTree }
