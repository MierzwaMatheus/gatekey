import { useState } from 'react'
import { Check, HardDrive } from 'lucide-react'

type Provider = 'r2' | 's3' | 'skip'

interface R2Config { accountId: string; bucket: string; accessKey: string; secretKey: string }
interface S3Config { bucket: string; region: string; accessKey: string; secretKey: string }

export function ColdStorageConfig() {
  const [provider, setProvider] = useState<Provider>('skip')
  const [r2, setR2] = useState<R2Config>({ accountId: '', bucket: '', accessKey: '', secretKey: '' })
  const [s3, setS3] = useState<S3Config>({ bucket: '', region: '', accessKey: '', secretKey: '' })
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const inputClass = 'w-full px-3 py-1.5 text-sm font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent transition-colors'

  return (
    <div className="space-y-6">
      {/* Provider selector */}
      <div className="space-y-2">
        <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide">
          Provedor de cold storage
        </p>
        <div className="flex gap-2">
          {(['r2', 's3', 'skip'] as Provider[]).map((p) => (
            <button
              key={p}
              data-testid={`provider-${p}`}
              onClick={() => setProvider(p)}
              className={[
                'px-4 py-2 text-sm rounded-button border transition-colors cursor-pointer',
                provider === p
                  ? 'bg-accent-subtle border-accent-primary text-accent-primary'
                  : 'border-border-default text-text-secondary hover:bg-surface-hover',
              ].join(' ')}
            >
              {p === 'r2' ? 'Cloudflare R2' : p === 's3' ? 'Amazon S3' : 'Pular'}
            </button>
          ))}
        </div>
      </div>

      {/* R2 fields */}
      {provider === 'r2' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-text-secondary">Account ID</label>
              <input data-testid="input-r2-account-id" type="text" placeholder="cf account id" value={r2.accountId} onChange={(e) => setR2({ ...r2, accountId: e.target.value })} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-text-secondary">Bucket</label>
              <input data-testid="input-r2-bucket" type="text" placeholder="my-bucket" value={r2.bucket} onChange={(e) => setR2({ ...r2, bucket: e.target.value })} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-text-secondary">Access Key</label>
              <input data-testid="input-r2-access-key" type="password" placeholder="••••••••" value={r2.accessKey} onChange={(e) => setR2({ ...r2, accessKey: e.target.value })} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-text-secondary">Secret Key</label>
              <input data-testid="input-r2-secret-key" type="password" placeholder="••••••••" value={r2.secretKey} onChange={(e) => setR2({ ...r2, secretKey: e.target.value })} className={inputClass} />
            </div>
          </div>
        </div>
      )}

      {/* S3 fields */}
      {provider === 's3' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-text-secondary">Bucket</label>
              <input data-testid="input-s3-bucket" type="text" placeholder="my-bucket" value={s3.bucket} onChange={(e) => setS3({ ...s3, bucket: e.target.value })} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-text-secondary">Region</label>
              <input data-testid="input-s3-region" type="text" placeholder="us-east-1" value={s3.region} onChange={(e) => setS3({ ...s3, region: e.target.value })} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-text-secondary">Access Key</label>
              <input data-testid="input-s3-access-key" type="password" placeholder="••••••••" value={s3.accessKey} onChange={(e) => setS3({ ...s3, accessKey: e.target.value })} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-text-secondary">Secret Key</label>
              <input data-testid="input-s3-secret-key" type="password" placeholder="••••••••" value={s3.secretKey} onChange={(e) => setS3({ ...s3, secretKey: e.target.value })} className={inputClass} />
            </div>
          </div>
        </div>
      )}

      {provider === 'skip' && (
        <div className="flex items-center gap-2 p-3 rounded-card bg-surface-elevated border border-border-default">
          <HardDrive size={16} className="text-text-secondary" />
          <p className="text-[12px] text-text-secondary">
            Cold storage desabilitado. Logs com mais de 30 dias permanecerão apenas no hot tier.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          data-testid="btn-save-cold-storage"
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium bg-accent-primary text-black rounded-button hover:bg-accent-hover transition-colors cursor-pointer"
        >
          Salvar configuração
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-[12px] text-status-allow">
            <Check size={13} /> Salvo
          </span>
        )}
      </div>
    </div>
  )
}
