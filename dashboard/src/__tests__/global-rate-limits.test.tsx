// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { GlobalRateLimits } from '../components/root/global-rate-limits'
import * as rootApi from '../lib/root-api'

vi.mock('../lib/root-api')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('GlobalRateLimits — painel Root', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rootApi.getGlobalRateLimits).mockResolvedValue({ checkPerMin: 100, checkBatchPerMin: 20 })
    vi.mocked(rootApi.updateGlobalRateLimits).mockResolvedValue(undefined)
  })

  it('renderiza campos numéricos para checkPerMin e checkBatchPerMin', async () => {
    render(<GlobalRateLimits token="tok" />)
    await waitFor(() => {
      expect(screen.getByTestId('input-global-check-per-min')).toBeDefined()
      expect(screen.getByTestId('input-global-check-batch-per-min')).toBeDefined()
    })
  })

  it('exibe os valores padrão globais vindos da API', async () => {
    render(<GlobalRateLimits token="tok" />)
    await waitFor(() => {
      const checkInput = screen.getByTestId('input-global-check-per-min') as HTMLInputElement
      const batchInput = screen.getByTestId('input-global-check-batch-per-min') as HTMLInputElement
      expect(checkInput.value).toBe('100')
      expect(batchInput.value).toBe('20')
    })
  })

  it('ao salvar, chama updateGlobalRateLimits com os valores editados', async () => {
    render(<GlobalRateLimits token="tok" />)
    await waitFor(() => screen.getByTestId('input-global-check-per-min'))

    fireEvent.change(screen.getByTestId('input-global-check-per-min'), { target: { value: '200' } })
    fireEvent.click(screen.getByTestId('btn-save-global-rl'))

    await waitFor(() => {
      expect(vi.mocked(rootApi.updateGlobalRateLimits)).toHaveBeenCalledWith(
        'tok',
        expect.objectContaining({ checkPerMin: 200 }),
      )
    })
  })
})
