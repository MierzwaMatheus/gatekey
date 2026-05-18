import { useTranslation } from 'react-i18next'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const current = i18n.language

  function switchTo(lang: string) {
    i18n.changeLanguage(lang)
  }

  return (
    <div className="flex items-center gap-1">
      <button
        data-testid="lang-pt-br"
        data-active={current === 'pt-BR' || current.startsWith('pt')}
        onClick={() => switchTo('pt-BR')}
        className={[
          'px-2 py-0.5 text-[10px] font-mono rounded transition-colors cursor-pointer',
          current === 'pt-BR' || current.startsWith('pt')
            ? 'text-accent-primary bg-accent-subtle border border-accent-primary/30'
            : 'text-text-secondary hover:text-text-primary border border-transparent hover:border-border-default',
        ].join(' ')}
      >
        PT
      </button>
      <button
        data-testid="lang-en"
        data-active={current === 'en' || current.startsWith('en-')}
        onClick={() => switchTo('en')}
        className={[
          'px-2 py-0.5 text-[10px] font-mono rounded transition-colors cursor-pointer',
          current === 'en' || current.startsWith('en-')
            ? 'text-accent-primary bg-accent-subtle border border-accent-primary/30'
            : 'text-text-secondary hover:text-text-primary border border-transparent hover:border-border-default',
        ].join(' ')}
      >
        EN
      </button>
    </div>
  )
}
