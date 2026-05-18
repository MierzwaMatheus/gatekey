// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import i18n from '../lib/i18n'

beforeAll(async () => {
  await i18n.init()
})

describe('namespace playground — pt-BR', () => {
  it('playground.label_api_key existe', () => {
    expect(i18n.t('playground:label_api_key')).not.toBe('playground:label_api_key')
  })

  it('playground.label_body existe', () => {
    expect(i18n.t('playground:label_body')).not.toBe('playground:label_body')
  })

  it('playground.label_params existe', () => {
    expect(i18n.t('playground:label_params')).not.toBe('playground:label_params')
  })

  it('playground.label_example existe', () => {
    expect(i18n.t('playground:label_example')).not.toBe('playground:label_example')
  })

  it('playground.label_history existe', () => {
    expect(i18n.t('playground:label_history')).not.toBe('playground:label_history')
  })

  it('playground.btn_copy_curl existe', () => {
    expect(i18n.t('playground:btn_copy_curl')).not.toBe('playground:btn_copy_curl')
  })

  it('playground.btn_copy_sdk existe', () => {
    expect(i18n.t('playground:btn_copy_sdk')).not.toBe('playground:btn_copy_sdk')
  })
})

describe('namespace playground — en', () => {
  it('playground.label_history em inglês existe', () => {
    const result = i18n.getFixedT('en', 'playground')('label_history')
    expect(result).not.toBe('label_history')
  })
})
