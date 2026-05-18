import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useAuthInterceptor } from '../lib/use-auth-interceptor'
import { useAuth } from '../lib/auth-context'
import { ImpersonationBanner } from '../components/root/impersonation-banner'

export function RootLayout() {
  useAuthInterceptor()
  const { impersonationSession, endImpersonation } = useAuth()

  return (
    <>
      {impersonationSession && (
        <ImpersonationBanner
          impersonating={impersonationSession.targetUser}
          onEnd={() => void endImpersonation()}
        />
      )}
      <Outlet />
    </>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
