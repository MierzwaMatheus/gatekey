import { useEffect, useState, useRef } from 'react'
import { Copy, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { listApiKeys, createApiKey, revokeApiKey, type ApiKeySummary, type ApiKeyCreated } from '../../lib/org-api'

const ALL_SCOPES = [
  'users:read',
  'users:write',
  'bindings:read',
  'bindings:write',
  'roles:read',
  'roles:write',
  'sessions:write',
  'check',
  'audit:read',
]

function maskPublicId(publicId: string): string {
  if (publicId.length <= 16) return publicId
  return `${publicId.slice(0, 16)}••••`
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/* SVG de chave com dentes = escopos ativos */
function ApiKeyVisual({ scopes }: { scopes: string[] }) {
  const teethCount = ALL_SCOPES.length
  const teethWidth = 8
  const gap = 4
  const startX = 48
  const svgWidth = startX + teethCount * (teethWidth + gap) + 16
  const toothHeight = 10

  return (
    <svg
      width={svgWidth}
      height="32"
      viewBox={`0 0 ${svgWidth} 32`}
      fill="none"
      aria-label="Representação visual dos escopos da API Key"
      className="my-1"
    >
      {/* Cabo */}
      <rect x="4" y="10" width="36" height="12" rx="6" fill="#30363D" />
      <circle cx="16" cy="16" r="4" fill="#1C2333" />
      {/* Haste */}
      <rect x="38" y="14" width={svgWidth - 42} height="4" fill="#30363D" rx="1" />
      {/* Dentes */}
      {ALL_SCOPES.map((scope, i) => {
        const active = scopes.includes(scope)
        const x = startX + i * (teethWidth + gap)
        return (
          <rect
            key={scope}
            x={x}
            y="18"
            width={teethWidth}
            height={toothHeight}
            rx="1"
            fill={active ? '#F0A500' : '#30363D'}
            opacity={active ? 1 : 0.4}
          >
            <title>{scope}</title>
          </rect>
        )
      })}
    </svg>
  )
}

function CreateApiKeyForm({ token, onSuccess }: { token: string; onSuccess: (key: ApiKeyCreated) => void }) {
  const { t } = useTranslation('common')
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleScope(scope: string) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await createApiKey(token, { scopes: selectedScopes, description })
      onSuccess(result)
      setSelectedScopes([])
      setDescription('')
    } catch (err) {
      const msg = (err as Error).message ?? ''
      setError(msg === 'QuotaExceeded' ? t('apikeys.quota_exceeded') : t('apikeys.error_load'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" data-testid="create-api-key-form">
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t('apikeys.description_placeholder')}
        className="w-full px-3 py-2 text-sm bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent"
      />
      <div>
        <p className="text-[12px] text-text-secondary mb-2">{t('apikeys.scopes_label')}</p>
        <div className="flex flex-wrap gap-2">
          {ALL_SCOPES.map((scope) => (
            <label
              key={scope}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-badge border cursor-pointer transition-colors select-none"
              style={{
                borderColor: selectedScopes.includes(scope) ? 'rgba(240,165,0,0.4)' : 'rgba(48,54,61,1)',
                background: selectedScopes.includes(scope) ? 'rgba(240,165,0,0.12)' : 'transparent',
              }}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selectedScopes.includes(scope)}
                onChange={() => toggleScope(scope)}
              />
              <span className={`text-[11px] font-mono ${selectedScopes.includes(scope) ? 'text-accent-primary' : 'text-text-secondary'}`}>
                {scope}
              </span>
            </label>
          ))}
        </div>
      </div>
      {error && <p className="text-[12px] text-status-deny">{error}</p>}
      <button
        type="submit"
        disabled={loading || selectedScopes.length === 0}
        className="px-4 py-2 bg-accent-primary text-black text-sm font-medium rounded-button hover:bg-accent-hover transition-colors disabled:opacity-60 cursor-pointer"
      >
        {loading ? t('apikeys.creating') : t('apikeys.create')}
      </button>
    </form>
  )
}

function ApiKeyCreatedModal({ keyData, onClose }: { keyData: ApiKeyCreated; onClose: () => void }) {
  const { t } = useTranslation('common')
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(keyData.secret).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface-card border border-border-default rounded-card shadow-float p-6 w-full max-w-md">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 flex items-center justify-center bg-status-warning/15 rounded-badge">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2L14 13H2L8 2Z" stroke="#E3B341" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
              <line x1="8" y1="7" x2="8" y2="10" stroke="#E3B341" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="12" r="0.75" fill="#E3B341" />
            </svg>
          </div>
          <h2 className="text-[15px] font-medium text-text-primary">{t('apikeys.created_title')}</h2>
        </div>
        <p className="text-[13px] text-status-warning mb-4 font-medium">
          {t('apikeys.secret_copy_warning')}
        </p>
        <div className="bg-surface-elevated border border-border-default rounded-input p-3 flex items-center justify-between gap-3 mb-5">
          <span className="font-mono text-[12px] text-text-primary break-all">{keyData.secret}</span>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] text-text-secondary border border-border-default rounded-[4px] hover:bg-surface-hover transition-colors cursor-pointer"
          >
            {copied ? <Check size={12} className="text-status-allow" /> : <Copy size={12} />}
            {copied ? t('apikeys.copied') : t('apikeys.copy')}
          </button>
        </div>
        <div className="text-[12px] text-text-secondary space-y-1 mb-5">
          <p><span className="text-text-primary">ID:</span> <span className="font-mono">{keyData.publicId}</span></p>
          <p><span className="text-text-primary">{t('apikeys.scopes')}</span> {keyData.scopes.join(', ') || '—'}</p>
        </div>
        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-surface-elevated border border-border-default text-text-primary text-sm rounded-button hover:bg-surface-hover transition-colors cursor-pointer"
        >
          {t('apikeys.close_modal')}
        </button>
      </div>
    </div>
  )
}

