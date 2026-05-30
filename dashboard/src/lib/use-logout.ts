import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from './auth-context'
import { authService } from './auth-service'

export function useLogout() {
  const { token, clearAuth } = useAuth()
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function handleLogout() {
    setIsLoggingOut(true)
    try {
      if (token) {
        await authService.logout(token)
      }
    } finally {
      clearAuth()
      setIsLoggingOut(false)
      navigate({ to: '/login' })
    }
  }

  return { handleLogout, isLoggingOut }
}
