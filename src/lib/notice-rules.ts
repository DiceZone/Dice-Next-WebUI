export interface NoticeChannel {
  kind: 'chat' | 'smtp' | 'webhook'; platform?: string; chat_id?: string; is_group?: boolean;
  name?: string; display_name?: string; delivery?: 'auto' | 'selected'; adapter_ids?: string[];
  to?: string; url?: string; transport?: string;
}
export interface NoticeRule {
  id?: string; name: string; enabled: boolean; legacy?: boolean;
  subscription: 'levels' | 'events'; level_mask: number; events: string[];
  source: { mode: 'all' | 'platforms' | 'accounts'; platforms: string[]; adapter_ids: string[]; include_system: boolean };
  channels: NoticeChannel[];
}
export interface NoticeAccount { id: string; name: string; platform: string; login_id: string; login_name: string }
export interface NoticeMeta { catalog: { op: string; area: number }[]; accounts: NoticeAccount[]; smtp_ready: boolean; smtp_host: string; smtp_from: string }
export const emptyNoticeRule = (): NoticeRule => ({ name: '', enabled: true, subscription: 'levels', level_mask: 15, events: [],
  source: { mode: 'all', platforms: [], adapter_ids: [], include_system: true }, channels: [] });
export function channelTitle(channel: NoticeChannel, fallback: string): string {
  if (channel.kind === 'smtp') return channel.to || fallback;
  if (channel.kind === 'webhook') { try { return new URL(channel.url || '').host; } catch { return fallback; } }
  return [channel.display_name, channel.name].find(name => name && name !== channel.chat_id && name !== '用户') || fallback;
}
export function eventIsSelected(rule: NoticeRule, event: { op: string; area: number }): boolean {
  return rule.subscription === 'levels' ? Boolean(rule.level_mask & event.area) : rule.events.includes(event.op);
}
export function setEvent(rule: NoticeRule, op: string, catalog: NoticeMeta['catalog']): NoticeRule {
  const selected = catalog.filter(event => eventIsSelected(rule, event)).map(event => event.op);
  return { ...rule, subscription: 'events', events: selected.includes(op) ? selected.filter(key => key !== op) : [...selected, op] };
}
export const toggleSelection = (values: string[], value: string) => values.includes(value) ? values.filter(item => item !== value) : [...values, value];
/** Never use stale list data to undo a page change while its request is in flight. */
export function noticePageCorrection(current: number, returned: number | undefined, loading: boolean, error: boolean): number | undefined {
  return !loading && !error && returned !== undefined && returned !== current ? returned : undefined;
}
export function channelKey(channel: NoticeChannel): string {
  return JSON.stringify([channel.kind, channel.platform, channel.chat_id, channel.is_group, channel.to, channel.url]);
}
