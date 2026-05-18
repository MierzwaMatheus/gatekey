import { useEffect } from 'react'
import type { ImpersonationSession } from './auth-context'

interface Props {
  impersonationSession: ImpersonationSession | null
  endImpersonation: () => Promise<void>
  onExpired?: (message: string) => void
}

export function useImpersonationExpiry({ impersonationSession, endImpersonation, onExpired }: Props) {
  useEffect(() => {
    if (!impersonationSession) return

    const interval = setInterval(() => {
      if (impersonationSession.expiresAt < Date.now()) {
        onExpired?.('Sessão de impersonation expirou e foi encerrada automaticamente.')
        void endImpersonation()
      }
    }, 30_000)

    return () => clearInterval(interval)
  }, [impersonationSession, endImpersonation, onExpired])
}
