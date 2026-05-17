import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useAuthInterceptor } from '../lib/use-auth-interceptor'

function RootLayout() {
  useAuthInterceptor()
  return <Outlet />
}

export const Route = createRootRoute({
  component: RootLayout,
})
