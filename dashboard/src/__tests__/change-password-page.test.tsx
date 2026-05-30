// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChangePasswordPage } from '../routes/change-password'
import { AuthProvider } from '../lib/auth-context'
import * as orgApi from '../lib/org-api'

vi.mock('../lib/org-api')

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// JWT com sub=user123 e orgId=org456
const MOCK_TOKEN = [
  'h',
  btoa(JSON.stringify({
    sub: 'user123',
    orgId: 'org456',
    sessionId: 's1',
    workspaceIds: [],
    roles: {},
    capabilities: [],
    exp: 9999999999,
  })),
  'sig',
].join('.')

function renderPage(token = MOCK_TOKEN) {
  return render(
    <AuthProvider initialState={{ token, role: 'org_admin', orgId: 'org456' }}>
      <ChangePasswordPage />
    </AuthProvider>
  )
}

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  it('renderiza campos de nova senha e confirmação', () => {
    renderPage()
    expect(screen.getByTestId('input-new-password')).toBeDefined()
    expect(screen.getByTestId('input-confirm-password')).toBeDefined()
    expect(screen.getByTestId('btn-change-password')).toBeDefined()
  })

  it('mostra erro quando senhas não coincidem', async () => {
    renderPage()
    await userEvent.type(screen.getByTestId('input-new-password'), 'novaSenha123')
    await userEvent.type(screen.getByTestId('input-confirm-password'), 'diferente')
    fireEvent.click(screen.getByTestId('btn-change-password'))
    await waitFor(() => expect(screen.getByTestId('error-password-mismatch')).toBeDefined())
  })

  it('mostra erro quando senha tem menos de 8 caracteres', async () => {
    renderPage()
    await userEvent.type(screen.getByTestId('input-new-password'), 'curta')
    await userEvent.type(screen.getByTestId('input-confirm-password'), 'curta')
    fireEvent.click(screen.getByTestId('btn-change-password'))
    await waitFor(() => expect(screen.getByTestId('error-password-length')).toBeDefined())
  })

  it('chama resetUserPassword com userId extraído do JWT e nova senha', async () => {
    vi.mocked(orgApi.resetUserPassword).mockResolvedValue(undefined)
    renderPage()
    await userEvent.type(screen.getByTestId('input-new-password'), 'novaSenha123')
    await userEvent.type(screen.getByTestId('input-confirm-password'), 'novaSenha123')
    fireEvent.click(screen.getByTestId('btn-change-password'))
    await waitFor(() =>
      expect(vi.mocked(orgApi.resetUserPassword)).toHaveBeenCalledWith(
        MOCK_TOKEN,
        'user123',
        'novaSenha123',
      )
    )
  })

  it('redireciona para /org/$orgId após troca bem-sucedida', async () => {
    vi.mocked(orgApi.resetUserPassword).mockResolvedValue(undefined)
    renderPage()
    await userEvent.type(screen.getByTestId('input-new-password'), 'novaSenha123')
    await userEvent.type(screen.getByTestId('input-confirm-password'), 'novaSenha123')
    fireEvent.click(screen.getByTestId('btn-change-password'))
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/org/$orgId', params: { orgId: 'org456' } })
    )
  })

  it('exibe erro de API quando resetUserPassword falha', async () => {
    vi.mocked(orgApi.resetUserPassword).mockRejectedValue(new Error('forbidden'))
    renderPage()
    await userEvent.type(screen.getByTestId('input-new-password'), 'novaSenha123')
    await userEvent.type(screen.getByTestId('input-confirm-password'), 'novaSenha123')
    fireEvent.click(screen.getByTestId('btn-change-password'))
    await waitFor(() => expect(screen.getByTestId('error-api')).toBeDefined())
  })
})
