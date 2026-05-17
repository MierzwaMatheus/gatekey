import { Route as rootRoute } from './routes/__root'
import { Route as indexRoute } from './routes/index'
import { Route as loginRoute } from './routes/login'
import { Route as changePasswordRoute } from './routes/change-password'
import { Route as rootIndexRoute } from './routes/root/index'
import { Route as orgIndexRoute } from './routes/org/$orgId/index'
import { Route as workspaceIndexRoute } from './routes/org/$orgId/workspace/$wsId/index'

export const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  changePasswordRoute,
  rootIndexRoute,
  orgIndexRoute.addChildren([workspaceIndexRoute]),
])
