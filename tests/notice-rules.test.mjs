import test from 'node:test';
import assert from 'node:assert/strict';
import { channelTitle, channelKey, emptyNoticeRule, eventIsSelected, setEvent, noticePageCorrection } from '../.test-dist/lib/notice-rules.js';
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
