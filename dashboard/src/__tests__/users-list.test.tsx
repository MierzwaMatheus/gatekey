// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UsersList } from '../components/org/users-list'
import * as orgApi from '../lib/org-api'

vi.mock('../lib/org-api')
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))
vi.mock('@convex/_generated/api', () => ({ api: { users: { listUsersQuery: 'users:listUsersQuery' } } }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.count !== undefined) return `${key}_${opts.count}`
      return key
    },
  }),
}))

import { useQuery } from 'convex/react'

const activeUser = {
  _id: 'user1',
  email: 'active@acme.io',
  status: 'active' as const,
  loginAttempts: 0,
  updatedAt: Date.now(),
  orgRole: 'member',
  orgStatus: 'active',
}

const suspendedUser = {
  _id: 'user2',
  email: 'suspended@acme.io',
  status: 'suspended' as const,
  loginAttempts: 0,
  updatedAt: Date.now(),
  orgRole: 'member',
  orgStatus: 'active',
}

describe('UsersList — botão Reativar', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mostra botão Reativar para usuário suspenso', () => {
    vi.mocked(useQuery).mockReturnValue([suspendedUser])
    render(<UsersList token="tok" orgId="org1" onAddUser={() => {}} />)
    expect(screen.getByTestId('btn-reactivate-user2')).toBeDefined()
  })

  it('não mostra botão Reativar para usuário ativo', () => {
    vi.mocked(useQuery).mockReturnValue([activeUser])
    render(<UsersList token="tok" orgId="org1" onAddUser={() => {}} />)
    expect(screen.queryByTestId('btn-reactivate-user1')).toBeNull()
  })

  it('mostra botão Suspender para usuário ativo', () => {
    vi.mocked(useQuery).mockReturnValue([activeUser])
    render(<UsersList token="tok" orgId="org1" onAddUser={() => {}} />)
    expect(screen.getByTestId('btn-suspend-user1')).toBeDefined()
  })

  it('não mostra botão Suspender para usuário suspenso', () => {
    vi.mocked(useQuery).mockReturnValue([suspendedUser])
    render(<UsersList token="tok" orgId="org1" onAddUser={() => {}} />)
    expect(screen.queryByTestId('btn-suspend-user2')).toBeNull()
  })
})

describe('UsersList — ação Remover da org', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mostra botão Remover da org para qualquer usuário', () => {
    vi.mocked(useQuery).mockReturnValue([activeUser])
    render(<UsersList token="tok" orgId="org1" onAddUser={() => {}} />)
    expect(screen.getByTestId('btn-remove-org-user1')).toBeDefined()
  })

  it('clicar em Remover da org abre modal de confirmação', async () => {
    vi.mocked(useQuery).mockReturnValue([activeUser])
    render(<UsersList token="tok" orgId="org1" onAddUser={() => {}} />)
    await userEvent.click(screen.getByTestId('btn-remove-org-user1'))
    expect(screen.getByTestId('modal-remove-org')).toBeDefined()
  })

  it('confirmar remoção chama removeUserFromOrg com userId correto', async () => {
    vi.mocked(useQuery).mockReturnValue([activeUser])
    vi.mocked(orgApi.removeUserFromOrg).mockResolvedValue({ workspacesAffected: 1, bindingsRevoked: 2 })
    render(<UsersList token="tok" orgId="org1" onAddUser={() => {}} />)
    await userEvent.click(screen.getByTestId('btn-remove-org-user1'))
    await userEvent.click(screen.getByTestId('btn-confirm-remove-org'))
    await waitFor(() =>
      expect(vi.mocked(orgApi.removeUserFromOrg)).toHaveBeenCalledWith('tok', 'user1'),
    )
  })

  it('cancelar fecha modal sem chamar removeUserFromOrg', async () => {
    vi.mocked(useQuery).mockReturnValue([activeUser])
    render(<UsersList token="tok" orgId="org1" onAddUser={() => {}} />)
    await userEvent.click(screen.getByTestId('btn-remove-org-user1'))
    await userEvent.click(screen.getByTestId('btn-cancel-remove-org'))
    expect(screen.queryByTestId('modal-remove-org')).toBeNull()
    expect(vi.mocked(orgApi.removeUserFromOrg)).not.toHaveBeenCalled()
  })
})

describe('UsersList — ação Reativar (integração)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('clicar em Reativar abre modal de confirmação', async () => {
    vi.mocked(useQuery).mockReturnValue([suspendedUser])
    render(<UsersList token="tok" orgId="org1" onAddUser={() => {}} />)
    await userEvent.click(screen.getByTestId('btn-reactivate-user2'))
    expect(screen.getByTestId('modal-reactivate')).toBeDefined()
  })

  it('confirmar reativação chama reactivateUser com userId correto', async () => {
    vi.mocked(useQuery).mockReturnValue([suspendedUser])
    vi.mocked(orgApi.reactivateUser).mockResolvedValue(undefined)
    render(<UsersList token="tok" orgId="org1" onAddUser={() => {}} />)
    await userEvent.click(screen.getByTestId('btn-reactivate-user2'))
    await userEvent.click(screen.getByTestId('btn-confirm-reactivate'))
    await waitFor(() =>
      expect(vi.mocked(orgApi.reactivateUser)).toHaveBeenCalledWith('tok', 'user2'),
    )
  })

  it('cancelar fecha modal sem chamar reactivateUser', async () => {
    vi.mocked(useQuery).mockReturnValue([suspendedUser])
    render(<UsersList token="tok" orgId="org1" onAddUser={() => {}} />)
    await userEvent.click(screen.getByTestId('btn-reactivate-user2'))
    await userEvent.click(screen.getByTestId('btn-cancel-reactivate'))
    expect(screen.queryByTestId('modal-reactivate')).toBeNull()
    expect(vi.mocked(orgApi.reactivateUser)).not.toHaveBeenCalled()
  })
})
