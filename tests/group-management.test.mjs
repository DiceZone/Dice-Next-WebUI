import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { groupLeaveTarget, groupSelectionKey, groupCommandTimestamp, groupCommandTimeText,
  sortGroupActivity, submitGroupLeaves, MAX_GROUP_LEAVE_BATCH } from '../.test-dist/lib/group-management.js';
import { groupManagementCopy } from '../.test-dist/i18n/group-management.js';

const account = (id = 'a', overrides = {}) => ({ adapterId: id, adapterName: `Bot ${id}`, platform: 'onebot_v11',
  endpointId: 'native-group', connected: true, canLeaveGroup: true, ...overrides });
const group = (accounts = [account()], overrides = {}) => ({ platform: 'qq_official', groupId: 'public-group', name: 'Test group', accounts, ...overrides });
const target = (id = 'public-group') => groupLeaveTarget(group([account()], { groupId: id }), 'all');

test('leaving uses the exact native account platform and endpoint, not the aggregate card', () => {
  const source = group();
  const value = groupLeaveTarget(source, 'all');
  assert.equal(value.platform, 'onebot_v11');
  assert.equal(value.adapterId, 'a');
  assert.equal(value.endpointId, 'native-group');
  assert.equal(value.selectionKey, groupSelectionKey(source));
});

test('multi-account groups require explicit selection and never fall back to another bot', () => {
  const source = group([account('a'), account('b')]);
  assert.equal(groupLeaveTarget(source, 'all'), null);
  assert.equal(groupLeaveTarget(source, 'missing'), null);
  assert.equal(groupLeaveTarget(source, 'b').adapterId, 'b');
  assert.equal(groupLeaveTarget(group([account('a'), account('b', { connected: false })]), 'all'), null);
  assert.equal(groupLeaveTarget(group([account('a'), account('b', { connected: false })]), 'b'), null);
});

test('offline, unsupported, departed and unbound groups cannot be selected', () => {
  for (const overrides of [{ connected: false }, { canLeaveGroup: false }, { canLeaveGroup: undefined },
    { left: true }, { adapterId: '' }, { endpointId: '' }]) assert.equal(groupLeaveTarget(group([account('a', overrides)]), 'all'), null);
  assert.equal(groupLeaveTarget(group([], { left: true }), 'all'), null);
  assert.equal(groupLeaveTarget({ platform: 'onebot_v11', groupId: 'g', name: 'Legacy' }, 'all'), null);
});

test('history preserves date precision and rejects unknown or impossible dates', () => {
  assert.equal(groupCommandTimeText('2026-10-01', 'en'), '2026-10-01');
  for (const value of ['', undefined, 'never', '2026-02-30', '2026-13-01', '2026-10-01T25:00:00Z']) {
    assert.equal(groupCommandTimestamp(value), null);
    assert.equal(groupCommandTimeText(value, 'en'), null);
  }
  assert.equal(groupCommandTimestamp('2026-10-01T03:04:05.006Z'), Date.UTC(2026, 9, 1, 3, 4, 5, 6));
  assert.ok(groupCommandTimeText('2026-10-01T03:04:05.006Z', 'zh-Hans'));
});

test('activity ordering is non-mutating and missing history never masquerades as long inactivity', () => {
  const rows = [{ name: 'Unknown' }, { name: 'Older', lastCommandAt: '2026-09-01' },
    { name: 'Recent', lastCommandAt: '2026-10-01T03:04:05.006Z' }];
  assert.deepEqual(sortGroupActivity(rows, 'inactive').map((row) => row.name), ['Older', 'Recent', 'Unknown']);
  assert.deepEqual(sortGroupActivity(rows, 'recent').map((row) => row.name), ['Recent', 'Older', 'Unknown']);
  assert.deepEqual(rows.map((row) => row.name), ['Unknown', 'Older', 'Recent']);
});

test('only confirmed targets are sent sequentially and partial failures are retained', async () => {
  const targets = [target('g/1'), target('g2'), target('g3')];
  let active = 0;
  const calls = [], progress = [];
  const report = await submitGroupLeaves(targets, async (path, body) => {
    assert.equal(active++, 0);
    calls.push([path, body]);
    await Promise.resolve(); --active;
    if (path.includes('g2/')) throw new Error('offline');
  }, () => false, (done) => progress.push(done));
  assert.equal(calls[0][0], '/groups/onebot_v11/g%2F1/action');
  assert.deepEqual(calls[0][1], { action: 'leave', adapterId: 'a', endpointId: 'native-group' });
  assert.deepEqual(report.submitted.map((row) => row.groupId), ['g/1', 'g3']);
  assert.equal(report.failed[0].target.groupId, 'g2');
  assert.equal(report.failed[0].error, 'offline');
  assert.deepEqual(progress, [1, 2, 3]);
});

test('invalid or duplicate batches are rejected before any destructive request', async () => {
  let calls = 0;
  const post = async () => { ++calls; };
  for (const targets of [[], [target(), target()], [{ ...target(), adapterId: '' }],
    Array.from({ length: MAX_GROUP_LEAVE_BATCH + 1 }, (_, index) => target(String(index)))]) {
    await assert.rejects(submitGroupLeaves(targets, post));
  }
  assert.equal(calls, 0);
});

test('leaving a page cancels remaining requests without undoing already submitted ones', async () => {
  let stop = false, calls = 0;
  const report = await submitGroupLeaves([target('one'), target('two')], async () => { ++calls; stop = true; }, () => stop);
  assert.equal(calls, 1);
  assert.equal(report.submitted.length, 1);
  assert.equal(report.cancelled[0].groupId, 'two');
});

test('management copy covers every supported language with identical keys', () => {
  const keys = Object.keys(groupManagementCopy['zh-Hans']).sort();
  for (const language of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
    assert.deepEqual(Object.keys(groupManagementCopy[language]).sort(), keys);
    for (const text of Object.values(groupManagementCopy[language])) assert.ok(text.trim());
  }
});

test('every group view has manual selection, time display and a styled confirmation', () => {
  const source = fs.readFileSync(new URL('../src/pages/groups-page.tsx', import.meta.url), 'utf8');
  assert.equal((source.match(/groupSelection\(g\)/g) || []).length, 3);
  assert.equal((source.match(/<GroupCommandTime /g) || []).length, 4);
  assert.match(source, /<Dialog open=\{batchTargets\.length > 0\}/);
  assert.match(source, /clearBatchSelection\(\)/);
  assert.match(source, /batchLock\.current/);
  assert.doesNotMatch(source, /window\.(?:confirm|prompt)\(/);
});
