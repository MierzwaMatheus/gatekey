import { useState } from 'react'
import { rotateKey, type RotateKeyResult } from '../../lib/root-api'

interface Rs256KeyRotationProps {
  token: string
}

export function Rs256KeyRotation({ token }: Rs256KeyRotationProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [result, setResult] = useState<RotateKeyResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRotate() {
    setRotating(true)
    setError(null)
    try {
      const res = await rotateKey(token)
      setResult(res)
      setShowConfirm(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRotating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text-primary font-medium">Chave de Assinatura RS256</p>
          <p className="text-xs text-text-secondary mt-0.5">
            Gera um novo par de chaves RSA-256. A chave anterior permanece válida por 24h (overlap).
          </p>
        </div>
        <button
          data-testid="btn-rotate-key"
          onClick={() => { setResult(null); setShowConfirm(true) }}
          className="px-4 py-2 text-sm font-medium border border-[var(--gate-danger)] text-[var(--gate-danger)] rounded-button hover:bg-[var(--gate-danger)]/10 transition-colors cursor-pointer"
        >
          Rotacionar chave RS256
        </button>
      </div>

      {result && (
        <div
          data-testid="rotation-success"
          className="rounded border border-border-default bg-surface-elevated p-4 space-y-2 text-sm"
        >
          <p className="font-medium text-status-allow">Chave rotacionada com sucesso</p>
          <div className="font-mono text-xs text-text-secondary space-y-1">
            <p>Nova chave ID: <span className="text-text-primary">{result.newKeyId}</span></p>
            <p>
              Chave anterior expira em:{' '}
              <span className="text-text-primary">
                {new Date(result.previousKeyExpiresAt).toLocaleString('pt-BR')}
              </span>
            </p>
          </div>
          <p className="text-xs text-[var(--gate-key-dim)]">
            Tokens assinados com a chave anterior ainda são aceitos durante o período de overlap de 24h.
          </p>
        </div>
      )}

      {error && (
        <p data-testid="rotation-error" className="text-sm text-[var(--gate-danger)]">{error}</p>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            data-testid="confirm-rotate-modal"
            className="bg-surface-base border border-border-default rounded-card p-6 max-w-sm w-full mx-4 space-y-4"
          >
            <h3 className="text-sm font-semibold text-text-primary">Rotacionar chave RS256?</h3>
            <div className="text-xs text-text-secondary space-y-2">
              <p>
                Um novo par de chaves RSA-256 será gerado. Todos os novos tokens serão assinados
                com a nova chave.
              </p>
              <p className="text-[var(--gate-key-dim)] font-medium">
                A chave anterior permanece válida por 24h para não invalidar sessões ativas.
                Após esse período, apenas a nova chave será aceita.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                data-testid="btn-cancel-rotate"
                onClick={() => setShowConfirm(false)}
                disabled={rotating}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border-default rounded-button transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                data-testid="btn-confirm-rotate"
                onClick={handleRotate}
                disabled={rotating}
                className="px-4 py-2 text-sm font-medium bg-[var(--gate-danger)] text-white rounded-button hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer"
              >
                {rotating ? 'Rotacionando...' : 'Confirmar rotação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
