import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOG_LEVELS, logAtLeast, logMessageId, logTimestamp, normalizeLogLevel } from '../.test-dist/lib/runtime-logs.js';
import { runtimeLogsCopy } from '../.test-dist/i18n/runtime-logs.js';

test('six levels filter by minimum with independent SUCCESS and default INFO', () => {
  assert.deepEqual(LOG_LEVELS, ['trace', 'debug', 'info', 'success', 'warn', 'error']);
  assert.equal(normalizeLogLevel(undefined), 'info');
  assert.deepEqual(LOG_LEVELS.filter((level) => logAtLeast(level, 'info')), ['info', 'success', 'warn', 'error']);
  assert.deepEqual(LOG_LEVELS.filter((level) => logAtLeast(level, 'success')), ['success', 'warn', 'error']);
  assert.equal(logAtLeast('warning', 'warn'), true);
  assert.equal(normalizeLogLevel('critical'), 'error');
  assert.equal(normalizeLogLevel('ERROR'), 'error');
});
test('server time preserves milliseconds and is not reinterpreted by browser timezone', () => {
  assert.equal(logTimestamp('2026-10-12 10:12:14.125'), '2026-10-12 10:12:14.125');
});
test('correlation supports structured records, legacy text and segmented sends', () => {
  assert.equal(logMessageId({ msg_id: 'new-1', message: '' }), 'new-1');
  assert.equal(logMessageId({ details: { msg_id: 'detail-2' }, message: '' }), 'detail-2');
  assert.equal(logMessageId({ message: '发↪ 实际内容 (msgID:12345678)' }), '12345678');
  assert.equal(logMessageId({ message: '发↪ 实际内容 (msgID:session-3，分段:1/2)' }), 'session-3');
  assert.equal(logMessageId({ message: '普通插件日志' }), undefined);
});
test('all supported languages explain filtering, origins and no false delivery claims', () => {
  for (const copy of Object.values(runtimeLogsCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(runtimeLogsCopy.en).sort());
    for (const value of Object.values(copy)) assert.ok(value.trim());
    for (const level of LOG_LEVELS) assert.ok(copy.help.includes(level.toUpperCase()));
    assert.ok(copy.help.includes('msgID'));
  }
});
test('UI uses styled selectors, typed modules, diagnostic disclosure and correlation unaffected by list level', () => {
  const dashboard = readFileSync(new URL('../src/components/dashboard/recent-logs.tsx', import.meta.url), 'utf8');
  assert.ok(dashboard.includes('normalizeLogLevel'));
  assert.ok(dashboard.includes('logTimestamp(log.timestamp)'));
  assert.ok(dashboard.includes('log.module'));
  assert.ok(dashboard.includes('aria-expanded={expanded}'));
  assert.ok(dashboard.includes('logs.filter((log) => logMessageId(log) === relatedId)'));
  assert.ok(dashboard.includes('log.details'));
  const settings = readFileSync(new URL('../src/pages/webui-settings-page.tsx', import.meta.url), 'utf8');
  assert.ok(settings.includes('JSON.stringify({ level })'));
  assert.ok(settings.includes('recording-log-level'));
  assert.ok(settings.includes("j.data.level === 'off' ? 'off'"));
  assert.ok(settings.includes('<SelectItem value="off" disabled>'));
  assert.ok(!settings.includes('<select'));
});
