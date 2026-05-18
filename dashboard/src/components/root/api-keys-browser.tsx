import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { listApiKeys, type ApiKeySummary } from '../../lib/root-api'

/* Chave SVG com dentes = escopos ativos */
const ALL_SCOPES = [
  'check',
  'users:read',
  'users:write',
  'bindings:read',
  'bindings:write',
  'sessions:write',
  'audit:read',
  'roles:read',
  'roles:write',
]

function KeySvg({ keyId, scopes }: { keyId: string; scopes: string[] }) {
  const toothW = 8
  const toothH = 12
  const gap = 10
  const startX = 52
  const baseY = 20

  return (
    <svg
      data-testid={`key-svg-${keyId}`}
      width="180"
      height="40"
      viewBox="0 0 180 40"
      fill="none"
      aria-hidden="true"
    >
      {/* Cabo */}
      <rect x="4" y="14" width="44" height="12" rx="6" fill="#30363D" />
      {/* Haste */}
      <rect x="44" y="18" width="130" height="4" rx="2" fill="#30363D" />
      {/* Dentes — cada dente é um escopo */}
      {ALL_SCOPES.map((scope, i) => {
        const active = scopes.includes(scope)
        return (
          <rect
            key={scope}
            x={startX + i * (toothW + gap - toothW)}
            y={baseY}
            width={toothW}
            height={toothH}
            rx="2"
            fill={active ? '#F0A500' : '#30363D'}
            opacity={active ? 1 : 0.3}
          />
        )
      })}
    </svg>
  )
}

function maskPublicId(id: string): string {
  if (id.length <= 20) return id
  return id.slice(0, 20) + '••••'
}

function LoadingSkeleton() {
  return (
    <div data-testid="apikeys-loading" className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="p-4 rounded-card bg-surface-card border border-border-default space-y-3">
          <div className="h-3 w-48 bg-surface-elevated rounded animate-pulse" />
          <div className="h-8 w-44 bg-surface-elevated rounded animate-pulse" />
          <div className="flex gap-2">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-5 w-20 bg-surface-elevated rounded-badge animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  const { t } = useTranslation('common')
  return (
    <div data-testid="apikeys-empty" className="flex flex-col items-center justify-center py-16 gap-3">
      <KeyRound size={32} className="text-text-secondary" />
      <p className="text-sm text-text-secondary">{t('apikeys.none_browser')}</p>
    </div>
  )
}

interface ApiKeysBrowserProps {
  token: string
}

export function ApiKeysBrowser({ token }: ApiKeysBrowserProps) {
  const { t } = useTranslation('common')
  const [keys, setKeys] = useState<ApiKeySummary[] | null>(null)

  useEffect(() => {
    let cancelled = false
    listApiKeys(token)
      .then((data) => { if (!cancelled) setKeys(data) })
      .catch(() => { if (!cancelled) setKeys([]) })
    return () => { cancelled = true }
  }, [token])

  if (keys === null) return <LoadingSkeleton />
  if (keys.length === 0) return <EmptyState />

  return (
    <div className="space-y-3">
      {keys.map((key) => (
        <div
          key={key._id}
          data-testid={`apikey-card-${key._id}`}
          className="p-4 rounded-card bg-surface-card border border-border-default shadow-card hover:shadow-hover transition-shadow space-y-3"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <span
              data-testid={`apikey-publicid-${key._id}`}
              className="text-[13px] font-mono text-text-primary"
            >
              {maskPublicId(key.publicId)}
            </span>
            <span
              data-testid={`apikey-status-${key._id}`}
              className={`text-[10px] font-mono px-2 py-0.5 rounded-pill ${
                key.status === 'active'
                  ? 'bg-status-allow/15 text-status-allow'
                  : 'bg-status-deny/15 text-status-deny'
              }`}
            >
              {key.status === 'active' ? 'ACTIVE' : 'REVOKED'}
            </span>
          </div>

          {key.description && (
            <p className="text-[12px] text-text-secondary">{key.description}</p>
          )}

          {/* Chave SVG com dentes = escopos */}
          <KeySvg keyId={key._id} scopes={key.scopes} />

          {/* Scope pills */}
          <div className="flex flex-wrap gap-1.5">
            {key.scopes.map((scope) => (
              <span
                key={scope}
                data-testid={`scope-${scope}-${key._id}`}
                className="inline-flex items-center px-2 py-0.5 rounded-badge bg-accent-subtle text-accent-primary font-mono text-[10px]"
              >
                {scope}
              </span>
            ))}
          </div>

          {key.lastUsedAt && (
            <p className="text-[11px] font-mono text-text-muted">
              {t('apikeys.last_used')} {new Date(key.lastUsedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
