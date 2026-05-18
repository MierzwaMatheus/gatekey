// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import i18n from '../lib/i18n'

beforeAll(async () => {
  await i18n.init()
})

describe('namespace roles — pt-BR', () => {
  it('roles.header existe', () => {
    expect(i18n.t('roles:header')).not.toBe('roles:header')
  })

  it('roles.empty existe', () => {
    expect(i18n.t('roles:empty')).not.toBe('roles:empty')
  })

  it('roles.col_name existe', () => {
    expect(i18n.t('roles:col_name')).not.toBe('roles:col_name')
  })

  it('roles.col_type existe', () => {
    expect(i18n.t('roles:col_type')).not.toBe('roles:col_type')
  })

  it('roles.col_capabilities existe', () => {
    expect(i18n.t('roles:col_capabilities')).not.toBe('roles:col_capabilities')
  })

  it('roles.create_submit existe', () => {
    expect(i18n.t('roles:create_submit')).not.toBe('roles:create_submit')
  })

  it('roles.create_submit_loading existe', () => {
    expect(i18n.t('roles:create_submit_loading')).not.toBe('roles:create_submit_loading')
  })
})

describe('namespace roles — en', () => {
  it('roles.empty em inglês existe', () => {
    const result = i18n.getFixedT('en', 'roles')('empty')
    expect(result).not.toBe('empty')
  })
})

describe('namespace bindings — pt-BR', () => {
  it('bindings.header existe', () => {
    expect(i18n.t('bindings:header')).not.toBe('bindings:header')
  })

  it('bindings.empty existe', () => {
    expect(i18n.t('bindings:empty')).not.toBe('bindings:empty')
  })

  it('bindings.col_user existe', () => {
    expect(i18n.t('bindings:col_user')).not.toBe('bindings:col_user')
  })

  it('bindings.col_role existe', () => {
    expect(i18n.t('bindings:col_role')).not.toBe('bindings:col_role')
  })

  it('bindings.col_resource_type existe', () => {
    expect(i18n.t('bindings:col_resource_type')).not.toBe('bindings:col_resource_type')
  })

  it('bindings.members_header existe', () => {
    expect(i18n.t('bindings:members_header')).not.toBe('bindings:members_header')
  })

  it('bindings.resource_types_header existe', () => {
    expect(i18n.t('bindings:resource_types_header')).not.toBe('bindings:resource_types_header')
  })
})

describe('namespace bindings — en', () => {
  it('bindings.empty em inglês existe', () => {
    const result = i18n.getFixedT('en', 'bindings')('empty')
    expect(result).not.toBe('empty')
  })
})
