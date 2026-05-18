// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ColdStorageConfig } from '../components/root/cold-storage-config'

describe('ColdStorageConfig', () => {
  it('renders provider toggle with R2 and S3 options', () => {
    render(<ColdStorageConfig />)
    expect(screen.getByTestId('provider-r2')).toBeDefined()
    expect(screen.getByTestId('provider-s3')).toBeDefined()
  })

  it('shows R2-specific fields when R2 is selected', async () => {
    render(<ColdStorageConfig />)
    await userEvent.click(screen.getByTestId('provider-r2'))
    await waitFor(() => expect(screen.getByTestId('input-r2-account-id')).toBeDefined())
    expect(screen.getByTestId('input-r2-bucket')).toBeDefined()
    expect(screen.getByTestId('input-r2-access-key')).toBeDefined()
    expect(screen.getByTestId('input-r2-secret-key')).toBeDefined()
  })

  it('shows S3-specific fields when S3 is selected', async () => {
    render(<ColdStorageConfig />)
    await userEvent.click(screen.getByTestId('provider-s3'))
    await waitFor(() => expect(screen.getByTestId('input-s3-bucket')).toBeDefined())
    expect(screen.getByTestId('input-s3-region')).toBeDefined()
    expect(screen.getByTestId('input-s3-access-key')).toBeDefined()
    expect(screen.getByTestId('input-s3-secret-key')).toBeDefined()
  })

  it('hides provider-specific fields when Skip is selected', async () => {
    render(<ColdStorageConfig />)
    await userEvent.click(screen.getByTestId('provider-r2'))
    await userEvent.click(screen.getByTestId('provider-skip'))
    await waitFor(() => expect(screen.queryByTestId('input-r2-bucket')).toBeNull())
    expect(screen.queryByTestId('input-s3-bucket')).toBeNull()
  })

  it('renders save button', () => {
    render(<ColdStorageConfig />)
    expect(screen.getByTestId('btn-save-cold-storage')).toBeDefined()
  })
})
