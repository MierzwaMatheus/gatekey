// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '../lib/i18n'
import { LanguageSwitcher } from '../components/ui/language-switcher'

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR')
})

describe('LanguageSwitcher', () => {
  it('renderiza botões PT-BR e EN', () => {
    render(<LanguageSwitcher />)
    expect(screen.getByTestId('lang-pt-br')).toBeTruthy()
    expect(screen.getByTestId('lang-en')).toBeTruthy()
  })

  it('marca PT-BR como ativo por padrão', () => {
    render(<LanguageSwitcher />)
    const btn = screen.getByTestId('lang-pt-br')
    expect(btn.getAttribute('data-active')).toBe('true')
  })

  it('muda idioma para EN ao clicar', async () => {
    render(<LanguageSwitcher />)
    fireEvent.click(screen.getByTestId('lang-en'))
    expect(i18n.language).toBe('en')
    await i18n.changeLanguage('pt-BR')
  })
})