function RevokeModal({ keyId, onConfirm, onCancel, loading }: {
  keyId: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  const { t } = useTranslation('common')
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-surface-card border border-border-default rounded-card shadow-float p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-medium text-text-primary mb-2">{t('apikeys.revoke_title')}</h2>
        <p className="text-[13px] text-text-secondary mb-5">
          <span className="font-mono text-status-deny">{maskPublicId(keyId)}</span>
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading} className="px-3 py-1.5 text-[13px] text-text-secondary border border-border-default rounded-button hover:bg-surface-hover cursor-pointer disabled:opacity-60">{t('apikeys.revoke_cancel')}</button>
          <button onClick={onConfirm} disabled={loading} className="px-3 py-1.5 text-[13px] text-black bg-status-deny rounded-button hover:opacity-90 cursor-pointer disabled:opacity-60">
            {loading ? t('apikeys.revoking') : t('apikeys.revoke_confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ApiKeysListProps {
  token: string
}

export function ApiKeysList({ token }: ApiKeysListProps) {
  const { t } = useTranslation('common')
  const [keys, setKeys] = useState<ApiKeySummary[] | null>(null)
  const [error, setError] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null)
  const [revokeLoading, setRevokeLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  function load() {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setError(false)
    listApiKeys(token)
      .then((data) => { if (!ac.signal.aborted) setKeys(data) })
      .catch(() => { if (!ac.signal.aborted) setError(true) })
  }

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [token])

  async function handleRevoke() {
    if (!revokeTarget) return
    setRevokeLoading(true)
    try {
      await revokeApiKey(token, revokeTarget)
      setRevokeTarget(null)
      load()
    } catch {
      // noop
    } finally {
      setRevokeLoading(false)
    }
  }

  if (error) return <div className="py-8 text-center text-sm text-status-deny">{t('apikeys.error_load')}</div>

  if (keys === null) {
    return <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-24 bg-surface-elevated animate-pulse rounded-card" />)}</div>
  }

  return (
    <div className="space-y-5">
      {/* Lista de keys */}
      {keys.length === 0 && !showCreate && (
        <p className="text-[13px] text-text-secondary">{t('apikeys.none')}</p>
      )}

      <div className="space-y-3" data-testid="api-keys-list">
        {keys.map((key) => (
          <div
            key={key._id}
            className="bg-surface-card border border-border-default rounded-card shadow-card p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[13px] text-text-primary">{maskPublicId(key.publicId)}</span>
                  <span
                    className={[
                      'px-1.5 py-0.5 text-[10px] font-medium rounded-pill',
                      key.status === 'active'
                        ? 'bg-status-allow/15 text-status-allow'
                        : 'bg-status-deny/15 text-status-deny',
                    ].join(' ')}
                  >
                    {key.status.toUpperCase()}
                  </span>
                </div>
                {key.description && (
                  <p className="text-[12px] text-text-secondary mb-1">{key.description}</p>
                )}
                <ApiKeyVisual scopes={key.scopes} />
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {key.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="px-2 py-0.5 text-[10px] font-mono text-accent-primary bg-accent-subtle rounded-badge"
                    >
                      {scope}
                    </span>
                  ))}
                  {key.scopes.length === 0 && (
                    <span className="text-[11px] text-text-secondary">{t('apikeys.no_scopes')}</span>
                  )}
                </div>
                {key.lastUsedAt && (
                  <p className="text-[11px] text-text-secondary mt-1.5 font-mono">
                    {t('apikeys.last_used')} {formatRelativeTime(key.lastUsedAt)}
                  </p>
                )}
              </div>
              {key.status === 'active' && (
                <button
                  onClick={() => setRevokeTarget(key._id)}
                  className="flex-shrink-0 px-2.5 py-1 text-[11px] text-status-deny border border-status-deny/30 rounded-[4px] hover:bg-status-deny/10 transition-colors cursor-pointer"
                >
                  {t('apikeys.revoke')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Criar nova key */}
      <div className="border-t border-border-default pt-5">
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent-primary text-black text-sm font-medium rounded-button hover:bg-accent-hover transition-colors cursor-pointer"
          >
            {t('apikeys.create_btn')}
          </button>
        ) : (
          <div>
            <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide mb-3">{t('apikeys.new_key')}</p>
            <CreateApiKeyForm
              token={token}
              onSuccess={(key) => {
                setCreatedKey(key)
                setShowCreate(false)
                load()
              }}
            />
          </div>
        )}
      </div>

      {createdKey && (
        <ApiKeyCreatedModal keyData={createdKey} onClose={() => setCreatedKey(null)} />
      )}

      {revokeTarget && (
        <RevokeModal
          keyId={revokeTarget}
          onConfirm={handleRevoke}
          onCancel={() => setRevokeTarget(null)}
          loading={revokeLoading}
        />
      )}
    </div>
  )
}
