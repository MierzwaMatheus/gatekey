import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useAuthInterceptor } from '../lib/use-auth-interceptor'
import { useAuth } from '../lib/auth-context'
import { ImpersonationBanner } from '../components/root/impersonation-banner'
import { useImpersonationExpiry } from '../lib/use-impersonation-expiry'

export function RootLayout() {
  useAuthInterceptor()
  const { impersonationSession, endImpersonation } = useAuth()
  useImpersonationExpiry({ impersonationSession, endImpersonation })

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
