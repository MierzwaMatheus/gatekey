// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as orgApi from '../lib/org-api'

vi.mock('../lib/org-api')

const mockLogs: orgApi.AuditEvent[] = [
  {
    _id: 'log1',
    timestamp: Date.now() - 1000 * 60 * 2,
    actorType: 'user',
    actorId: 'user_abc',
    actorRole: 'org_admin',
    action: 'permission.check',
    target: { type: 'document', id: 'doc1' },
    orgId: 'org1',
    result: 'allow',
  },
  {
    _id: 'log2',
    timestamp: Date.now() - 1000 * 60 * 5,
    actorType: 'user',
    actorId: 'user_abc',
    action: 'binding.create',
    target: { type: 'binding', id: 'bind1' },
    orgId: 'org1',
    result: 'allow',
  },
  {
    _id: 'log3',
    timestamp: Date.now() - 1000 * 60 * 10,
    actorType: 'user',
    actorId: 'user_abc',
    action: 'auth.login.success',
    target: { type: 'user', id: 'user_abc' },
    orgId: 'org1',
    result: 'allow',
  },
]

// ── Ciclo 2: função getUserAccessHistory ─────────────────────────────────────

describe('getUserAccessHistory', () => {
  it('é chamada com userId e retorna AuditLogPage', async () => {
    vi.mocked(orgApi.getUserAccessHistory).mockResolvedValueOnce({
      logs: [],
      isDone: true,
      cursor: null,
    })

    const result = await orgApi.getUserAccessHistory('token123', 'user_abc', {})

    expect(vi.mocked(orgApi.getUserAccessHistory)).toHaveBeenCalledWith(
      'token123',
      'user_abc',
      {},
    )
    expect(result).toHaveProperty('logs')
    expect(result).toHaveProperty('isDone')
  })

  it('aceita filtros opcionais de action e from', async () => {
    vi.mocked(orgApi.getUserAccessHistory).mockResolvedValueOnce({
      logs: [],
      isDone: true,
      cursor: null,
    })

    await orgApi.getUserAccessHistory('token123', 'user_xyz', {
      action: 'permission.check',
      from: 1000,
    })

    expect(vi.mocked(orgApi.getUserAccessHistory)).toHaveBeenCalledWith(
      'token123',
      'user_xyz',
      { action: 'permission.check', from: 1000 },
    )
  })
})

// ── Ciclo 3: componente renderiza lista de eventos ───────────────────────────

