// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import i18n from '../lib/i18n'

beforeAll(async () => {
  await i18n.init()
})

describe('i18next configuration', () => {
  it('is initialized', () => {
    expect(i18n.isInitialized).toBe(true)
  })

  it('has a defined language', () => {
    expect(i18n.language).toBeDefined()
    expect(typeof i18n.language).toBe('string')
  })

  it('translates app_name key', () => {
    const result = i18n.t('common:app_name')
    expect(result).toBe('GateKey')
  })
})
