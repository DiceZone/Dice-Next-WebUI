import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { channelTitle, channelKey, emptyNoticeRule, eventIsSelected, setEvent, noticePageCorrection,
  emptyNoticeWindow, emptyNoticeSubscription, unifiedSenders, noticeWindowError, parseWebhookDraft, webhookPreset, webhookPreview } from '../.test-dist/lib/notice-rules.js';
import { noticeManagerCopy } from '../.test-dist/i18n/notice-manager.js';

test('notice identities show cached nicknames and never use the numeric ID as the nickname', () => {
  const ch = { kind: 'chat', chat_id: '192499947', name: '192499947', display_name: '随春生' };
  assert.equal(channelTitle(ch, '用户'), '随春生');
  assert.equal(channelTitle({ ...ch, display_name: '' }, '用户'), '用户');
  assert.equal(channelTitle({ ...ch, display_name: '', name: '骰主' }, '用户'), '骰主');
  assert.equal(channelTitle({ kind: 'webhook', url: 'https://example.com/secret?key=abc' }, 'Webhook'), 'example.com');
});
test('editing an imported level-based subscription starts from its real effective events', () => {
  const catalog = [{ op: 'trust', area: 1 }, { op: 'friend_add', area: 2 }, { op: 'error', area: 8 }];
  const old = { ...emptyNoticeRule(), level_mask: 10, events: [] };
  assert.equal(eventIsSelected(old, catalog[0]), false);
  assert.equal(eventIsSelected(old, catalog[1]), true);
  assert.equal(eventIsSelected(old, catalog[2]), true);
  const edited = setEvent(old, 'friend_add', catalog);
  assert.equal(edited.subscription, 'events');
  assert.deepEqual(edited.events, ['error']);
  const empty = setEvent(edited, 'error', catalog);
  assert.deepEqual(empty.events, []);
  assert.equal(eventIsSelected(empty, catalog[1]), false);
});
test('destination identity distinguishes user/group and platform without coupling sources to senders', () => {
  const user = { kind: 'chat', platform: 'onebot_v11', chat_id: '123', is_group: false };
  assert.notEqual(channelKey(user), channelKey({ ...user, is_group: true }));
  assert.notEqual(channelKey(user), channelKey({ ...user, platform: 'qq_official' }));
  assert.deepEqual(emptyNoticeRule().source, { mode: 'all', platforms: [], adapter_ids: [], include_system: true });
});
test('notification manager has the same translated keys in all supported languages', () => {
  for (const copy of Object.values(noticeManagerCopy)) assert.deepEqual(Object.keys(copy).sort(), Object.keys(noticeManagerCopy.en).sort());
});
test('notification pagination never snaps back to stale data and adopts a clamped page only after success', () => {
  assert.equal(noticePageCorrection(3, 1, true, false), undefined);
  assert.equal(noticePageCorrection(3, 1, false, true), undefined);
  assert.equal(noticePageCorrection(3, 3, false, false), undefined);
  assert.equal(noticePageCorrection(3, 2, false, false), 2);
});

