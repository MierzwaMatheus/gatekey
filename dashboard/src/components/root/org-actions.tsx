import { useState } from 'react'
import { Pause, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { suspendOrg, deleteOrg } from '../../lib/root-api'

interface OrgActionsProps {
  token: string
  org: { _id: string; name: string; status: string }
  onDone: () => void
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface-card border border-border-default rounded-card shadow-float w-full max-w-md p-6">
        {children}
      </div>
    </div>
  )
}

export function OrgActions({ token, org, onDone }: OrgActionsProps) {
  const { t } = useTranslation('common')
  const [showSuspend, setShowSuspend] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSuspend() {
    setLoading(true)
    try {
      await suspendOrg(token, org._id)
      setShowSuspend(false)
      onDone()
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setLoading(true)
    try {
      await deleteOrg(token, org._id)
      setShowDelete(false)
      setConfirmName('')
      onDone()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          data-testid="btn-suspend-org"
          onClick={() => setShowSuspend(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors cursor-pointer"
        >
          <Pause size={13} />
          {t('org_actions.suspend')}
        </button>
        <button
          data-testid="btn-delete-org"
          onClick={() => setShowDelete(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-status-deny border border-status-deny/30 rounded-button hover:bg-status-deny/10 transition-colors cursor-pointer"
        >
          <Trash2 size={13} />
          {t('org_actions.delete_btn')}
        </button>
      </div>

      {/* Modal de Suspensão */}
      {showSuspend && (
        <Modal>
          <div data-testid="modal-suspend" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-text-primary">{t('org_actions.suspend_title')}</h3>
              <button
                onClick={() => setShowSuspend(false)}
                className="text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[13px] text-text-secondary">
              {t('org_actions.suspend_desc')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                data-testid="btn-cancel-suspend"
                onClick={() => setShowSuspend(false)}
                className="px-3 py-1.5 text-sm text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                data-testid="btn-confirm-suspend"
                onClick={handleSuspend}
                disabled={loading}
                className="px-3 py-1.5 text-sm text-status-deny border border-status-deny/40 rounded-button hover:bg-status-deny hover:text-black transition-colors disabled:opacity-60 cursor-pointer"
              >
                {loading ? t('org_actions.suspending') : t('org_actions.suspend_confirm')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Deleção */}
      {showDelete && (
        <Modal>
          <div data-testid="modal-delete" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-text-primary">{t('org_actions.delete_title')}</h3>
              <button
                onClick={() => { setShowDelete(false); setConfirmName('') }}
                className="text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[13px] text-text-secondary">
              {t('org_actions.delete_desc')}{' '}
              <span className="font-mono text-text-primary">{org.name}</span>
            </p>
            <input
              data-testid="input-confirm-name"
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={org.name}
              className="w-full px-3 py-2 text-sm font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent transition-colors"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowDelete(false); setConfirmName('') }}
                className="px-3 py-1.5 text-sm text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                data-testid="btn-confirm-delete"
                onClick={handleDelete}
                disabled={confirmName !== org.name || loading}
                className="px-3 py-1.5 text-sm text-black bg-status-deny rounded-button hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? t('org_actions.deleting') : t('org_actions.delete_confirm')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
