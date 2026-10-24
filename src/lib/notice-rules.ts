export interface NoticeChannel {
  kind: 'chat' | 'smtp' | 'webhook'; platform?: string; chat_id?: string; is_group?: boolean;
  name?: string; display_name?: string; delivery?: 'auto' | 'selected'; adapter_ids?: string[];
  to?: string; url?: string; transport?: string;
  profile?: WebhookProfile; method?: 'POST' | 'PUT' | 'PATCH'; headers?: Record<string, string>;
  body_template?: Record<string, unknown>; sign_secret?: string; preferred_adapter?: string; notice_window_id?: string;
}
export interface NoticeRule {
  id?: string; name: string; enabled: boolean; legacy?: boolean;
  subscription: 'levels' | 'events'; level_mask: number; events: string[];
  source: { mode: 'all' | 'platforms' | 'accounts'; platforms: string[]; adapter_ids: string[]; include_system: boolean };
  channels: NoticeChannel[];
}
export interface NoticeAccount { id: string; name: string; platform: string; login_id: string; login_name: string }
export interface NoticeMeta { catalog: { op: string; area: number }[]; accounts: NoticeAccount[]; smtp_ready: boolean; smtp_host: string; smtp_from: string; legacy_smtp_ready?: boolean }
export type WebhookProfile = 'generic' | 'wecom' | 'dingtalk' | 'feishu' | 'custom';
export type NoticeSubscription = Omit<NoticeRule, 'id' | 'channels' | 'legacy'> & {
  sender?: Pick<NoticeChannel, 'delivery' | 'adapter_ids' | 'preferred_adapter'>;
};
export interface NoticeWindow {
  id?: string; name: string; enabled: boolean; channel: NoticeChannel;
  subscriptions: NoticeSubscription[]; mixed_delivery?: boolean;
}
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
  return channel.kind === 'chat'
    ? JSON.stringify([channel.kind, channel.platform || '', channel.chat_id || '', channel.is_group ?? true])
    : JSON.stringify([channel.kind, channel.kind === 'smtp' ? (channel.to || '').toLowerCase() : channel.url || '']);
}
export function emptyNoticeSubscription(): NoticeSubscription {
  const { channels: _, ...policy } = emptyNoticeRule(); return policy;
}
export function emptyNoticeWindow(accounts: NoticeAccount[] = [], kind = 'group'): NoticeWindow {
  const account = accounts[0];
  const channel: NoticeChannel = kind === 'email' ? { kind: 'smtp', to: '', transport: 'shared' }
    : kind === 'webhook' ? { kind: 'webhook', url: '', profile: 'generic', method: 'POST' }
    : { kind: 'chat', platform: account?.platform || 'onebot_v11', chat_id: '', is_group: kind === 'group',
      delivery: 'selected', adapter_ids: account ? [account.id] : [] };
  return { name: '', enabled: true, channel, subscriptions: [emptyNoticeSubscription()] };
}
export function unifiedSenders(window: NoticeWindow, channel: NoticeChannel): NoticeWindow {
  return { ...window, channel, mixed_delivery: false, subscriptions: window.subscriptions.map(({ sender: _, ...rule }) => rule) };
}
export const webhookVariables = ['message', 'title', 'time', 'level', 'level_name', 'event', 'origin', 'platform', 'adapter_id', 'account_id', 'group_id', 'group_name', 'user_id', 'user_name'] as const;
export function webhookPreset(profile: WebhookProfile): Record<string, unknown> {
  if (profile === 'wecom' || profile === 'dingtalk') return { msgtype: 'text', text: { content: '{{message}}' } };
  if (profile === 'feishu') return { msg_type: 'text', content: { text: '{{message}}' } };
  return { ts: '{{time}}', level: '{{level}}', op: '{{event}}', title: '{{title}}', msg: '{{message}}', origin: '{{origin}}' };
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export function webhookTemplateError(body: unknown, depth = 0): boolean {
  if (depth > 16) return true;
  if (typeof body === 'string') {
    for (let at = body.indexOf('{{'); at >= 0;) {
      const end = body.indexOf('}}', at + 2);
      if (end < 0 || !(webhookVariables as readonly string[]).includes(body.slice(at + 2, end))) return true;
      at = body.indexOf('{{', end + 2);
    }
  } else if (body !== null && typeof body === 'object') return Object.values(body).some(value => webhookTemplateError(value, depth + 1));
  return false;
}
export function parseWebhookDraft(channel: NoticeChannel, bodyText: string, headerText: string): { channel?: NoticeChannel; error?: string } {
  try {
    const body: unknown = JSON.parse(bodyText);
    if (!object(body) || new TextEncoder().encode(bodyText).length > 65536 || webhookTemplateError(body)) return { error: 'invalid_body' };
    let headers: unknown;
    try { headers = JSON.parse(headerText); } catch { return { error: 'invalid_headers' }; }
    if (!object(headers) || Object.keys(headers).length > 32 || Object.entries(headers).some(([key, value]) =>
      !/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/.test(key) || typeof value !== 'string' || /[\x00-\x1f\x7f]/.test(value)
        || value.length > 8192 || ['host', 'connection', 'content-length', 'transfer-encoding'].includes(key.toLowerCase()) || key.toLowerCase().startsWith('proxy-'))) return { error: 'invalid_headers' };
    return { channel: { ...channel, headers: headers as Record<string, string>, body_template: body } };
  } catch { return { error: 'invalid_body' }; }
}
export function noticeWindowError(window: NoticeWindow, meta: NoticeMeta): string | undefined {
  const ch = window.channel;
  if (ch.kind === 'chat') {
    if (!ch.chat_id?.trim() || !ch.platform) return 'need_target';
    const senders = window.mixed_delivery ? window.subscriptions.map(policy => policy.sender || ch) : [ch];
    if (senders.some(sender => sender.delivery !== 'auto' && (!sender.adapter_ids?.length || sender.adapter_ids.some(id => !meta.accounts.some(a => a.id === id && a.platform === ch.platform))))) return 'need_sender';
  } else if (ch.kind === 'smtp') {
    if (!/^[^\s@<>]+@[^\s@<>]+$/.test(ch.to || '')) return 'invalid_email';
    if (!(ch.transport === 'legacy' ? meta.legacy_smtp_ready : meta.smtp_ready)) return 'smtp_missing';
  } else {
    try { const url = new URL(ch.url || ''); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || /[\s<>"{}#\\]/.test(ch.url || '')) return 'invalid_webhook'; }
    catch { return 'invalid_webhook'; }
  }
  if (!window.subscriptions.length) return 'need_policy';
  if (window.subscriptions.some(s => s.source.mode !== 'all' && !(s.source.mode === 'platforms' ? s.source.platforms : s.source.adapter_ids).length)) return 'need_source';
  return undefined;
}
/** Preview uses the same typed, single-pass JSON substitution as the backend. */
export function webhookPreview(body: unknown, vars: Record<string, unknown>): unknown {
  if (Array.isArray(body)) return body.map(value => webhookPreview(value, vars));
  if (object(body)) return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, webhookPreview(value, vars)]));
  if (typeof body !== 'string') return body;
  const exact = body.match(/^\{\{([a-z_]+)\}\}$/);
  if (exact) return vars[exact[1]] ?? '';
  return body.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) => String(vars[key] ?? ''));
}
