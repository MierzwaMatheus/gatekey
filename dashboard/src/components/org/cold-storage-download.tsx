import { useState } from 'react'
import { HardDrive, Copy, Check } from 'lucide-react'

interface ColdStorageDownloadProps {
  token: string
  orgId: string
}

export function ColdStorageDownload({ token: _token, orgId: _orgId }: ColdStorageDownloadProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)

  const isConfigured = false

  async function handleGenerate() {
    if (!startDate || !endDate) return
    setLoading(true)
    try {
      await new Promise((r) => setTimeout(r, 800))
      setDownloadUrl('https://cold-storage.example.com/not-configured')
      setExpiresAt(Date.now() + 15 * 60 * 1000)
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

  return (
    <div className="max-w-md space-y-5">
      <p className="text-[13px] text-text-secondary">
        Selecione o período para gerar um link de download do audit log em cold storage.
        O link expira em 15 minutos.
      </p>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[12px] text-text-secondary mb-1 block">Data início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface-elevated border border-border-default rounded-input text-text-primary focus:outline-none focus:border-border-accent cursor-pointer"
            />
          </div>
          <div>
            <label className="text-[12px] text-text-secondary mb-1 block">Data fim</label>
            <input
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

      {downloadUrl && expiresAt && (
        <div className="bg-surface-elevated border border-border-default rounded-card p-4 space-y-2">
          <p className="text-[12px] text-text-secondary">
            Link válido por <span className="text-status-warning font-mono">15 min</span>
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
