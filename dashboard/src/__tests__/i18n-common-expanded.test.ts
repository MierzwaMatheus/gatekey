import { describe, it, expect, beforeAll } from 'vitest'
import i18n from '../lib/i18n'

beforeAll(async () => {
  await i18n.init()
})

describe('namespace common — root/org strings (pt-BR)', () => {
  const keys = [
    'nav.admin',
    'nav.orgs',
    'nav.sessions',
    'nav.capabilities',
    'nav.api_keys',
    'nav.quotas',
    'nav.cold_storage',
    'nav.settings',

    'orgs.empty_title',
    'orgs.empty_subtitle',
    'orgs.error',
    'orgs.col_name',
    'orgs.col_status',
    'orgs.col_users',
    'orgs.col_workspaces',
    'orgs.col_activity',
    'orgs.label',

    'caps.empty_title',
    'caps.empty_subtitle',
    'caps.catalog_base',
    'caps.add_to_catalog',
    'caps.adding',
    'caps.add_btn',

    'apikeys.none',
    'apikeys.last_used',
    'apikeys.create_btn',
    'apikeys.new_key',
    'apikeys.scopes_label',
    'apikeys.creating',
    'apikeys.create',
    'apikeys.secret_copy_warning',
    'apikeys.copied',
    'apikeys.copy',
    'apikeys.scopes',
    'apikeys.no_scopes',
    'apikeys.created_title',
    'apikeys.revoke',
    'apikeys.revoking',
    'apikeys.revoke_title',
    'apikeys.revoke_cancel',
    'apikeys.error_load',
    'apikeys.quota_exceeded',
    'apikeys.close_modal',

    'cold.provider_label',
    'cold.save',
    'cold.saved',
    'cold.disabled_msg',
    'cold.skip_label',

    'org_form.name_label',
    'org_form.admin_email_label',
    'org_form.creating',
    'org_form.create_btn',

    'org_actions.suspend',
    'org_actions.delete_btn',
    'org_actions.suspend_title',
    'org_actions.suspend_desc',
    'org_actions.suspend_confirm',
    'org_actions.suspending',
    'org_actions.delete_title',
    'org_actions.delete_confirm',
    'org_actions.deleting',

    'quotas.users_per_org',
    'quotas.workspaces_per_org',
    'quotas.users_per_workspace',
    'quotas.capabilities_per_org',
    'quotas.roles_per_workspace',
    'quotas.sessions_per_user',
    'quotas.api_keys_per_org',
    'quotas.save',
    'quotas.saving',
    'quotas.saved',

    'caps_org.base_catalog',
    'caps_org.custom_catalog',
    'caps_org.none_custom',
    'caps_org.new_cap',
    'caps_org.creating',
    'caps_org.create',
    'caps_org.error',

    'org_settings.login_methods_title',
    'org_settings.login_methods_desc',
    'org_settings.mfa_title',
    'org_settings.mfa_required_label',
    'org_settings.jwt_title',
    'org_settings.access_token_label',
    'org_settings.refresh_token_label',
    'org_settings.save',
    'org_settings.saving',
    'org_settings.saved',
    'org_settings.error',
  ]

  keys.forEach((key) => {
    it(`common.${key} existe`, () => {
      expect(i18n.t(`common:${key}`)).not.toBe(`common:${key}`)
    })
  })
})

describe('namespace common — root/org strings (en)', () => {
  it('common.orgs.label em inglês existe', () => {
    const result = i18n.getFixedT('en', 'common')('orgs.label')
    expect(result).not.toBe('orgs.label')
  })

  it('common.nav.admin em inglês existe', () => {
    const result = i18n.getFixedT('en', 'common')('nav.admin')
    expect(result).not.toBe('nav.admin')
  })
})
