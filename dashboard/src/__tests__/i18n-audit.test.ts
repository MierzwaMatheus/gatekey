import { describe, it, expect, beforeAll } from 'vitest'
import i18n from '../lib/i18n'

beforeAll(async () => {
  await i18n.init()
})

describe('namespace audit — pt-BR', () => {
  it('audit.empty existe', () => {
    expect(i18n.t('audit:empty')).not.toBe('audit:empty')
  })

  it('audit.filter_action existe', () => {
    expect(i18n.t('audit:filter_action')).not.toBe('audit:filter_action')
  })

  it('audit.col_when existe', () => {
    expect(i18n.t('audit:col_when')).not.toBe('audit:col_when')
  })

  it('audit.col_actor existe', () => {
    expect(i18n.t('audit:col_actor')).not.toBe('audit:col_actor')
  })

  it('audit.col_action existe', () => {
    expect(i18n.t('audit:col_action')).not.toBe('audit:col_action')
  })

  it('audit.col_result existe', () => {
    expect(i18n.t('audit:col_result')).not.toBe('audit:col_result')
  })

  it('audit.sessions_empty existe', () => {
    expect(i18n.t('audit:sessions_empty')).not.toBe('audit:sessions_empty')
  })

  it('audit.sessions_revoke existe', () => {
    expect(i18n.t('audit:sessions_revoke')).not.toBe('audit:sessions_revoke')
  })

  it('audit.sessions_col_user existe', () => {
    expect(i18n.t('audit:sessions_col_user')).not.toBe('audit:sessions_col_user')
  })
})

describe('namespace audit — en', () => {
  it('audit.empty em inglês existe', () => {
    const result = i18n.getFixedT('en', 'audit')('empty')
    expect(result).not.toBe('empty')
  })
})
