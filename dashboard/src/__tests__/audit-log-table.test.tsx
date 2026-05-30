// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuditLogTable } from '../components/root/audit-log-table'
import * as rootApi from '../lib/root-api'

vi.mock('../lib/root-api')

const mockLogs: rootApi.AuditEvent[] = [
  {
    _id: 'log1',
    timestamp: Date.now() - 1000 * 60 * 2,
    actorType: 'user',
    actorId: 'user_abc',
    actorRole: 'root',
    action: 'org.create',
    target: { type: 'org', id: 'org1' },
    orgId: 'org1',
    result: 'allow',
  },
  {
    _id: 'log2',
    timestamp: Date.now() - 1000 * 60 * 5,
    actorType: 'user',
    actorId: 'user_def',
    actorRole: 'org_admin',
    action: 'binding.create',
    target: { type: 'binding', id: 'bind1' },
    orgId: 'org1',
    result: 'allow',
  },
  {
    _id: 'log3',
    timestamp: Date.now() - 1000 * 60 * 10,
    actorType: 'user',
    actorId: 'user_ghi',
    actorRole: 'member',
    action: 'document.read',
    target: { type: 'document', id: 'doc1' },
    orgId: 'org1',
    result: 'deny',
    reason: 'no_binding_found',
  },
]

describe('AuditLogTable', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders loading state while fetching', () => {
    vi.mocked(rootApi.listAuditLog).mockReturnValue(new Promise(() => {}))
    render(<AuditLogTable token="tok" />)
    expect(screen.getByTestId('audit-loading')).toBeDefined()
  })

  it('renders timeline events after loading', async () => {
    vi.mocked(rootApi.listAuditLog).mockResolvedValue({ logs: mockLogs, isDone: true, cursor: null })
    render(<AuditLogTable token="tok" />)
    await waitFor(() => screen.getByTestId('audit-event-log1'))
    expect(screen.getByTestId('audit-event-log2')).toBeDefined()
    expect(screen.getByTestId('audit-event-log3')).toBeDefined()
  })

  it('renders action in monospace', async () => {
    vi.mocked(rootApi.listAuditLog).mockResolvedValue({ logs: mockLogs, isDone: true, cursor: null })
    render(<AuditLogTable token="tok" />)
    await waitFor(() => screen.getByTestId('audit-action-log1'))
    const action = screen.getByTestId('audit-action-log1')
    expect(action.className).toContain('font-mono')
    expect(action.textContent).toContain('org.create')
  })

  it('renders DENY events with deny styling', async () => {
    vi.mocked(rootApi.listAuditLog).mockResolvedValue({ logs: mockLogs, isDone: true, cursor: null })
    render(<AuditLogTable token="tok" />)
    await waitFor(() => screen.getByTestId('audit-event-log3'))
    const denyEvent = screen.getByTestId('audit-event-log3')
    expect(denyEvent.className).toContain('border-l-2')
  })

  it('renders timeline connector line between events', async () => {
    vi.mocked(rootApi.listAuditLog).mockResolvedValue({ logs: mockLogs, isDone: true, cursor: null })
    render(<AuditLogTable token="tok" />)
    await waitFor(() => screen.getByTestId('timeline-connector-log1'))
    expect(screen.getByTestId('timeline-connector-log1')).toBeDefined()
  })

  it('renders filter toolbar with action, result, and date filters', async () => {
    vi.mocked(rootApi.listAuditLog).mockResolvedValue({ logs: mockLogs, isDone: true, cursor: null })
    render(<AuditLogTable token="tok" />)
    await waitFor(() => expect(screen.getByTestId('filter-action')).toBeDefined())
    expect(screen.getByTestId('filter-result')).toBeDefined()
    expect(screen.getByTestId('filter-from')).toBeDefined()
    expect(screen.getByTestId('filter-to')).toBeDefined()
  })

  it('shows load more button when not isDone', async () => {
    vi.mocked(rootApi.listAuditLog).mockResolvedValue({ logs: mockLogs, isDone: false, cursor: 'cursor123' })
    render(<AuditLogTable token="tok" />)
    await waitFor(() => expect(screen.getByTestId('btn-load-more')).toBeDefined())
  })

  it('does not show load more button when isDone', async () => {
    vi.mocked(rootApi.listAuditLog).mockResolvedValue({ logs: mockLogs, isDone: true, cursor: null })
    render(<AuditLogTable token="tok" />)
    await waitFor(() => screen.getByTestId('audit-event-log1'))
    expect(screen.queryByTestId('btn-load-more')).toBeNull()
  })

  it('loads next page when clicking load more', async () => {
    vi.mocked(rootApi.listAuditLog)
      .mockResolvedValueOnce({ logs: mockLogs, isDone: false, cursor: 'cursor123' })
      .mockResolvedValueOnce({ logs: [], isDone: true, cursor: null })
    render(<AuditLogTable token="tok" />)
    await waitFor(() => screen.getByTestId('btn-load-more'))
    await userEvent.click(screen.getByTestId('btn-load-more'))
    await waitFor(() =>
      expect(vi.mocked(rootApi.listAuditLog)).toHaveBeenCalledTimes(2),
    )
  })

  it('renders empty state when no logs', async () => {
    vi.mocked(rootApi.listAuditLog).mockResolvedValue({ logs: [], isDone: true, cursor: null })
    render(<AuditLogTable token="tok" />)
    await waitFor(() => expect(screen.getByTestId('audit-empty')).toBeDefined())
  })
})
