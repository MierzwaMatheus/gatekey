// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { AuditLogWorkspace } from '../components/workspace/audit-log-workspace'
import * as workspaceApi from '../lib/workspace-api'

vi.mock('../lib/workspace-api')

const mockPage = {
  logs: [
    {
      _id: 'log1',
      timestamp: Date.now() - 1000 * 60 * 5,
      actorType: 'user',
      actorId: 'user1',
      actorRole: 'admin',
      action: 'binding.create',
      target: { type: 'bindings', id: 'bind1' },
      result: 'allow' as const,
      reason: undefined,
    },
    {
      _id: 'log2',
      timestamp: Date.now() - 1000 * 60 * 30,
      actorType: 'user',
      actorId: 'user2',
      actorRole: 'member',
      action: 'workspace.member.add',
      target: { type: 'workspace_members', id: 'user3' },
      result: 'deny' as const,
      reason: 'forbidden',
    },
  ],
  isDone: true,
  cursor: null,
}

describe('AuditLogWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton while fetching', () => {
    vi.mocked(workspaceApi.listWorkspaceAuditLog).mockReturnValue(new Promise(() => {}))
    render(<AuditLogWorkspace token="tok" wsId="ws1" />)
    expect(screen.getByTestId('audit-log-loading')).toBeDefined()
  })

  it('renders log rows after loading', async () => {
    vi.mocked(workspaceApi.listWorkspaceAuditLog).mockResolvedValue(mockPage)
    render(<AuditLogWorkspace token="tok" wsId="ws1" />)
    await waitFor(() => expect(screen.getByText('binding.create')).toBeDefined())
    expect(screen.getByText('workspace.member.add')).toBeDefined()
  })

  it('shows allow and deny result badges', async () => {
    vi.mocked(workspaceApi.listWorkspaceAuditLog).mockResolvedValue(mockPage)
    render(<AuditLogWorkspace token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByTestId('result-badge-log1'))
    expect(screen.getByTestId('result-badge-log1').textContent).toContain('allow')
    expect(screen.getByTestId('result-badge-log2').textContent).toContain('deny')
  })

  it('renders empty state when no logs', async () => {
    vi.mocked(workspaceApi.listWorkspaceAuditLog).mockResolvedValue({ logs: [], isDone: true, cursor: null })
    render(<AuditLogWorkspace token="tok" wsId="ws1" />)
    await waitFor(() => expect(screen.getByTestId('audit-log-empty')).toBeDefined())
  })

  it('shows "Carregar mais" button when not done', async () => {
    vi.mocked(workspaceApi.listWorkspaceAuditLog).mockResolvedValue({
      ...mockPage,
      isDone: false,
      cursor: 'cursor-abc',
    })
    render(<AuditLogWorkspace token="tok" wsId="ws1" />)
    await waitFor(() => expect(screen.getByTestId('btn-load-more')).toBeDefined())
  })

  it('hides "Carregar mais" when isDone is true', async () => {
    vi.mocked(workspaceApi.listWorkspaceAuditLog).mockResolvedValue(mockPage)
    render(<AuditLogWorkspace token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByText('binding.create'))
    expect(screen.queryByTestId('btn-load-more')).toBeNull()
  })

  it('calls listWorkspaceAuditLog with wsId', async () => {
    vi.mocked(workspaceApi.listWorkspaceAuditLog).mockResolvedValue(mockPage)
    render(<AuditLogWorkspace token="tok" wsId="ws-xyz" />)
    await waitFor(() => screen.getByText('binding.create'))
    expect(workspaceApi.listWorkspaceAuditLog).toHaveBeenCalledWith('tok', 'ws-xyz', expect.any(Object))
  })

  it('applies action filter when input changes', async () => {
    vi.mocked(workspaceApi.listWorkspaceAuditLog).mockResolvedValue(mockPage)
    render(<AuditLogWorkspace token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByTestId('filter-action'))
    fireEvent.change(screen.getByTestId('filter-action'), { target: { value: 'binding.create' } })
    await waitFor(() => expect(workspaceApi.listWorkspaceAuditLog).toHaveBeenCalledWith(
      'tok', 'ws1', expect.objectContaining({ action: 'binding.create' })
    ))
  })
})