test('all newly exposed notification events have translated subscription labels', () => {
  const events = ['group_joined', 'group_request', 'group_ban', 'group_admin', 'group_size_leave',
    'group_auto_clean', 'usergroup_leave', 'leave_error', 'group_control', 'schedule_manage', 'notice_manage'];
  for (const locale of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
    const copy = JSON.parse(readFileSync(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8'));
    for (const op of events) assert.ok(copy.noticeset[`ev_${op}`]?.length, `${locale}: ${op}`);
  }
  const existing = { ...emptyNoticeRule(), level_mask: 10, events: [] };
  for (const op of events) assert.equal(eventIsSelected(existing, { op, area: op === 'leave_error' ? 8 : op.endsWith('_manage') ? 1 : 2 }), !op.endsWith('_manage'));
});

test('window identity ignores senders and treats an email or webhook as one destination', () => {
  const ch = { kind: 'chat', platform: 'onebot_v11', chat_id: '123', is_group: true, delivery: 'selected', adapter_ids: ['a'] };
  assert.equal(channelKey(ch), channelKey({ ...ch, adapter_ids: ['b', 'c'] }));
  assert.equal(channelKey({ kind: 'smtp', to: 'Owner@example.com' }), channelKey({ kind: 'smtp', to: 'owner@example.com', transport: 'legacy' }));
  assert.notEqual(channelKey({ kind: 'webhook', url: 'https://example.com/a' }), channelKey({ kind: 'webhook', url: 'https://example.com/b' }));
});

test('one-window defaults and unified sending preserve distinct source-event subscriptions', () => {
  const accounts = [{ id: 'a', platform: 'onebot_v11' }], window = emptyNoticeWindow(accounts);
  window.channel.chat_id = '123';
  assert.deepEqual(window.channel.adapter_ids, ['a']); assert.equal(window.channels, undefined);
  const second = { ...emptyNoticeSubscription(), source: { mode: 'accounts', adapter_ids: ['source-b'], platforms: [], include_system: false }, subscription: 'events', events: ['error'], sender: { delivery: 'selected', adapter_ids: ['b'] } };
  window.subscriptions.push(second); window.mixed_delivery = true;
  const next = unifiedSenders(window, { ...window.channel, adapter_ids: ['a', 'c'] });
  assert.equal(next.mixed_delivery, false); assert.equal(next.subscriptions[1].sender, undefined);
  assert.deepEqual(next.subscriptions[1].events, ['error']); assert.deepEqual(next.subscriptions[1].source.adapter_ids, ['source-b']);
  assert.deepEqual(window.subscriptions[1].sender.adapter_ids, ['b']);
});

test('destination validation requires real configured senders and available SMTP', () => {
  const meta = { accounts: [{ id: 'a', platform: 'onebot_v11' }], smtp_ready: false }, value = emptyNoticeWindow(meta.accounts);
  assert.equal(noticeWindowError(value, meta), 'need_target'); value.channel.chat_id = '123';
  assert.equal(noticeWindowError(value, meta), undefined); value.channel.adapter_ids = ['missing'];
  assert.equal(noticeWindowError(value, meta), 'need_sender');
  const email = emptyNoticeWindow([], 'email'); email.channel.to = 'owner@example.com';
  assert.equal(noticeWindowError(email, meta), 'smtp_missing'); assert.equal(noticeWindowError(email, { ...meta, smtp_ready: true }), undefined);
  email.channel.to += ',other@example.com'; assert.equal(noticeWindowError(email, meta), 'invalid_email');
  const hook = emptyNoticeWindow([], 'webhook'); hook.channel.url = 'file:///tmp/private';
  assert.equal(noticeWindowError(hook, meta), 'invalid_webhook'); hook.channel.url = 'https://user:pass@example.com';
  assert.equal(noticeWindowError(hook, meta), 'invalid_webhook'); hook.channel.url = 'https://example.com/hook';
  assert.equal(noticeWindowError(hook, meta), undefined);
});

test('advanced Webhook JSON is validated, escaped and substituted once with typed values', () => {
  const channel = { kind: 'webhook', url: 'https://example.com/hook' };
  for (const body of ['[]', '{', '{"text":"{{unknown}}"}', '{"text":"{{message"}']) assert.equal(parseWebhookDraft(channel, body, '{}').error, 'invalid_body');
  for (const headers of ['[]', '{"Host":"private"}', '{"X-Key":"bad\\nline"}', '{"X-Key":123}']) assert.equal(parseWebhookDraft(channel, '{}', headers).error, 'invalid_headers');
  const parsed = parseWebhookDraft(channel, '{"text":"{{message}}","level":"{{level}}","key_{{title}}":"fixed"}', '{"X-Token":"fixture"}');
  assert.equal(parsed.error, undefined);
  const preview = webhookPreview(parsed.channel.body_template, { message: '引号"\n{{title}}', level: 8, title: 'not evaluated' });
  assert.deepEqual(preview, { text: '引号"\n{{title}}', level: 8, 'key_{{title}}': 'fixed' });
  assert.equal(webhookPreview(webhookPreset('feishu'), { message: '消息' }).content.text, '消息');
  assert.equal(webhookPreview(webhookPreset('dingtalk'), { message: '消息' }).text.content, '消息');
  assert.equal(webhookPreview(webhookPreset('wecom'), { message: '消息' }).text.content, '消息');
});
