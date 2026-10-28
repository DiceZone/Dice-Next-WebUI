export const SHORTCUT_STORAGE_KEY = 'dice-next:dashboard-shortcuts';
export const MAX_SHORTCUTS = 6;
export const SHORTCUT_OPTIONS = [
  ['/', 'nav.dashboard'], ['/statistics', 'nav.statistics'], ['/playground', 'nav.playground'],
  ['/adapters', 'nav.adapters'], ['/replies', 'nav.custom_replies'], ['/qq-official', 'qq_editor.title'],
  ['/commands', 'nav.commands'], ['/help', 'nav.help'], ['/modules', 'nav.modules'],
  ['/rules', 'nav.rules'], ['/decks', 'nav.decks'], ['/files', 'image_resources.title'],
  ['/groups', 'nav.groups'], ['/players', 'nav.players'], ['/logs', 'nav.logs'],
  ['/permissions', 'nav.banlist'], ['/ai', 'nav.ai_models'], ['/ai/chat', 'nav.ai_chat'],
  ['/ai/npc', 'nav.ai_npc'], ['/ai/polish', 'nav.ai_polish'], ['/ai/translate', 'nav.ai_translate'],
  ['/settings', 'nav.settings'], ['/cloud-services', 'cloud.title'], ['/mcp', 'mcp.title'],
  ['/notice-settings', 'nav.notice'], ['/webui-settings', 'nav.webui'], ['/schedules', 'nav.schedules'],
  ['/backup', 'nav.backup'], ['/roadmap', 'nav.roadmap'], ['/about', 'nav.about'],
] as const;
export const DEFAULT_SHORTCUTS = ['/playground', '/replies', '/settings'];
export function normalizeShortcuts(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_SHORTCUTS];
  const allowed = new Set<string>(SHORTCUT_OPTIONS.map(([path]) => path));
  return [...new Set(value.filter((path): path is string => typeof path === 'string' && allowed.has(path)))].slice(0, MAX_SHORTCUTS);
}
export function readShortcuts(storage: Pick<Storage, 'getItem'>): string[] {
  try {
    const value = storage.getItem(SHORTCUT_STORAGE_KEY);
    return value === null ? [...DEFAULT_SHORTCUTS] : normalizeShortcuts(JSON.parse(value));
  } catch { return [...DEFAULT_SHORTCUTS]; }
}
export function moveShortcut(paths: string[], index: number, direction: -1 | 1): string[] {
  const result = [...paths], next = index + direction;
  if (index >= 0 && index < result.length && next >= 0 && next < result.length)
    [result[index], result[next]] = [result[next], result[index]];
  return result;
}
