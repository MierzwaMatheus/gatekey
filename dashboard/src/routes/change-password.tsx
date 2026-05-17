import { createRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Route as rootRoute } from './__root'
import { useAuth } from '../lib/auth-context'
import { useNavigate } from '@tanstack/react-router'
import { parseJwtPayload } from '../lib/auth-service'
import { resetUserPassword } from '../lib/org-api'

export function ChangePasswordPage() {
  const { token, orgId } = useAuth()
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMismatch, setErrorMismatch] = useState(false)
  const [errorLength, setErrorLength] = useState(false)
  const [errorApi, setErrorApi] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMismatch(false)
    setErrorLength(false)
    setErrorApi(null)

    if (newPassword.length < 8) {
      setErrorLength(true)
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMismatch(true)
      return
    }

    if (!token) return

    setIsLoading(true)
    try {
      const payload = parseJwtPayload(token)
      await resetUserPassword(token, payload.sub, newPassword)
      if (orgId) {
        navigate({ to: '/org/$orgId', params: { orgId } })
      } else {
        navigate({ to: '/root' })
      }
    } catch (err) {
      setErrorApi((err as Error).message ?? 'Erro ao trocar senha')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface-card rounded-card shadow-card p-8 border border-border-default">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-medium text-accent-primary font-mono tracking-tight">
            GateKey
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Troca de senha obrigatória
          </p>
          <p className="mt-2 text-xs text-text-muted">
            Você está usando uma senha temporária. Defina uma nova senha para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-text-secondary mb-1">
              Nova senha
            </label>
            <input
              id="new-password"
              data-testid="input-new-password"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-surface-elevated border border-border-default text-text-primary placeholder:text-text-muted rounded-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-border-accent transition-colors"
            />
            {errorLength && (
              <p data-testid="error-password-length" className="mt-1 text-xs text-status-deny">
                A senha deve ter pelo menos 8 caracteres.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-text-secondary mb-1">
              Confirmar senha
            </label>
            <input
              id="confirm-password"
              data-testid="input-confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-surface-elevated border border-border-default text-text-primary placeholder:text-text-muted rounded-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-border-accent transition-colors"
            />
            {errorMismatch && (
              <p data-testid="error-password-mismatch" className="mt-1 text-xs text-status-deny">
                As senhas não coincidem.
              </p>
            )}
          </div>

          {errorApi && (
            <p data-testid="error-api" className="text-xs text-status-deny">
              {errorApi}
            </p>
          )}

          <button
            data-testid="btn-change-password"
            type="submit"
            disabled={isLoading}
            className="w-full bg-accent-primary text-black font-medium rounded-button py-2 text-sm hover:bg-accent-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Salvando…' : 'Definir nova senha'}
          </button>
        </form>
      </div>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/change-password',
  component: ChangePasswordPage,
})
