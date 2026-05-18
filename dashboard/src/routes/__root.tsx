import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { useAuthInterceptor } from '../lib/use-auth-interceptor'
import { useAuth } from '../lib/auth-context'
import { ImpersonationBanner } from '../components/root/impersonation-banner'
import { useImpersonationExpiry } from '../lib/use-impersonation-expiry'

export function RootLayout() {
  useAuthInterceptor()
  const { impersonationSession, endImpersonation } = useAuth()
  const [expiryAlert, setExpiryAlert] = useState<string | null>(null)

  const handleExpired = useCallback((message: string) => {
    setExpiryAlert(message)
    setTimeout(() => setExpiryAlert(null), 5000)
  }, [])

  useImpersonationExpiry({ impersonationSession, endImpersonation, onExpired: handleExpired })

  return (
    <>
      {expiryAlert && (
        <div
          data-testid="impersonation-expiry-alert"
          role="alert"
          style={{ background: 'var(--gate-danger)', color: '#fff', padding: '8px 16px', textAlign: 'center' }}
        >
          {expiryAlert}
        </div>
      )}
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
