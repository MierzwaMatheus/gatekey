import { useState, useEffect } from 'react'
import { HardDrive, Copy, Check } from 'lucide-react'

interface ColdStorageDownloadProps {
  token: string
  orgId: string
  isConfigured?: boolean
}

export function ColdStorageDownload({ token, orgId: _orgId, isConfigured = false }: ColdStorageDownloadProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!expiresAt) return
    const update = () => {
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      setSecondsLeft(diff)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  async function handleGenerate() {
    if (!startDate || !endDate) return
    setLoading(true)
    setError(null)
    setDownloadUrl(null)
    try {
      const res = await fetch(`/v1/audit-exports?start=${startDate}&end=${endDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        if (body.error === 'not_found') setError('Nenhum export encontrado para o período selecionado.')
        else if (body.error === 'cold_storage_not_configured') setError('Cold storage não está configurado.')
        else setError('Erro ao gerar link. Tente novamente.')
        return
      }
      const data = await res.json() as { downloadUrl: string; expiresAt: number }
      setDownloadUrl(data.downloadUrl)
      setExpiresAt(data.expiresAt)
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    if (!downloadUrl) return
    navigator.clipboard.writeText(downloadUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    })
  }

  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-14 h-14 flex items-center justify-center bg-surface-elevated rounded-card mb-4">
          <HardDrive size={24} className="text-text-secondary" />
        </div>
        <p className="text-[15px] text-text-primary font-medium mb-2">Cold Storage não configurado</p>
        <p className="text-[13px] text-text-secondary text-center max-w-sm">
          O administrador root deve configurar um provedor de cold storage (R2 ou S3) antes que os exports estejam disponíveis.
        </p>
      </div>
    )
  }

  const minutesLeft = secondsLeft !== null ? Math.ceil(secondsLeft / 60) : null

  return (
    <div className="max-w-md space-y-5">
      <p className="text-[13px] text-text-secondary">
        Selecione o período para gerar um link de download do audit log em cold storage.
        O link expira em 15 minutos.
      </p>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cold-start-date" className="text-[12px] text-text-secondary mb-1 block">Data início</label>
            <input
              id="cold-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface-elevated border border-border-default rounded-input text-text-primary focus:outline-none focus:border-border-accent cursor-pointer"
            />
          </div>
          <div>
            <label htmlFor="cold-end-date" className="text-[12px] text-text-secondary mb-1 block">Data fim</label>
            <input
              id="cold-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface-elevated border border-border-default rounded-input text-text-primary focus:outline-none focus:border-border-accent cursor-pointer"
            />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !startDate || !endDate}
          className="px-4 py-2 bg-accent-primary text-black text-sm font-medium rounded-button hover:bg-accent-hover transition-colors disabled:opacity-60 cursor-pointer"
        >
          {loading ? 'Gerando link…' : 'Gerar link de download'}
        </button>
      </div>

      {error && (
        <p className="text-[13px] text-status-danger">{error}</p>
      )}

      {downloadUrl && expiresAt && (
        <div className="bg-surface-elevated border border-border-default rounded-card p-4 space-y-2">
          <p className="text-[12px] text-text-secondary" data-testid="expiry-countdown">
            Link válido por{' '}
            <span className="text-status-warning font-mono">
              {minutesLeft !== null ? `${minutesLeft} min` : '15 min'}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] text-text-primary truncate flex-1">{downloadUrl}</span>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] text-text-secondary border border-border-default rounded-[4px] hover:bg-surface-hover cursor-pointer"
            >
              {copied ? <Check size={12} className="text-status-allow" /> : <Copy size={12} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
