import { describe, it, expect, beforeAll } from 'vitest'
import i18n from '../lib/i18n'

beforeAll(async () => {
  await i18n.init()
})

describe('namespace auth — pt-BR', () => {
  it('login.submit existe', () => {
    expect(i18n.t('auth:login.submit')).not.toBe('auth:login.submit')
  })

  it('login.submit_loading existe', () => {
    expect(i18n.t('auth:login.submit_loading')).not.toBe('auth:login.submit_loading')
  })

  it('login.tab_password existe', () => {
    expect(i18n.t('auth:login.tab_password')).not.toBe('auth:login.tab_password')
  })

  it('login.tab_magic_link existe', () => {
    expect(i18n.t('auth:login.tab_magic_link')).not.toBe('auth:login.tab_magic_link')
  })

  it('login.error_invalid_credentials existe', () => {
    expect(i18n.t('auth:login.error_invalid_credentials')).not.toBe('auth:login.error_invalid_credentials')
  })

  it('login.error_account_locked existe', () => {
    expect(i18n.t('auth:login.error_account_locked')).not.toBe('auth:login.error_account_locked')
  })

  it('mfa.title_challenge existe', () => {
    expect(i18n.t('auth:mfa.title_challenge')).not.toBe('auth:mfa.title_challenge')
  })

  it('mfa.title_setup existe', () => {
    expect(i18n.t('auth:mfa.title_setup')).not.toBe('auth:mfa.title_setup')
  })

  it('mfa.submit_challenge existe', () => {
    expect(i18n.t('auth:mfa.submit_challenge')).not.toBe('auth:mfa.submit_challenge')
  })

  it('mfa.submit_setup existe', () => {
    expect(i18n.t('auth:mfa.submit_setup')).not.toBe('auth:mfa.submit_setup')
  })

  it('mfa.backup_codes_saved existe', () => {
    expect(i18n.t('auth:mfa.backup_codes_saved')).not.toBe('auth:mfa.backup_codes_saved')
  })

  it('magic_link.sent_title existe', () => {
    expect(i18n.t('auth:magic_link.sent_title')).not.toBe('auth:magic_link.sent_title')
  })

  it('magic_link.submit existe', () => {
    expect(i18n.t('auth:magic_link.submit')).not.toBe('auth:magic_link.submit')
  })

  it('magic_link.verifying existe', () => {
    expect(i18n.t('auth:magic_link.verifying')).not.toBe('auth:magic_link.verifying')
  })

  it('change_password.submit existe', () => {
    expect(i18n.t('auth:change_password.submit')).not.toBe('auth:change_password.submit')
  })

  it('change_password.error_length existe', () => {
    expect(i18n.t('auth:change_password.error_length')).not.toBe('auth:change_password.error_length')
  })

  it('change_password.error_mismatch existe', () => {
    expect(i18n.t('auth:change_password.error_mismatch')).not.toBe('auth:change_password.error_mismatch')
  })
})

describe('namespace auth — en', () => {
  it('login.submit em inglês existe', () => {
    const result = i18n.getFixedT('en', 'auth')('login.submit')
    expect(result).not.toBe('login.submit')
  })

  it('mfa.title_challenge em inglês existe', () => {
    const result = i18n.getFixedT('en', 'auth')('mfa.title_challenge')
    expect(result).not.toBe('mfa.title_challenge')
  })
})
