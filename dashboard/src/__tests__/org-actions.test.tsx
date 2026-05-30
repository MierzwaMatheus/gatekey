// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrgActions } from '../components/root/org-actions'
import * as rootApi from '../lib/root-api'

vi.mock('../lib/root-api')

const mockOrg = { _id: 'org1', name: 'Acme Corp', status: 'active' as const }

describe('OrgActions — Suspender', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders suspend and delete buttons', () => {
    render(<OrgActions token="tok" org={mockOrg} onDone={() => {}} />)
    expect(screen.getByTestId('btn-suspend-org')).toBeDefined()
    expect(screen.getByTestId('btn-delete-org')).toBeDefined()
  })

  it('opens suspend confirmation modal on click', async () => {
    render(<OrgActions token="tok" org={mockOrg} onDone={() => {}} />)
    await userEvent.click(screen.getByTestId('btn-suspend-org'))
    expect(screen.getByTestId('modal-suspend')).toBeDefined()
  })

  it('calls suspendOrg and onDone when confirming suspension', async () => {
    vi.mocked(rootApi.suspendOrg).mockResolvedValue(undefined)
    const onDone = vi.fn()
    render(<OrgActions token="tok" org={mockOrg} onDone={onDone} />)
    await userEvent.click(screen.getByTestId('btn-suspend-org'))
    await userEvent.click(screen.getByTestId('btn-confirm-suspend'))
    await waitFor(() => expect(vi.mocked(rootApi.suspendOrg)).toHaveBeenCalledWith('tok', 'org1'))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('closes modal on cancel without calling suspendOrg', async () => {
    render(<OrgActions token="tok" org={mockOrg} onDone={() => {}} />)
    await userEvent.click(screen.getByTestId('btn-suspend-org'))
    await userEvent.click(screen.getByTestId('btn-cancel-suspend'))
    expect(screen.queryByTestId('modal-suspend')).toBeNull()
    expect(vi.mocked(rootApi.suspendOrg)).not.toHaveBeenCalled()
  })
})

