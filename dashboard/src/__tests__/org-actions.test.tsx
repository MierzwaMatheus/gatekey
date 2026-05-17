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
