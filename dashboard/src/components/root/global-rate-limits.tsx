import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getGlobalRateLimits, updateGlobalRateLimits } from '../../lib/root-api'

interface GlobalRateLimitsProps {
  token: string
}

export function GlobalRateLimits({ token }: GlobalRateLimitsProps) {
  const { t } = useTranslation('common')
  const [checkPerMin, setCheckPerMin] = useState(100)
  const [checkBatchPerMin, setCheckBatchPerMin] = useState(20)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getGlobalRateLimits(token)
      .then((data) => {
        setCheckPerMin(data.checkPerMin)
        setCheckBatchPerMin(data.checkBatchPerMin)
      })
      .finally(() => setLoading(false))
  }, [token])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      await updateGlobalRateLimits(token, { checkPerMin, checkBatchPerMin })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-10 bg-surface-elevated animate-pulse rounded-card" />)}</div>
  }

  return (
    <div className="max-w-md space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[12px] text-text-secondary mb-1 block">{t('global_rl.check_per_min')}</label>
          <input
            data-testid="input-global-check-per-min"
            type="number"
            min={1}
            value={checkPerMin}
            onChange={(e) => setCheckPerMin(Math.max(1, Number(e.target.value)))}
            className="w-full px-3 py-2 text-sm font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary focus:outline-none focus:border-border-accent"
          />
        </div>
        <div>
          <label className="text-[12px] text-text-secondary mb-1 block">{t('global_rl.check_batch_per_min')}</label>
          <input
            data-testid="input-global-check-batch-per-min"
            type="number"
            min={1}
            value={checkBatchPerMin}
            onChange={(e) => setCheckBatchPerMin(Math.max(1, Number(e.target.value)))}
            className="w-full px-3 py-2 text-sm font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary focus:outline-none focus:border-border-accent"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          data-testid="btn-save-global-rl"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-accent-primary text-black text-sm font-medium rounded-button hover:bg-accent-hover transition-colors disabled:opacity-60 cursor-pointer"
        >
          {saving ? t('global_rl.saving') : t('global_rl.save')}
        </button>
        {saved && <span className="text-[13px] text-status-allow">{t('global_rl.saved')}</span>}
      </div>
    </div>
  )
}
