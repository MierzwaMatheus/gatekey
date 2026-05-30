import { createRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Route as rootRoute } from './__root'
import { useAuth } from '../lib/auth-context'
import { useNavigate } from '@tanstack/react-router'
import { parseJwtPayload } from '../lib/auth-service'
import { resetUserPassword } from '../lib/org-api'

function UtcClock() {
  const [time, setTime] = useState(() => {
    const d = new Date()
    return `UTC ${d.toISOString().slice(11, 19)}`
  })
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date()
      setTime(`UTC ${d.toISOString().slice(11, 19)}`)
    }, 1000)
    return () => clearInterval(id)
  }, [])
  return <span>{time}</span>
}

export function ChangePasswordPage() {
  const { t } = useTranslation('auth')
  const { token, orgId } = useAuth()
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMismatch, setErrorMismatch] = useState(false)
  const [errorLength, setErrorLength] = useState(false)
  const [errorApi, setErrorApi] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMismatch(false)
    setErrorLength(false)
    setErrorApi(null)

    if (newPassword.length < 8) { setErrorLength(true); return }
    if (newPassword !== confirmPassword) { setErrorMismatch(true); return }
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
      setErrorApi((err as Error).message ?? t('change_password.error_api_fallback'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center p-4">
      <div className="w-full max-w-[560px] relative" style={{ borderLeft: '3px solid #F0A500' }}>
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-border-accent" />

        <div className="bg-surface-card border border-border-default border-l-0">

          <div className="px-6 py-3 flex items-center justify-between border-b border-border-subtle">
            <span className="font-mono text-[11px] font-semibold tracking-widest text-accent-primary uppercase">
              {t('change_password.header')}
            </span>
            <span className="font-mono text-[10px] tracking-widest text-text-muted uppercase">
              {t('change_password.form_ref')}
            </span>
          </div>

          <div className="px-6 pt-5 pb-5">
            <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase mb-3">
              <span className="text-accent-primary">//</span> {t('change_password.section_label').replace('// ', '')}
            </p>
            <h1 className="text-[26px] font-semibold text-text-primary leading-tight mb-1">
              {t('change_password.title')}
            </h1>
            <p className="font-mono text-[11px] text-text-muted mb-5">
              {t('change_password.subtitle')}
            </p>

            {errorApi && (
              <div data-testid="error-api" role="alert" className="mb-4 px-3 py-2 border border-status-deny text-status-deny font-mono text-[10px] uppercase tracking-wide">
                {errorApi}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-1.5">
                  <span className="text-accent-primary">A</span> {t('change_password.field_new_label')}
                </p>
                <div className="relative flex items-center border border-border-default bg-surface-elevated focus-within:border-border-accent transition-colors">
                  <span className="pl-3 pr-1 font-mono text-[13px] text-accent-primary select-none">›</span>
                  <input
                    id="new-password"
                    data-testid="input-new-password"
                    type={showNew ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder={t('change_password.field_new_placeholder')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="flex-1 bg-transparent py-2.5 text-[13px] font-mono text-text-primary placeholder:text-text-muted focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(v => !v)}
                    className="px-3 font-mono text-[10px] tracking-widest text-text-muted hover:text-text-secondary transition-colors uppercase border-l border-border-default self-stretch flex items-center"
                  >
                    {showNew ? t('change_password.hide') : t('change_password.show')}
                  </button>
                </div>
                {errorLength && (
                  <p data-testid="error-password-length" className="mt-1 font-mono text-[10px] text-status-deny uppercase">
                    {t('change_password.error_length')}
                  </p>
                )}
              </div>

              <div>
                <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase mb-1.5">
                  <span className="text-accent-primary">B</span> {t('change_password.field_confirm_label')}
                </p>
                <div className="relative flex items-center border border-border-default bg-surface-elevated focus-within:border-border-accent transition-colors">
                  <span className="pl-3 pr-1 font-mono text-[13px] text-accent-primary select-none">›</span>
                  <input
                    id="confirm-password"
                    data-testid="input-confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder={t('change_password.field_confirm_placeholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="flex-1 bg-transparent py-2.5 text-[13px] font-mono text-text-primary placeholder:text-text-muted focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="px-3 font-mono text-[10px] tracking-widest text-text-muted hover:text-text-secondary transition-colors uppercase border-l border-border-default self-stretch flex items-center"
                  >
                    {showConfirm ? t('change_password.hide') : t('change_password.show')}
                  </button>
                </div>
                {errorMismatch && (
                  <p data-testid="error-password-mismatch" className="mt-1 font-mono text-[10px] text-status-deny uppercase">
                    {t('change_password.error_mismatch')}
                  </p>
                )}
              </div>

              <div className="pt-1">
                <button
                  data-testid="btn-change-password"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 font-mono text-[11px] font-bold tracking-widest uppercase text-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#F0A500' }}
                >
                  {isLoading ? t('change_password.submit_loading') : t('change_password.submit')}
                </button>
              </div>
            </form>
          </div>

          <div className="px-6 py-2.5 border-t border-border-subtle flex items-center justify-between bg-surface-elevated">
            <span className="font-mono text-[10px] tracking-wide" style={{ color: '#3FB950' }}>
              {t('change_password.status_handshake')}
            </span>
            <span className="font-mono text-[10px] tracking-wide text-text-muted">
              {t('change_password.status_chain')}
            </span>
            <span className="font-mono text-[10px] tracking-wide text-text-muted">
              <UtcClock />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/change-password',
  component: ChangePasswordPage,
})
