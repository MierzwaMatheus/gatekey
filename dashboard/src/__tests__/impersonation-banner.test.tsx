// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImpersonationBanner } from '../components/root/impersonation-banner'

describe('ImpersonationBanner', () => {
  it('não renderiza quando impersonating é null', () => {
    const { container } = render(
      <ImpersonationBanner impersonating={null} onEnd={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renderiza com nome do usuário impersonado quando prop é fornecida', () => {
    render(
      <ImpersonationBanner
        impersonating={{ id: 'user_1', name: 'Ana Silva' }}
        onEnd={vi.fn()}
      />
    )
    expect(screen.getByText(/Ana Silva/)).toBeDefined()
    expect(screen.getByText(/Você está agindo como/)).toBeDefined()
  })

  it('exibe botão "Encerrar" quando impersonating está ativo', () => {
    render(
      <ImpersonationBanner
        impersonating={{ id: 'user_1', name: 'Ana Silva' }}
        onEnd={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Encerrar/i })).toBeDefined()
  })

  it('chama onEnd ao clicar em "Encerrar"', async () => {
    const onEnd = vi.fn()
    render(
      <ImpersonationBanner
        impersonating={{ id: 'user_1', name: 'Ana Silva' }}
        onEnd={onEnd}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /Encerrar/i }))
    expect(onEnd).toHaveBeenCalledOnce()
  })

  it('não possui botão de fechar — é não-dismissível', () => {
    render(
      <ImpersonationBanner
        impersonating={{ id: 'user_1', name: 'Ana Silva' }}
        onEnd={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /fechar|close|×|✕/i })).toBeNull()
  })

  it('usa --gate-danger como cor de fundo', () => {
    render(
      <ImpersonationBanner
        impersonating={{ id: 'user_1', name: 'Ana Silva' }}
        onEnd={vi.fn()}
      />
    )
    const banner = screen.getByTestId('impersonation-banner')
    expect(banner.className).toContain('gate-danger')
  })
})
