import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import ptBRCommon from '../locales/pt-BR/common.json'
import enCommon from '../locales/en/common.json'
import ptBRAuth from '../locales/pt-BR/auth.json'
import enAuth from '../locales/en/auth.json'
import ptBRUsers from '../locales/pt-BR/users.json'
import enUsers from '../locales/en/users.json'
import ptBRRoles from '../locales/pt-BR/roles.json'
import enRoles from '../locales/en/roles.json'
import ptBRBindings from '../locales/pt-BR/bindings.json'
import enBindings from '../locales/en/bindings.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'pt-BR',
    defaultNS: 'common',
    ns: ['common', 'auth', 'users', 'roles', 'bindings'],
    resources: {
      'pt-BR': { common: ptBRCommon, auth: ptBRAuth, users: ptBRUsers, roles: ptBRRoles, bindings: ptBRBindings },
      en: { common: enCommon, auth: enAuth, users: enUsers, roles: enRoles, bindings: enBindings },
    },
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
    },
  })

export default i18n
