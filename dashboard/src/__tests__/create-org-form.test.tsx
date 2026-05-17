import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateOrgForm } from '../components/root/create-org-form'
import * as rootApi from '../lib/root-api'

vi.mock('../lib/root-api')

describe('CreateOrgForm', () => {
  const onSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders name and adminEmail fields', () => {
    render(<CreateOrgForm token="tok" onSuccess={onSuccess} />)
    expect(screen.getByTestId('input-org-name')).toBeDefined()
    expect(screen.getByTestId('input-admin-email')).toBeDefined()
    expect(screen.getByTestId('btn-create-org')).toBeDefined()
  })

  it('shows validation error when name is empty on submit', async () => {
    render(<CreateOrgForm token="tok" onSuccess={onSuccess} />)
    await userEvent.click(screen.getByTestId('btn-create-org'))
    await waitFor(() => expect(screen.getByTestId('error-org-name')).toBeDefined())
  })

  it('shows validation error when email is invalid', async () => {
    render(<CreateOrgForm token="tok" onSuccess={onSuccess} />)
    await userEvent.type(screen.getByTestId('input-org-name'), 'Acme')
    await userEvent.type(screen.getByTestId('input-admin-email'), 'not-an-email')
    await userEvent.click(screen.getByTestId('btn-create-org'))
    await waitFor(() => expect(screen.getByTestId('error-admin-email')).toBeDefined())
  })

  it('calls createOrg with correct data on valid submit', async () => {
    vi.mocked(rootApi.createOrg).mockResolvedValue({ orgId: 'org123', adminTempPassword: null })
    render(<CreateOrgForm token="tok" onSuccess={onSuccess} />)
    await userEvent.type(screen.getByTestId('input-org-name'), 'Acme Corp')
    await userEvent.type(screen.getByTestId('input-admin-email'), 'admin@acme.com')
    await userEvent.click(screen.getByTestId('btn-create-org'))
    await waitFor(() =>
      expect(vi.mocked(rootApi.createOrg)).toHaveBeenCalledWith('tok', {
        name: 'Acme Corp',
        adminEmail: 'admin@acme.com',
      }),
    )
  })

  it('calls onSuccess after successful creation', async () => {
    vi.mocked(rootApi.createOrg).mockResolvedValue({ orgId: 'org123', adminTempPassword: null })
    render(<CreateOrgForm token="tok" onSuccess={onSuccess} />)
    await userEvent.type(screen.getByTestId('input-org-name'), 'Acme')
    await userEvent.type(screen.getByTestId('input-admin-email'), 'admin@acme.com')
    await userEvent.click(screen.getByTestId('btn-create-org'))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('org123', null))
  })

  it('resets form fields after successful creation', async () => {
    vi.mocked(rootApi.createOrg).mockResolvedValue({ orgId: 'org123', adminTempPassword: null })
    render(<CreateOrgForm token="tok" onSuccess={onSuccess} />)
    await userEvent.type(screen.getByTestId('input-org-name'), 'Acme')
    await userEvent.type(screen.getByTestId('input-admin-email'), 'admin@acme.com')
    await userEvent.click(screen.getByTestId('btn-create-org'))
    await waitFor(() => {
      const nameInput = screen.getByTestId('input-org-name') as HTMLInputElement
      expect(nameInput.value).toBe('')
    })
  })

  it('shows api error message on failure', async () => {
    vi.mocked(rootApi.createOrg).mockRejectedValue(new Error('quota_exceeded'))
    render(<CreateOrgForm token="tok" onSuccess={onSuccess} />)
    await userEvent.type(screen.getByTestId('input-org-name'), 'Acme')
    await userEvent.type(screen.getByTestId('input-admin-email'), 'admin@acme.com')
    await userEvent.click(screen.getByTestId('btn-create-org'))
    await waitFor(() => expect(screen.getByTestId('form-api-error')).toBeDefined())
  })

  it('disables button while submitting', async () => {
    vi.mocked(rootApi.createOrg).mockReturnValue(new Promise(() => {}))
    render(<CreateOrgForm token="tok" onSuccess={onSuccess} />)
    await userEvent.type(screen.getByTestId('input-org-name'), 'Acme')
    await userEvent.type(screen.getByTestId('input-admin-email'), 'admin@acme.com')
    await userEvent.click(screen.getByTestId('btn-create-org'))
    await waitFor(() => {
      const btn = screen.getByTestId('btn-create-org') as HTMLButtonElement
      expect(btn.disabled).toBe(true)
    })
  })

  it('chama onSuccess com tempPassword quando API retorna adminTempPassword', async () => {
    vi.mocked(rootApi.createOrg).mockResolvedValue({
      orgId: 'org123',
      adminTempPassword: 'Abc123XyZ9',
    })
    render(<CreateOrgForm token="tok" onSuccess={onSuccess} />)
    await userEvent.type(screen.getByTestId('input-org-name'), 'Acme')
    await userEvent.type(screen.getByTestId('input-admin-email'), 'admin@acme.com')
    await userEvent.click(screen.getByTestId('btn-create-org'))
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith('org123', 'Abc123XyZ9')
    )
  })

  it('chama onSuccess com null quando admin já existia', async () => {
    vi.mocked(rootApi.createOrg).mockResolvedValue({ orgId: 'org123', adminTempPassword: null })
    render(<CreateOrgForm token="tok" onSuccess={onSuccess} />)
    await userEvent.type(screen.getByTestId('input-org-name'), 'Acme')
    await userEvent.type(screen.getByTestId('input-admin-email'), 'admin@acme.com')
    await userEvent.click(screen.getByTestId('btn-create-org'))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('org123', null))
  })
})
