import { describe, it, expect, beforeAll } from 'vitest'
import i18n from '../lib/i18n'

beforeAll(async () => {
  await i18n.init()
})

describe('namespace users — pt-BR', () => {
  it('users.empty_title existe', () => {
    expect(i18n.t('users:empty_title')).not.toBe('users:empty_title')
  })

  it('users.empty_subtitle existe', () => {
    expect(i18n.t('users:empty_subtitle')).not.toBe('users:empty_subtitle')
  })

  it('users.create_button existe', () => {
    expect(i18n.t('users:create_button')).not.toBe('users:create_button')
  })

  it('users.suspend_title existe', () => {
    expect(i18n.t('users:suspend_title')).not.toBe('users:suspend_title')
  })

  it('users.suspend_confirm existe', () => {
    expect(i18n.t('users:suspend_confirm')).not.toBe('users:suspend_confirm')
  })

  it('users.reset_password_title existe', () => {
    expect(i18n.t('users:reset_password_title')).not.toBe('users:reset_password_title')
  })

  it('users.reset_password_confirm existe', () => {
    expect(i18n.t('users:reset_password_confirm')).not.toBe('users:reset_password_confirm')
  })

  it('users.col_identifier existe', () => {
    expect(i18n.t('users:col_identifier')).not.toBe('users:col_identifier')
  })

  it('users.col_status existe', () => {
    expect(i18n.t('users:col_status')).not.toBe('users:col_status')
  })

  it('users.col_role existe', () => {
    expect(i18n.t('users:col_role')).not.toBe('users:col_role')
  })

  it('users.col_updated existe', () => {
    expect(i18n.t('users:col_updated')).not.toBe('users:col_updated')
  })

  it('users.action_suspend existe', () => {
    expect(i18n.t('users:action_suspend')).not.toBe('users:action_suspend')
  })

  it('users.action_reset_password existe', () => {
    expect(i18n.t('users:action_reset_password')).not.toBe('users:action_reset_password')
  })
})

describe('namespace users — en', () => {
  it('users.empty_title em inglês existe', () => {
    const result = i18n.getFixedT('en', 'users')('empty_title')
    expect(result).not.toBe('empty_title')
  })

  it('users.suspend_confirm em inglês existe', () => {
    const result = i18n.getFixedT('en', 'users')('suspend_confirm')
    expect(result).not.toBe('suspend_confirm')
  })
})
