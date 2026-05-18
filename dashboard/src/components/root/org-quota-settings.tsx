import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getOrgSettings, updateOrgQuotas, type OrgQuotas } from '../../lib/root-api'

const QUOTA_KEYS: Array<keyof OrgQuotas> = [
  'users_per_org',
  'workspaces_per_org',
  'users_per_workspace',
  'capabilities_per_org',
  'roles_per_workspace',
  'sessions_per_user',
  'api_keys_per_org',
]

/* Grade de quadrinhos segmentados — cada quadrinho = 1 unidade do limite */
function QuotaBar({ limit, quotaKey }: { limit: number; quotaKey: string }) {
  const maxSegments = Math.min(limit, 20) // exibir até 20 segmentos visuais
  const scale = limit / maxSegments

  return (
    <div data-testid={`quota-bar-${quotaKey}`} className="flex items-center gap-[2px]">
      {Array.from({ length: maxSegments }).map((_, i) => (
        <div
          key={i}
          title={`${Math.round((i + 1) * scale)} / ${limit}`}
          className="w-3 h-3 rounded-[2px] bg-accent-primary/70"
          style={{ opacity: 0.4 + (i / maxSegments) * 0.6 }}
        />
      ))}
      <span className="ml-2 text-[11px] font-mono text-text-secondary">{limit}</span>
    </div>
  )
}

interface OrgQuotaSettingsProps {
  token: string
  orgId: string
}

export function OrgQuotaSettings({ token, orgId }: OrgQuotaSettingsProps) {
  const { t } = useTranslation('common')
  const [quotas, setQuotas] = useState<OrgQuotas | null>(null)
  const [values, setValues] = useState<Partial<OrgQuotas>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    getOrgSettings(token, orgId).then(({ quotas: q }) => {
      if (!cancelled) {
        setQuotas(q)
        setValues(q)
      }
    })
    return () => { cancelled = true }
  }, [token, orgId])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      await updateOrgQuotas(token, orgId, values as OrgQuotas)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (!quotas) {
    return (
      <div data-testid="quotas-loading" className="space-y-3">
        {QUOTA_KEYS.map((k) => (
          <div key={k} className="flex items-center justify-between py-2 border-b border-border-default/30">
            <div className="h-3 w-40 bg-surface-elevated rounded animate-pulse" />
            <div className="h-3 w-24 bg-surface-elevated rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {QUOTA_KEYS.map((key) => {
        const current = (values[key] ?? quotas[key]) as number
        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] text-text-secondary">{t(`quotas.${key}`)}</label>
              <input
                data-testid={`quota-${key}`}
                type="number"
                min={1}
                value={current}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                }
                className="w-20 px-2 py-1 text-sm font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary text-right focus:outline-none focus:border-border-accent transition-colors"
              />
            </div>
            <QuotaBar limit={current} quotaKey={key} />
          </div>
        )
      })}

      <div className="flex items-center gap-3 pt-2">
        <button
          data-testid="btn-save-quotas"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-accent-primary text-black rounded-button hover:bg-accent-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving ? t('quotas.saving') : t('quotas.save')}
        </button>
        {saved && (
          <span data-testid="quotas-saved" className="flex items-center gap-1 text-[12px] text-status-allow">
            <Check size={13} />
            {t('quotas.saved')}
          </span>
        )}
      </div>
    </div>
  )
}
