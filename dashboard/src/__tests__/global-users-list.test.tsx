// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { GlobalUsersList } from '../components/root/global-users-list'
import * as rootApi from '../lib/root-api'

vi.mock('../lib/root-api')

const mockOrgs: rootApi.OrgSummary[] = [
  { _id: 'org1', name: 'Acme Corp', status: 'active', usersCount: 2, workspacesCount: 1, updatedAt: Date.now() },
  { _id: 'org2', name: 'Beta Inc', status: 'active', usersCount: 1, workspacesCount: 1, updatedAt: Date.now() },
]

const mockUsers: rootApi.GlobalUserSummary[] = [
  {
    _id: 'user1',
    email: 'alice@acme.com',
    status: 'active',
    orgId: 'org1',
    orgRole: 'admin',
    _creationTime: Date.now() - 86400000,
    updatedAt: Date.now(),
  },
  {
    _id: 'user2',
    email: 'bob@acme.com',
    status: 'suspended',
    orgId: 'org1',
    orgRole: 'member',
    _creationTime: Date.now() - 86400000,
    updatedAt: Date.now(),
  },
  {
    _id: 'user3',
    email: 'carol@beta.com',
    status: 'active',
    orgId: 'org2',
    orgRole: 'admin',
    _creationTime: Date.now() - 86400000,
    updatedAt: Date.now(),
  },
]

const mockPage: rootApi.GlobalUsersPage = {
  users: mockUsers,
  nextCursor: null,
  isDone: true,
}

describe('GlobalUsersList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rootApi.listOrgs).mockResolvedValue(mockOrgs)
    vi.mocked(rootApi.listAllUsers).mockResolvedValue(mockPage)
  })

  it('exibe estado de loading enquanto carrega', () => {
    vi.mocked(rootApi.listAllUsers).mockReturnValue(new Promise(() => {}))
    render(<GlobalUsersList token="tok" />)
    expect(screen.getByTestId('global-users-loading')).toBeDefined()
  })

  it('renderiza tabela com colunas email, org, status, criado em', async () => {
    render(<GlobalUsersList token="tok" />)
    await waitFor(() => expect(screen.queryByTestId('global-users-loading')).toBeNull())
    expect(screen.getByTestId('global-users-table')).toBeDefined()
    expect(screen.getByText('alice@acme.com')).toBeDefined()
    expect(screen.getByText('bob@acme.com')).toBeDefined()
    expect(screen.getByText('carol@beta.com')).toBeDefined()
  })

  it('exibe mensagem quando lista está vazia', async () => {
    vi.mocked(rootApi.listAllUsers).mockResolvedValue({ users: [], nextCursor: null, isDone: true })
    render(<GlobalUsersList token="tok" />)
    await waitFor(() => expect(screen.queryByTestId('global-users-loading')).toBeNull())
    expect(screen.getByTestId('global-users-empty')).toBeDefined()
  })

  it('filtro por status atualiza chamada à API', async () => {
    render(<GlobalUsersList token="tok" />)
    await waitFor(() => expect(screen.queryByTestId('global-users-loading')).toBeNull())

    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'suspended' } })

    await waitFor(() =>
      expect(vi.mocked(rootApi.listAllUsers)).toHaveBeenCalledWith(
        'tok',
        expect.objectContaining({ status: 'suspended' }),
      ),
    )
  })

  it('filtro por org atualiza chamada à API', async () => {
    render(<GlobalUsersList token="tok" />)
    await waitFor(() => expect(screen.queryByTestId('global-users-loading')).toBeNull())

    fireEvent.change(screen.getByTestId('filter-org'), { target: { value: 'org1' } })

    await waitFor(() =>
      expect(vi.mocked(rootApi.listAllUsers)).toHaveBeenCalledWith(
        'tok',
        expect.objectContaining({ orgId: 'org1' }),
      ),
    )
  })

  it('clicar em "Suspender" abre modal de confirmação com email do usuário', async () => {
    render(<GlobalUsersList token="tok" />)
    await waitFor(() => expect(screen.queryByTestId('global-users-loading')).toBeNull())

    fireEvent.click(screen.getAllByTestId('btn-suspend-user')[0])

    const modal = screen.getByTestId('confirm-suspend-modal')
    expect(modal).toBeDefined()
    expect(modal.textContent).toContain('alice@acme.com')
  })

  it('clicar em "Revogar sessões" abre modal de confirmação', async () => {
    render(<GlobalUsersList token="tok" />)
    await waitFor(() => expect(screen.queryByTestId('global-users-loading')).toBeNull())

    fireEvent.click(screen.getAllByTestId('btn-revoke-sessions')[0])

    expect(screen.getByTestId('confirm-revoke-sessions-modal')).toBeDefined()
  })
})
