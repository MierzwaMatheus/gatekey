import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import ptBRCommon from '../locales/pt-BR/common.json'
import enCommon from '../locales/en/common.json'
import ptBRAuth from '../locales/pt-BR/auth.json'
import enAuth from '../locales/en/auth.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'pt-BR',
    defaultNS: 'common',
    ns: ['common', 'auth'],
    resources: {
      'pt-BR': { common: ptBRCommon, auth: ptBRAuth },
      en: { common: enCommon, auth: enAuth },
    },
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
    },
  })

export default i18n
