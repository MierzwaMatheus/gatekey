// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { OrgSettings } from '../components/org/org-settings'
import * as orgApi from '../lib/org-api'

vi.mock('../lib/org-api')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const mockSettings: orgApi.OrgSettings = {
  quotas: {},
  loginMethods: ['email_password'],
  mfaRequired: false,
  jwtExpiryAccess: 3600,
  jwtExpiryRefresh: 2592000,
  rateLimits: { checkPerMin: 50, checkBatchPerMin: 10 },
}

describe('OrgSettings — rate limits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(orgApi.getOrgSettings).mockResolvedValue(mockSettings)
    vi.mocked(orgApi.updateOrgSettings).mockResolvedValue(undefined)
  })

  it('renderiza campos numéricos checkPerMin e checkBatchPerMin', async () => {
    render(<OrgSettings token="tok" orgId="org1" />)
    await waitFor(() => {
      expect(screen.getByTestId('input-check-per-min')).toBeDefined()
      expect(screen.getByTestId('input-check-batch-per-min')).toBeDefined()
    })
  })

  it('campos exibem valores vindos do org_settings.rateLimits', async () => {
    render(<OrgSettings token="tok" orgId="org1" />)
    await waitFor(() => {
      const checkInput = screen.getByTestId('input-check-per-min') as HTMLInputElement
      const batchInput = screen.getByTestId('input-check-batch-per-min') as HTMLInputElement
      expect(checkInput.value).toBe('50')
      expect(batchInput.value).toBe('10')
    })
  })

  it('ao salvar, chama updateOrgSettings com rateLimits', async () => {
    render(<OrgSettings token="tok" orgId="org1" />)
    await waitFor(() => screen.getByTestId('input-check-per-min'))

    fireEvent.change(screen.getByTestId('input-check-per-min'), { target: { value: '75' } })
    fireEvent.click(screen.getByTestId('btn-save'))

    await waitFor(() => {
      expect(vi.mocked(orgApi.updateOrgSettings)).toHaveBeenCalledWith(
        'tok',
        'org1',
        expect.objectContaining({
          rateLimits: expect.objectContaining({ checkPerMin: 75 }),
        }),
      )
    })
  })
})