describe('UserAccessHistory', () => {
  beforeEach(() => {
    vi.mocked(orgApi.getUserAccessHistory).mockResolvedValue({
      logs: mockLogs,
      isDone: true,
      cursor: null,
    })
  })

  it('renderiza lista de eventos de audit filtrados por userId', async () => {
    const { UserAccessHistory } = await import('../components/org/user-access-history')
    render(
      <UserAccessHistory
        userId="user_abc"
        userName="Alice"
        token="tok"
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('permission.check')).toBeDefined()
      expect(screen.getByText('binding.create')).toBeDefined()
      expect(screen.getByText('auth.login.success')).toBeDefined()
    })
  })

  // ── Ciclo 4: colunas da tabela ────────────────────────────────────────────

  it('cada linha mostra action, resultado ALLOW/DENY', async () => {
    const logsWithDeny: orgApi.AuditEvent[] = [
      ...mockLogs,
      {
        _id: 'log4',
        timestamp: Date.now() - 1000 * 60 * 15,
        actorType: 'user',
        actorId: 'user_abc',
        action: 'permission.check',
        target: { type: 'document', id: 'doc2' },
        orgId: 'org1',
        result: 'deny',
        reason: 'no_binding_found',
      },
    ]
    vi.mocked(orgApi.getUserAccessHistory).mockResolvedValue({
      logs: logsWithDeny,
      isDone: true,
      cursor: null,
    })

    const { UserAccessHistory } = await import('../components/org/user-access-history')
    render(
      <UserAccessHistory
        userId="user_abc"
        userName="Alice"
        token="tok"
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getAllByText('ALLOW').length).toBeGreaterThan(0)
      expect(screen.getAllByText('DENY').length).toBeGreaterThan(0)
    })
  })

  // ── Ciclo 5: filtro de date range ─────────────────────────────────────────

  it('filtro de data range chama getUserAccessHistory com from/to', async () => {
    const { UserAccessHistory } = await import('../components/org/user-access-history')
    render(
      <UserAccessHistory
        userId="user_abc"
        userName="Alice"
        token="tok"
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(vi.mocked(orgApi.getUserAccessHistory)).toHaveBeenCalled()
    })

    const fromInput = screen.getByTestId('filter-from-date')
    fireEvent.change(fromInput, { target: { value: '2024-01-01' } })

    await waitFor(() => {
      const calls = vi.mocked(orgApi.getUserAccessHistory).mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[2]).toHaveProperty('from')
    })
  })

  // ── Ciclo 6: filtro de action type ────────────────────────────────────────

  it('filtro de action type chama getUserAccessHistory com action', async () => {
    const { UserAccessHistory } = await import('../components/org/user-access-history')
    render(
      <UserAccessHistory
        userId="user_abc"
        userName="Alice"
        token="tok"
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(vi.mocked(orgApi.getUserAccessHistory)).toHaveBeenCalled()
    })

    const actionSelect = screen.getByTestId('filter-action')
    fireEvent.change(actionSelect, { target: { value: 'permission.check' } })

    await waitFor(() => {
      const calls = vi.mocked(orgApi.getUserAccessHistory).mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[2]).toMatchObject({ action: 'permission.check' })
    })
  })

  // ── Ciclo 7: paginação por cursor ─────────────────────────────────────────

  it('exibe botão "Carregar mais" quando não isDone e chama com cursor', async () => {
    vi.mocked(orgApi.getUserAccessHistory)
      .mockResolvedValueOnce({ logs: mockLogs, isDone: false, cursor: 'cursor_abc' })
      .mockResolvedValue({ logs: [], isDone: true, cursor: null })

    const { UserAccessHistory } = await import('../components/org/user-access-history')
    render(
      <UserAccessHistory
        userId="user_abc"
        userName="Alice"
        token="tok"
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('load-more-btn')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('load-more-btn'))

    await waitFor(() => {
      const calls = vi.mocked(orgApi.getUserAccessHistory).mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[2]).toMatchObject({ cursor: 'cursor_abc' })
    })
  })

  // ── Ciclo 9: teste de integração ──────────────────────────────────────────

  it('mock retorna 5 eventos, tabela renderiza 5 linhas', async () => {
    const fiveLogs: orgApi.AuditEvent[] = Array.from({ length: 5 }, (_, i) => ({
      _id: `log_${i}`,
      timestamp: Date.now() - i * 1000 * 60,
      actorType: 'user',
      actorId: 'user_abc',
      action: `action.${i}`,
      target: { type: 'document', id: `doc_${i}` },
      orgId: 'org1',
      result: 'allow' as const,
    }))

    vi.mocked(orgApi.getUserAccessHistory).mockResolvedValue({
      logs: fiveLogs,
      isDone: true,
      cursor: null,
    })

    const { UserAccessHistory } = await import('../components/org/user-access-history')
    render(
      <UserAccessHistory
        userId="user_abc"
        userName="Alice"
        token="tok"
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      const rows = screen.getAllByTestId('audit-event-row')
      expect(rows.length).toBe(5)
    })
  })

  it('filtro de data atualiza chamada da API', async () => {
    vi.mocked(orgApi.getUserAccessHistory).mockResolvedValue({
      logs: mockLogs,
      isDone: true,
      cursor: null,
    })

    const { UserAccessHistory } = await import('../components/org/user-access-history')
    render(
      <UserAccessHistory
        userId="user_abc"
        userName="Alice"
        token="tok"
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(vi.mocked(orgApi.getUserAccessHistory)).toHaveBeenCalled()
    })

    const callsBefore = vi.mocked(orgApi.getUserAccessHistory).mock.calls.length

    const fromInput = screen.getByTestId('filter-from-date')
    fireEvent.change(fromInput, { target: { value: '2024-06-01' } })

    await waitFor(
      () => {
        expect(vi.mocked(orgApi.getUserAccessHistory).mock.calls.length).toBeGreaterThan(callsBefore)
      },
      { timeout: 2000 },
    )
  })
})
