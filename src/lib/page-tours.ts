import { canonicalTourPath } from './onboarding.js';

export type PageTourAction =
  | 'overview'
  | 'inspect'
  | 'prepare'
  | 'filter'
  | 'create'
  | 'configure'
  | 'manage'
  | 'switch'
  | 'test'
  | 'save'
  | 'immediate'
  | 'danger';

export interface PageTourStep {
  target: string | readonly string[];
  titleKey: string;
  descriptionKey?: string;
  action: PageTourAction;
}

export interface PageTourProfile {
  version: number;
  titleKey: string;
  steps: readonly PageTourStep[];
}

const heading = '[data-tour="page-content"] h1';

const step = (
  target: PageTourStep['target'],
  titleKey: string,
  action: PageTourAction,
  descriptionKey?: string,
): PageTourStep => ({ target, titleKey, action, descriptionKey });

const profile = (titleKey: string, steps: readonly PageTourStep[]): PageTourProfile => ({
  // Version 4 spotlights the real controls named by each step's target. Anyone
  // who "completed" version 3 only ever saw a mock-up of the page, so their
  // progress is not worth carrying forward.
  version: 4,
  titleKey,
  steps,
});

export const PAGE_TOURS: Readonly<Record<string, PageTourProfile>> = {
  '/': profile('dashboard.title', [
    step(heading, 'dashboard.title', 'overview', 'dashboard.subtitle'),
    step('[data-tour="dashboard-summary"]', 'dashboard.online_adapters', 'inspect'),
    step('[data-tour="dashboard-server"]', 'dashboard.server_info', 'inspect'),
    step('[data-tour="dashboard-logs"]', 'dashboard.recent_logs', 'inspect'),
  ]),
  '/statistics': profile('statistics.title', [
    step(heading, 'statistics.title', 'overview', 'statistics.subtitle'),
    step('[data-tour="statistics-filters"]', 'statistics.date_range', 'filter', 'statistics.scope_collection_note'),
    step('[data-tour="statistics-summary"]', 'statistics.selected_period', 'inspect', 'statistics.sample_note'),
    step('[data-tour="statistics-trend"]', 'statistics.daily_trend', 'inspect', 'statistics.daily_trend_desc'),
    step('[data-tour="statistics-online"]', 'statistics.online_history', 'configure', 'statistics.online_history_desc'),
  ]),
  '/playground': profile('nav.playground', [
    step('[data-tour="playground-context"]', 'playground.scene', 'prepare', 'playground.welcome'),
    step('[data-tour="playground-chat"]', 'nav.playground', 'inspect', 'playground.welcome'),
    step('[data-tour="playground-shortcuts"]', 'commands.col_example', 'test'),
    step('[data-tour="playground-composer"]', 'playground.send', 'test', 'playground.input_placeholder'),
  ]),
  '/adapters': profile('adapters.title', [
    step(heading, 'adapters.title', 'overview', 'adapters.subtitle'),
    step('[data-tour="adapters-add"]', 'adapters.add', 'create', 'adapters.add_subtitle'),
    step('[data-tour="adapters-list"]', 'adapters.detail_connection_status', 'manage', 'adapters.no_adapters_hint'),
  ]),
  '/dice-rules': profile('dice.title', [
    step(heading, 'dice.title', 'overview', 'dice.subtitle'),
    step('[data-tour="dice-rule-groups"]', 'dice.title', 'configure', 'dice.subtitle'),
    step('[data-tour="dice-actions"]', 'dice.save_rules', 'save'),
  ]),
  '/replies': profile('replies.title', [
    step(heading, 'replies.title', 'overview', 'replies.subtitle'),
    step('[data-tour="replies-tabs"]', 'replies.tab_replies', 'switch'),
    step('[data-tour="replies-toolbar"]', 'replies.add', 'create', 'replies.form_desc'),
    step('[data-tour="replies-list"]', 'replies.col_actions', 'manage'),
    step('[data-tour="replies-preview"]', 'replies.preview_title', 'test', 'replies.preview_hint'),
  ]),
  '/decks': profile('decks.title', [
    step(heading, 'decks.title', 'overview', 'decks.subtitle'),
    step('[data-tour="decks-actions"]', 'decks.upload', 'create', 'decks.subtitle'),
    step('[data-tour="decks-list"]', 'decks.title', 'manage', 'decks.no_decks_hint'),
  ]),
  '/groups': profile('groups.title', [
    step(heading, 'groups.title', 'overview', 'groups.subtitle'),
    step('[data-tour="groups-toolbar"]', 'groups.search_placeholder', 'filter'),
    step('[data-tour="groups-list"]', 'groups.manage', 'manage', 'groups.subtitle'),
    step('[data-tour="groups-view-actions"]', 'groups.view_table', 'switch'),
  ]),
  '/players': profile('players.title', [
    step(heading, 'players.title', 'overview', 'players.subtitle'),
    step('[data-tour="players-filters"]', 'players.search', 'filter'),
    step('[data-tour="players-list"]', 'players.col_trust', 'immediate', 'players.subtitle'),
    step('[data-tour="players-list"]', 'players.detail_btn', 'manage'),
  ]),
  '/schedules': profile('nav.schedules', [
    step(heading, 'nav.schedules', 'overview', 'schedules.subtitle'),
    step('[data-tour="schedules-form"]', 'schedules.trigger_type', 'configure', 'schedules.add_hint'),
    step('[data-tour="schedules-submit"]', 'schedules.add', 'save'),
    step('[data-tour="schedules-list"]', 'schedules.run_now', 'manage'),
  ]),
  '/roadmap': profile('roadmap.title', [
    step(heading, 'roadmap.title', 'overview', 'roadmap.subtitle'),
    step('[data-tour="roadmap-progress"]', 'roadmap.overall', 'inspect'),
    step('[data-tour="roadmap-content"]', 'roadmap.show_completed', 'inspect'),
  ]),
  '/commands': profile('commands.title', [
    step(heading, 'commands.title', 'overview', 'commands.subtitle'),
    step('[data-tour="commands-toolbar"]', 'commands.persona_manage', 'configure', 'commands.persona_manage_desc'),
    step('[data-tour="commands-filters"]', 'commands.all_search', 'filter'),
    step('[data-tour="commands-list"]', 'commands.edit', 'manage', 'commands.preview_hint'),
  ]),
  '/help': profile('helpdoc.title', [
    step(heading, 'helpdoc.title', 'overview', 'helpdoc.desc'),
    step('[data-tour="help-toolbar"]', 'helpdoc.search', 'filter', 'helpdoc.desc'),
    step('[data-tour="help-toolbar"]', 'helpdoc.new', 'create'),
    step('[data-tour="help-content"]', 'helpdoc.view_grouped', 'manage', 'helpdoc.readonly_hint'),
  ]),
  '/modules': profile('modules.title', [
    step(heading, 'modules.title', 'overview', 'modules.subtitle'),
    step('[data-tour="modules-actions"]', 'modules.upload', 'create', 'modules.template_hint'),
    step('[data-tour="modules-tabs"]', 'modules.tab_js', 'switch'),
    step('[data-tour="modules-list"]', 'modules.config', 'manage', 'modules.config_desc'),
  ]),
  '/rules': profile('rules.title', [
    step(heading, 'rules.title', 'overview', 'rules.desc'),
    step('[data-tour="rules-actions"]', 'rules.import_bundle', 'create', 'rules.bundles_hint'),
    step(['[data-tour="rules-bundles"]', '[data-tour="rules-list"]'], 'rules.toggle', 'immediate', 'rules.desc'),
    step('[data-tour="rules-list"]', 'rules.edit', 'manage'),
  ]),
  '/permissions': profile('banlist.title', [
    step(heading, 'banlist.title', 'overview', 'banlist.desc'),
    step('[data-tour="permissions-tabs"]', 'banlist.tab_perm', 'switch'),
    step('[data-tour="permissions-trust"]', 'banlist.perm_users', 'immediate', 'banlist.perm_users_desc'),
    step('[data-tour="permissions-whitelist"]', 'banlist.perm_white_group', 'configure', 'banlist.perm_white_group_desc'),
  ]),
  '/settings': profile('settings.title', [
    step(heading, 'settings.title', 'overview', 'settings.subtitle'),
    step('[data-setting-anchor="settings-master"]', 'settings.master_title', 'configure', 'settings.master_desc'),
    step('[data-setting-anchor="settings-prefix"]', 'settings.prefix_title', 'configure', 'settings.prefix_desc'),
    step('[data-setting-anchor="settings-scope"]', 'settings.scope_title', 'configure', 'settings.scope_desc'),
    step('[data-setting-anchor="settings-approval"]', 'settings.approval_title', 'configure', 'settings.approval_desc'),
  ]),
  '/ai': profile('ai.sec_models', [
    step(heading, 'ai.sec_models', 'overview', 'ai.desc'),
    step('[data-setting-anchor="ai-master"]', 'ai.master', 'configure', 'ai.master_desc'),
    step('[data-setting-anchor="ai-models"]', 'ai.models', 'configure', 'ai.no_models'),
    step('[data-setting-anchor="ai-params"]', 'ai.params', 'configure', 'ai.params_desc'),
    step('[data-tour="ai-save"]', 'common.save', 'save'),
  ]),
  '/ai/chat': profile('ai.sec_chat', [
    step(heading, 'ai.sec_chat', 'overview', 'ai.chat_desc'),
    step('[data-setting-anchor="ai-chat"]', 'ai.chat', 'configure', 'ai.chat_trigger_desc'),
    step('[data-setting-anchor="ai-memory-short"]', 'ai.mem', 'configure', 'ai.mem_desc'),
    step('[data-setting-anchor="ai-tools"]', 'ai.tools', 'configure', 'ai.tools_desc'),
    step('[data-setting-anchor="ai-whitelist"]', 'ai.wl', 'configure', 'ai.wl_desc'),
    step('[data-tour="ai-save"]', 'common.save', 'save'),
  ]),
  '/ai/npc': profile('ai.sec_npc', [
    step(heading, 'ai.sec_npc', 'overview', 'ai.npc_desc'),
    step('[data-setting-anchor="ai-npc"]', 'ai.npc_add', 'create', 'ai.npc_desc'),
    step('[data-setting-anchor="ai-npc"]', 'ai.npc_triggers', 'configure', 'ai.npc_note'),
    step('[data-tour="ai-save"]', 'common.save', 'save'),
  ]),
  '/ai/polish': profile('ai.sec_polish', [
    step(heading, 'ai.sec_polish', 'overview', 'ai.polish_desc'),
    step('[data-setting-anchor="ai-polish"]', 'ai.polish', 'configure', 'ai.polish_desc'),
    step('[data-setting-anchor="ai-polish"]', 'ai.cov', 'configure', 'ai.cov_desc'),
    step('[data-tour="ai-save"]', 'common.save', 'save'),
  ]),
  '/ai/translate': profile('ai.sec_translate', [
    step(heading, 'ai.sec_translate', 'overview', 'ai.trans_desc'),
    step('[data-setting-anchor="ai-translate"]', 'ai.trans_langs', 'create', 'ai.trans_desc'),
    step('[data-setting-anchor="ai-translate"]', 'ai.trans_scope', 'configure', 'ai.trans_note'),
    step('[data-tour="ai-save"]', 'common.save', 'save'),
  ]),
  '/notice-settings': profile('noticeset.title', [
    step(heading, 'noticeset.title', 'overview', 'noticeset.desc'),
    step('[data-tour="notice-tabs"]', 'noticeset.tab_windows', 'switch'),
    step('[data-tour="notice-add"]', 'noticeset.win_add', 'create', 'noticeset.win_hint'),
    step('[data-setting-anchor="notice-windows"]', 'noticeset.audit_event', 'configure', 'noticeset.win_hint'),
    step('[data-tour="notice-save"]', 'common.save', 'save'),
  ]),
  '/webui-settings': profile('webui.title', [
    step(heading, 'webui.title', 'overview', 'webui.desc'),
    step('[data-setting-anchor="webui-api-key"]', 'settings.api_key_title', 'configure', 'settings.api_key_desc'),
    step('[data-setting-anchor="webui-password"]', 'settings.webpw_title', 'configure', 'settings.webpw_desc'),
    step('[data-setting-anchor="webui-server"]', 'settings.server_title', 'danger', 'settings.server_desc'),
    step('[data-setting-anchor="webui-theme"]', 'settings.theme_title', 'immediate', 'settings.theme_desc'),
  ]),
  '/about': profile('about.title', [
    step(heading, 'about.title', 'overview', 'about.subtitle'),
    step('[data-tour="about-version"]', 'about.version_title', 'inspect'),
    step('[data-setting-anchor="about-update"]', 'about.update_title', 'danger', 'about.update_desc'),
    step('[data-tour="about-stack"]', 'about.stack_title', 'inspect'),
  ]),
  '/backup': profile('backup.title', [
    step(heading, 'backup.title', 'overview', 'backup.subtitle'),
    step('[data-tour="backup-legacy"]', 'backup.legacy_title', 'create', 'backup.legacy_desc'),
    step('[data-tour="backup-manual"]', 'backup.backup_restore_title', 'danger', 'backup.backup_restore_desc'),
    step('[data-tour="backup-auto"]', 'onboarding.backup_auto_title', 'configure', 'onboarding.backup_auto_body'),
    step('[data-tour="backup-archives"]', 'onboarding.backup_archives_title', 'danger', 'onboarding.backup_archives_body'),
  ]),
  '/logs': profile('logs.title', [
    step(heading, 'logs.title', 'overview', 'logs.subtitle'),
    step('[data-tour="logs-search"]', 'logs.search_ph', 'filter'),
    step('[data-tour="logs-tabs"]', 'logs.tab_sessions', 'switch'),
    step('[data-tour="logs-content"]', 'logs.col_actions', 'manage', 'logs.session_delete_keeps_logs'),
  ]),
};

export function getPageTourProfile(path: string): PageTourProfile | undefined {
  return PAGE_TOURS[canonicalTourPath(path)];
}
