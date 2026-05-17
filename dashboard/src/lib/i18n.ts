import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import ptBRCommon from '../locales/pt-BR/common.json'
import enCommon from '../locales/en/common.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'pt-BR',
    defaultNS: 'common',
    ns: ['common'],
    resources: {
      'pt-BR': { common: ptBRCommon },
      en: { common: enCommon },
    },
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
    },
  })

export default i18n
