// Setup file for vitest — initializes i18n for dashboard React tests
if (typeof document !== 'undefined') {
  const { default: i18n } = await import('./dashboard/src/lib/i18n')
  await i18n.changeLanguage('pt-BR')
}
