import { canonicalTourPath } from '@/lib/onboarding';

export interface PageTourProfile {
  version: number;
  titleKey: string;
  descriptionKey: string;
  demo: readonly [PageTourDemoField, PageTourDemoField, PageTourDemoField];
}

export interface PageTourDemoField {
  labelKey: string;
  value: string;
}

const field = (labelKey: string, value: string): PageTourDemoField => ({ labelKey, value });

const profile = (
  titleKey: string,
  descriptionKey: string,
  demo: readonly [PageTourDemoField, PageTourDemoField, PageTourDemoField],
): PageTourProfile => ({ version: 1, titleKey, descriptionKey, demo });

export const PAGE_TOURS: Readonly<Record<string, PageTourProfile>> = {
  '/': profile('dashboard.title', 'dashboard.subtitle', [field('dashboard.online_adapters', 'OneBot v11'), field('dashboard.total_commands', '1,248'), field('dashboard.uptime', '24 h')]),
  '/statistics': profile('statistics.title', 'statistics.subtitle', [field('statistics.date_range', '30 d'), field('statistics.platform_filter', 'OneBot v11'), field('statistics.availability', '99.9%')]),
  '/playground': profile('nav.playground', 'playground.welcome', [field('playground.scene', 'Group · OneBot v11'), field('commands.col_cmd', '.r 1d100'), field('playground.send', '1d100 = 64')]),
  '/adapters': profile('adapters.title', 'adapters.subtitle', [field('adapters.detail_protocol', 'OneBot v11'), field('adapters.endpoint', 'ws://127.0.0.1:3001'), field('adapters.detail_connection_status', '320 ms')]),
  '/dice-rules': profile('dice.title', 'dice.subtitle', [field('dice.enable_coc', 'CoC 7th'), field('dice.default_sides', 'd100'), field('dice.test_roll', '42 / 60')]),
  '/replies': profile('replies.title', 'replies.subtitle', [field('replies.match_type', 'Regex'), field('replies.match_content', '^hello$'), field('replies.enabled_label', '✓')]),
  '/decks': profile('decks.title', 'decks.subtitle', [field('decks.upload', 'tarot.json'), field('commands.col_cmd', '.draw tarot'), field('decks.saved', 'The Fool')]),
  '/groups': profile('groups.title', 'groups.subtitle', [field('groups.account_scope', 'OneBot v11:10001'), field('groups.bot_card', 'Dice!'), field('groups.bot_on', '✓')]),
  '/players': profile('players.title', 'players.subtitle', [field('players.col_id', 'OneBot v11:10001'), field('players.col_attr', 'SAN 60'), field('players.col_trust', '+40')]),
  '/schedules': profile('nav.schedules', 'schedules.subtitle', [field('schedules.group', '10001'), field('schedules.everyday_label', '21:00'), field('schedules.content', '.draw news')]),
  '/roadmap': profile('roadmap.title', 'roadmap.subtitle', [field('roadmap.overall', '68%'), field('roadmap.show_completed', '12 / 18'), field('roadmap.hide_completed', '✓')]),
  '/commands': profile('commands.title', 'commands.subtitle', [field('commands.col_cmd', '.ra'), field('commands.col_example', '.ra Spot Hidden 60'), field('commands.col_reply', '42 / 60')]),
  '/help': profile('helpdoc.title', 'helpdoc.desc', [field('helpdoc.search', 'CoC'), field('helpdoc.src_builtin', '.ra'), field('helpdoc.view_grouped', '3 results')]),
  '/modules': profile('modules.title', 'modules.subtitle', [field('modules.detail_file', 'example.js'), field('modules.config', 'debug=false'), field('modules.reload', '✓')]),
  '/rules': profile('rules.title', 'rules.desc', [field('rules.tab_packs', 'CoC 7th'), field('rules.import', 'coc7.json'), field('rules.toggle', '✓')]),
  '/permissions': profile('banlist.title', 'banlist.desc', [field('banlist.id', '10001'), field('banlist.perm_col_trust', '+40'), field('banlist.perm_col_status', '✓')]),
  '/settings': profile('settings.title', 'settings.subtitle', [field('settings.scope_title', 'Global'), field('settings.prefix_title', '.'), field('settings.scope_current_global', '✓')]),
  '/ai': profile('ai.sec_models', 'ai.desc', [field('ai.base_url', 'https://api.example/v1'), field('ai.model_id', 'gpt-4.1-mini'), field('ai.test', '320 ms')]),
  '/ai/chat': profile('ai.sec_chat', 'ai.chat_desc', [field('ai.chat_model', 'gpt-4.1-mini'), field('ai.chat_trigger', '@Dice'), field('ai.chat_rounds', '12')]),
  '/ai/npc': profile('ai.sec_npc', 'ai.npc_desc', [field('ai.npc_name', 'Innkeeper'), field('ai.npc_triggers', 'boss'), field('ai.npc_on', '✓')]),
  '/ai/polish': profile('ai.sec_polish', 'ai.polish_desc', [field('ai.polish_model', 'gpt-4.1-mini'), field('ai.polish_mode', 'RP'), field('ai.polish_persona', 'Concise')]),
  '/ai/translate': profile('ai.sec_translate', 'ai.trans_desc', [field('ai.trans_lang_name', 'Deutsch'), field('ai.trans_scope', 'Roll'), field('ai.trans_model', 'gpt-4.1-mini')]),
  '/notice-settings': profile('noticeset.title', 'noticeset.desc', [field('noticeset.audit_event', 'System warning'), field('noticeset.push_smtp', 'smtp.example.com'), field('noticeset.push_test', '✓')]),
  '/webui-settings': profile('webui.title', 'webui.desc', [field('settings.api_key_title', '••••••••'), field('settings.theme_title', '#0f172a'), field('settings.log_title', 'INFO')]),
  '/about': profile('about.title', 'about.subtitle', [field('about.current_version', 'v3.0.0'), field('about.latest_version', 'v3.0.0'), field('about.phase_up_to_date', '✓')]),
  '/backup': profile('backup.title', 'backup.subtitle', [field('backup.legacy_title', '/data/Dice'), field('backup.backup_restore_title', 'dice-next.zip'), field('backup.backup_downloaded', '✓')]),
  '/logs': profile('logs.title', 'logs.subtitle', [field('logs.session_code', '#42'), field('logs.col_game', 'CoC 7th'), field('logs.export_html', 'session-42.html')]),
};

export function getPageTourProfile(path: string): PageTourProfile | undefined {
  return PAGE_TOURS[canonicalTourPath(path)];
}
