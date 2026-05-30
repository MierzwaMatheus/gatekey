// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrgQuotaSettings } from '../components/root/org-quota-settings'
import * as rootApi from '../lib/root-api'

vi.mock('../lib/root-api')

const mockQuotas: rootApi.OrgQuotas = {
  users_per_org: 50,
  workspaces_per_org: 10,
  users_per_workspace: 30,
  capabilities_per_org: 50,
  roles_per_workspace: 20,
  sessions_per_user: 5,
  api_keys_per_org: 10,
}

describe('OrgQuotaSettings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders loading state while fetching', () => {
    vi.mocked(rootApi.getOrgSettings).mockReturnValue(new Promise(() => {}))
    render(<OrgQuotaSettings token="tok" orgId="org1" />)
    expect(screen.getByTestId('quotas-loading')).toBeDefined()
  })

  it('renders all 7 quota fields after loading', async () => {
    vi.mocked(rootApi.getOrgSettings).mockResolvedValue({ quotas: mockQuotas })
    render(<OrgQuotaSettings token="tok" orgId="org1" />)
    await waitFor(() => screen.getByTestId('quota-users_per_org'))
    expect(screen.getByTestId('quota-users_per_org')).toBeDefined()
    expect(screen.getByTestId('quota-workspaces_per_org')).toBeDefined()
    expect(screen.getByTestId('quota-users_per_workspace')).toBeDefined()
    expect(screen.getByTestId('quota-capabilities_per_org')).toBeDefined()
    expect(screen.getByTestId('quota-roles_per_workspace')).toBeDefined()
    expect(screen.getByTestId('quota-sessions_per_user')).toBeDefined()
    expect(screen.getByTestId('quota-api_keys_per_org')).toBeDefined()
  })

  it('pre-fills input values from fetched quotas', async () => {
    vi.mocked(rootApi.getOrgSettings).mockResolvedValue({ quotas: mockQuotas })
    render(<OrgQuotaSettings token="tok" orgId="org1" />)
    await waitFor(() => screen.getByTestId('quota-users_per_org'))
    const input = screen.getByTestId('quota-users_per_org') as HTMLInputElement
    expect(input.value).toBe('50')
  })

  it('renders segmented quota bar for each quota', async () => {
    vi.mocked(rootApi.getOrgSettings).mockResolvedValue({ quotas: mockQuotas })
    render(<OrgQuotaSettings token="tok" orgId="org1" />)
    await waitFor(() => screen.getByTestId('quota-bar-users_per_org'))
    expect(screen.getByTestId('quota-bar-users_per_org')).toBeDefined()
  })

  it('calls updateOrgQuotas with changed values on submit', async () => {
    vi.mocked(rootApi.getOrgSettings).mockResolvedValue({ quotas: mockQuotas })
    vi.mocked(rootApi.updateOrgQuotas).mockResolvedValue(undefined)
    render(<OrgQuotaSettings token="tok" orgId="org1" />)
    await waitFor(() => screen.getByTestId('quota-users_per_org'))
    const input = screen.getByTestId('quota-users_per_org') as HTMLInputElement
    await userEvent.clear(input)
    await userEvent.type(input, '75')
    await userEvent.click(screen.getByTestId('btn-save-quotas'))
    await waitFor(() =>
      expect(vi.mocked(rootApi.updateOrgQuotas)).toHaveBeenCalledWith(
        'tok',
        'org1',
        expect.objectContaining({ users_per_org: 75 }),
      ),
    )
  })

  it('shows success feedback after saving', async () => {
    vi.mocked(rootApi.getOrgSettings).mockResolvedValue({ quotas: mockQuotas })
    vi.mocked(rootApi.updateOrgQuotas).mockResolvedValue(undefined)
    render(<OrgQuotaSettings token="tok" orgId="org1" />)
    await waitFor(() => screen.getByTestId('quota-users_per_org'))
    await userEvent.click(screen.getByTestId('btn-save-quotas'))
    await waitFor(() => expect(screen.getByTestId('quotas-saved')).toBeDefined())
  })
})
