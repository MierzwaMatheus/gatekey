import { useEffect } from 'react'
import type { ImpersonationSession } from './auth-context'

interface Props {
  impersonationSession: ImpersonationSession | null
  endImpersonation: () => Promise<void>
}

export function useImpersonationExpiry({ impersonationSession, endImpersonation }: Props) {
  useEffect(() => {
    if (!impersonationSession) return

    const interval = setInterval(() => {
      if (impersonationSession.expiresAt < Date.now()) {
        void endImpersonation()
      }
    }, 30_000)

    return () => clearInterval(interval)
  }, [impersonationSession, endImpersonation])
}