describe('OrgActions — Reativar', () => {
  beforeEach(() => vi.clearAllMocks())

  const suspendedOrg = { _id: 'org1', name: 'Acme Corp', status: 'suspended' as const }
  const activeOrg = { _id: 'org1', name: 'Acme Corp', status: 'active' as const }

  it('mostra botão Reativar quando org está suspensa', () => {
    render(<OrgActions token="tok" org={suspendedOrg} onDone={() => {}} />)
    expect(screen.getByTestId('btn-reactivate-org')).toBeDefined()
  })

  it('não mostra botão Reativar quando org está ativa', () => {
    render(<OrgActions token="tok" org={activeOrg} onDone={() => {}} />)
    expect(screen.queryByTestId('btn-reactivate-org')).toBeNull()
  })

  it('mostra botão Suspender quando org está ativa', () => {
    render(<OrgActions token="tok" org={activeOrg} onDone={() => {}} />)
    expect(screen.getByTestId('btn-suspend-org')).toBeDefined()
  })

  it('não mostra botão Suspender quando org está suspensa', () => {
    render(<OrgActions token="tok" org={suspendedOrg} onDone={() => {}} />)
    expect(screen.queryByTestId('btn-suspend-org')).toBeNull()
  })

  it('abre modal de confirmação ao clicar em Reativar', async () => {
    render(<OrgActions token="tok" org={suspendedOrg} onDone={() => {}} />)
    await userEvent.click(screen.getByTestId('btn-reactivate-org'))
    expect(screen.getByTestId('modal-reactivate')).toBeDefined()
  })

  it('chama reactivateOrg e onDone ao confirmar', async () => {
    vi.mocked(rootApi.reactivateOrg).mockResolvedValue(undefined)
    const onDone = vi.fn()
    render(<OrgActions token="tok" org={suspendedOrg} onDone={onDone} />)
    await userEvent.click(screen.getByTestId('btn-reactivate-org'))
    await userEvent.click(screen.getByTestId('btn-confirm-reactivate'))
    await waitFor(() => expect(vi.mocked(rootApi.reactivateOrg)).toHaveBeenCalledWith('tok', 'org1'))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('fecha modal ao cancelar sem chamar reactivateOrg', async () => {
    render(<OrgActions token="tok" org={suspendedOrg} onDone={() => {}} />)
    await userEvent.click(screen.getByTestId('btn-reactivate-org'))
    await userEvent.click(screen.getByTestId('btn-cancel-reactivate'))
    expect(screen.queryByTestId('modal-reactivate')).toBeNull()
    expect(vi.mocked(rootApi.reactivateOrg)).not.toHaveBeenCalled()
  })
})

describe('OrgActions — Revogar sessões', () => {
  beforeEach(() => vi.clearAllMocks())

  const activeOrg = { _id: 'org1', name: 'Acme Corp', status: 'active' as const }

  it('sempre mostra botão Revogar todas as sessões', () => {
    render(<OrgActions token="tok" org={activeOrg} onDone={() => {}} />)
    expect(screen.getByTestId('btn-revoke-sessions')).toBeDefined()
  })

  it('abre modal de confirmação ao clicar em Revogar sessões', async () => {
    render(<OrgActions token="tok" org={activeOrg} onDone={() => {}} />)
    await userEvent.click(screen.getByTestId('btn-revoke-sessions'))
    expect(screen.getByTestId('modal-revoke-sessions')).toBeDefined()
  })

  it('chama revokeOrgSessions e onDone ao confirmar', async () => {
    vi.mocked(rootApi.revokeOrgSessions).mockResolvedValue({ sessionsRevoked: 3 })
    const onDone = vi.fn()
    render(<OrgActions token="tok" org={activeOrg} onDone={onDone} />)
    await userEvent.click(screen.getByTestId('btn-revoke-sessions'))
    await userEvent.click(screen.getByTestId('btn-confirm-revoke-sessions'))
    await waitFor(() => expect(vi.mocked(rootApi.revokeOrgSessions)).toHaveBeenCalledWith('tok', 'org1'))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('fecha modal ao cancelar sem chamar revokeOrgSessions', async () => {
    render(<OrgActions token="tok" org={activeOrg} onDone={() => {}} />)
    await userEvent.click(screen.getByTestId('btn-revoke-sessions'))
    await userEvent.click(screen.getByTestId('btn-cancel-revoke-sessions'))
    expect(screen.queryByTestId('modal-revoke-sessions')).toBeNull()
    expect(vi.mocked(rootApi.revokeOrgSessions)).not.toHaveBeenCalled()
  })
})

describe('OrgActions — Deletar', () => {
  beforeEach(() => vi.clearAllMocks())

  it('opens delete confirmation modal on click', async () => {
    render(<OrgActions token="tok" org={mockOrg} onDone={() => {}} />)
    await userEvent.click(screen.getByTestId('btn-delete-org'))
    expect(screen.getByTestId('modal-delete')).toBeDefined()
  })

  it('confirm button is disabled until org name is typed correctly', async () => {
    render(<OrgActions token="tok" org={mockOrg} onDone={() => {}} />)
    await userEvent.click(screen.getByTestId('btn-delete-org'))
    const confirmBtn = screen.getByTestId('btn-confirm-delete') as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)
    await userEvent.type(screen.getByTestId('input-confirm-name'), 'Acme Corp')
    await waitFor(() => expect((screen.getByTestId('btn-confirm-delete') as HTMLButtonElement).disabled).toBe(false))
  })

  it('confirm button stays disabled with wrong name', async () => {
    render(<OrgActions token="tok" org={mockOrg} onDone={() => {}} />)
    await userEvent.click(screen.getByTestId('btn-delete-org'))
    await userEvent.type(screen.getByTestId('input-confirm-name'), 'Wrong Name')
    const confirmBtn = screen.getByTestId('btn-confirm-delete') as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)
  })

  it('calls deleteOrg and onDone after typing correct name and confirming', async () => {
    vi.mocked(rootApi.deleteOrg).mockResolvedValue(undefined)
    const onDone = vi.fn()
    render(<OrgActions token="tok" org={mockOrg} onDone={onDone} />)
    await userEvent.click(screen.getByTestId('btn-delete-org'))
    await userEvent.type(screen.getByTestId('input-confirm-name'), 'Acme Corp')
    await userEvent.click(screen.getByTestId('btn-confirm-delete'))
    await waitFor(() => expect(vi.mocked(rootApi.deleteOrg)).toHaveBeenCalledWith('tok', 'org1'))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })
})
