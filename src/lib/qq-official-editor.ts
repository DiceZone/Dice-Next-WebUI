export type QQObject = Record<string, unknown>;
export type QQScope = 'c2c' | 'group' | 'channel' | 'dm';
export const QQ_SCOPES: QQScope[] = ['c2c', 'group', 'channel', 'dm'];
export interface MenuItemDraft {
  key: string; name: string; type: string; message: string; link: string;
  switchId: string; switchDefault: boolean; children: MenuItemDraft[]; source: QQObject;
}
export interface MenuDraft { items: MenuItemDraft[]; source: QQObject; version?: number }
export interface PanelItemDraft { key: string; name: string; desc: string; type: string; link: string; onlyAdmin: boolean; source: QQObject }
export interface PanelDraft {
  id: string; scope: QQScope; targetType: 'all' | 'specific'; items: PanelItemDraft[];
  remark: string; targets: string[]; source: QQObject; version?: number;
}
export interface EditorIssue { key: string; path?: string; max?: number }
let sequence = 0;
const key = () => `qq-editor-${++sequence}`;
export const object = (value: unknown): QQObject => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as QQObject : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const version = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;

// The WebUI envelope is removed by apiClient; a few official endpoints retain
// their own data wrapper. Never treat a malformed payload as an empty editor.
export function platformData(value: unknown): QQObject {
  const root = object(value);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_response');
  return !['menu', 'panel_id', 'records', 'version'].some((field) => field in root)
    && root.data !== undefined && Object.keys(object(root.data)).length > 0 ? object(root.data) : root;
}
export function newMenuItem(type = 'send_message'): MenuItemDraft {
  return { key: key(), name: '', type, message: '', link: '', switchId: '', switchDefault: false, children: [], source: {} };
}
function readMenuItem(value: unknown, depth: number): MenuItemDraft {
  const source = object(value);
  if (Object.keys(source).length === 0 || depth > 1 || (source.sub_menu_items !== undefined && !Array.isArray(source.sub_menu_items))) throw new Error('invalid_response');
  const toggle = object(source.switch);
  if (['name', 'type', 'send_message', 'link'].some((field) => source[field] !== undefined && typeof source[field] !== 'string')
    || (toggle.default !== undefined && typeof toggle.default !== 'boolean')) throw new Error('invalid_response');
  return { ...newMenuItem(text(source.type)), source, name: text(source.name), message: text(source.send_message), link: text(source.link),
    switchId: text(toggle.switch_id), switchDefault: toggle.default === true,
    children: Array.isArray(source.sub_menu_items) ? source.sub_menu_items.map((child) => readMenuItem(child, depth + 1)) : [] };
}
export function readMenu(value: unknown): MenuDraft {
  const data = platformData(value);
  if (!('menu' in data) && Object.keys(data).some((field) => field !== 'version')) throw new Error('invalid_response');
  if (data.menu != null && (typeof data.menu !== 'object' || Array.isArray(data.menu))) throw new Error('invalid_response');
  const source = object(data.menu);
  if (source.items !== undefined && !Array.isArray(source.items)) throw new Error('invalid_response');
  return { source, version: version(data.version), items: Array.isArray(source.items) ? source.items.map((item) => readMenuItem(item, 0)) : [] };
}
export function menuItemWire(item: MenuItemDraft): QQObject {
  const value: QQObject = { ...item.source, name: item.name, type: item.type };
  for (const field of ['send_message', 'link', 'switch', 'sub_menu_items']) delete value[field];
  if (item.type === 'send_message') value.send_message = item.message;
  else if (item.type === 'link') value.link = item.link;
  else if (item.type === 'switch') value.switch = { ...object(item.source.switch), switch_id: item.switchId, default: item.switchDefault };
  else if (item.type === 'menu') value.sub_menu_items = item.children.map(menuItemWire);
  return value;
}
export const menuBody = (draft: MenuDraft) => ({ menu: { ...draft.source, items: draft.items.map(menuItemWire) } });
export function changeMenuType(item: MenuItemDraft, type: string): MenuItemDraft {
  return { ...item, type, children: type === 'menu' ? item.children : [], source: { ...item.source } };
}
export function newPanel(scope: QQScope): PanelDraft {
  return { id: '', scope, targetType: 'all', items: [], remark: '', targets: [], source: {} };
}
export function newPanelItem(): PanelItemDraft { return { key: key(), name: '', desc: '', type: 'command', link: '', onlyAdmin: false, source: {} }; }
export function readPanel(value: unknown): PanelDraft {
  const data = platformData(value), panel = object(data.panel);
  if (!text(data.panel_id) || !QQ_SCOPES.includes(data.scope as QQScope) || !['all', 'specific'].includes(text(data.target_type))
    || !data.panel || typeof data.panel !== 'object' || Array.isArray(data.panel) || !Array.isArray(panel.items ?? [])) throw new Error('invalid_response');
  const rawTargets = data.scope === 'group' ? data.group_openids : data.user_openids;
  if (rawTargets !== undefined && (!Array.isArray(rawTargets) || rawTargets.some((id) => typeof id !== 'string'))) throw new Error('invalid_response');
  return { id: text(data.panel_id), scope: data.scope as QQScope, targetType: data.target_type as PanelDraft['targetType'],
    source: panel, remark: text(panel.remark), version: version(data.version) ?? version(panel.version),
    targets: Array.isArray(rawTargets) ? [...rawTargets] as string[] : [],
    items: (panel.items as unknown[] | undefined ?? []).map((entry) => {
      const source = object(entry); if (!Object.keys(source).length) throw new Error('invalid_response');
      if (['name', 'type', 'desc', 'link'].some((field) => source[field] !== undefined && typeof source[field] !== 'string')
        || (source.only_admin !== undefined && typeof source.only_admin !== 'boolean')) throw new Error('invalid_response');
      return { ...newPanelItem(), source, type: text(source.type), name: text(source.name), desc: text(source.desc), link: text(source.link), onlyAdmin: source.only_admin === true };
    }) };
}
export function readPanelList(value: unknown): { records: PanelDraft[]; next: string } {
  const data = platformData(value);
  if (!Array.isArray(data.records) || (data.next_cursor !== undefined && typeof data.next_cursor !== 'string')) throw new Error('invalid_response');
  return { records: data.records.map(readPanel), next: data.is_end === true ? '' : text(data.next_cursor) };
}
export function panelBody(draft: PanelDraft, create = !draft.id): QQObject {
  const panel: QQObject = { ...draft.source, remark: draft.remark, items: draft.items.map((item) => {
    const value: QQObject = { ...item.source, type: item.type, name: item.name, desc: item.desc, only_admin: item.onlyAdmin };
    delete value.link; if (item.type === 'link') value.link = item.link;
    return value;
  }) };
  // Version is an observed revision, not a caller-assigned new revision.
  delete panel.version;
  if (!create) return { panel };
  return { scope: draft.scope, target_type: draft.targetType, panel,
    ...(draft.targetType === 'specific' ? { [draft.scope === 'group' ? 'group_openids' : 'user_openids']: draft.targets } : {}) };
}
export function parseTargets(value: string): string[] { return [...new Set(value.split(/[\s,，;；]+/u).map((id) => id.trim()).filter(Boolean))]; }
export function targetBody(draft: Pick<PanelDraft, 'id' | 'scope' | 'targetType'>, op: 'add' | 'del', targets: string[]): QQObject {
  if (!draft.id || draft.targetType !== 'specific' || !['c2c', 'group'].includes(draft.scope) || !['add', 'del'].includes(op)
    || targets.length < 1 || targets.length > 20 || targets.some((id) => !id.trim() || id.length > 4096)) throw new Error('invalid_targets');
  return { panelId: draft.id, op, [draft.scope === 'group' ? 'groupOpenIds' : 'userOpenIds']: targets };
}
// QQ counts Chinese/full-width characters as two display units. Count Unicode
// code points (not UTF-16 halves), including wide kana and emoji.
export function qqTextWidth(value: string): number {
  return Array.from(value).reduce((sum, char) => {
    const cp = char.codePointAt(0)!;
    const wide = cp >= 0x1100 && (cp <= 0x115f || cp === 0x2329 || cp === 0x232a || (cp >= 0x2e80 && cp <= 0xa4cf)
      || (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe10 && cp <= 0xfe6f)
      || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1faff) || cp >= 0x20000);
    return sum + (wide ? 2 : 1);
  }, 0);
}
const https = (value: string) => { try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; } catch { return false; } };
export function validateMenu(draft: MenuDraft): EditorIssue[] {
  const issues: EditorIssue[] = [], switches = new Set<string>();
  if (draft.items.length > 10) issues.push({ key: 'items_limit', max: 10 });
  const visit = (items: MenuItemDraft[], parent = '') => items.forEach((item, index) => {
    const path = parent ? `${parent} / ${index + 1}` : `${index + 1}`, max = parent ? 14 : 10;
    if (!item.name.trim()) issues.push({ key: 'name_required', path });
    if (qqTextWidth(item.name) > max) issues.push({ key: 'text_limit', path, max });
    if (!(parent ? ['send_message', 'link'] : ['send_message', 'link', 'menu', 'switch']).includes(item.type)) issues.push({ key: 'type_invalid', path });
    if (item.type === 'send_message' && !item.message.trim()) issues.push({ key: 'message_required', path });
    if (item.type === 'link' && !https(item.link)) issues.push({ key: 'https_required', path });
    if (item.type === 'menu') {
      if (item.children.length < 1 || item.children.length > 5) issues.push({ key: 'children_limit', path, max: 5 });
      visit(item.children, path);
    }
    if (item.type === 'switch') {
      if (!item.switchId.trim() || /[\s=]/u.test(item.switchId)) issues.push({ key: 'switch_required', path });
      if (switches.has(item.switchId)) issues.push({ key: 'switch_duplicate', path });
      switches.add(item.switchId);
    }
  }); visit(draft.items); return issues;
}
export function validatePanel(draft: PanelDraft): EditorIssue[] {
  const issues: EditorIssue[] = [];
  if (!QQ_SCOPES.includes(draft.scope) || (!['c2c', 'group'].includes(draft.scope) && draft.targetType !== 'all')) issues.push({ key: 'scope_invalid' });
  if (draft.items.length > 20) issues.push({ key: 'items_limit', max: 20 });
  if (Array.from(draft.remark).length > 255) issues.push({ key: 'remark_limit', max: 255 });
  if (!draft.id && draft.targetType === 'specific' && (draft.targets.length < 1 || draft.targets.length > 20)) issues.push({ key: 'targets_limit', max: 20 });
  if (!draft.id && draft.targets.some((id) => !id.trim() || id.length > 4096)) issues.push({ key: 'invalid_targets' });
  draft.items.forEach((item, index) => {
    const path = `${index + 1}`;
    if (!item.name.trim()) issues.push({ key: 'name_required', path });
    if (qqTextWidth(item.name) > 14 || qqTextWidth(item.desc) > 30) issues.push({ key: 'panel_text_limit', path });
    if (!['command', 'link'].includes(item.type)) issues.push({ key: 'type_invalid', path });
    if (item.type === 'link' && !https(item.link)) issues.push({ key: 'https_required', path });
  }); return issues;
}
export function fingerprint(value: unknown): string {
  const stable = (entry: unknown): unknown => Array.isArray(entry) ? entry.map(stable) : entry && typeof entry === 'object'
    ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)).map(([name, child]) => [name, stable(child)])) : entry;
  return JSON.stringify(stable(value));
}
export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  if (index < 0 || index >= items.length || index + delta < 0 || index + delta >= items.length) return items;
  const next = [...items]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next;
}
