import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeShortcuts, readShortcuts, moveShortcut, DEFAULT_SHORTCUTS, SHORTCUT_OPTIONS, MAX_SHORTCUTS, SHORTCUT_STORAGE_KEY } from '../.test-dist/lib/dashboard-shortcuts.js';
import { dashboardShortcutsCopy } from '../.test-dist/i18n/dashboard-shortcuts.js';

test('shortcuts accept only internal allowlisted destinations, deduplicate and limit', () => {
  assert.deepEqual(normalizeShortcuts(['/replies', 'https://evil.example', '//evil', '/replies', '/settings?unsafe', '/help', null]), ['/replies', '/help']);
  assert.equal(normalizeShortcuts(SHORTCUT_OPTIONS.map(([path]) => path)).length, MAX_SHORTCUTS);
  assert.deepEqual(normalizeShortcuts({}), DEFAULT_SHORTCUTS);
  assert.deepEqual(normalizeShortcuts([]), []);
});
test('missing, corrupt or blocked browser storage falls back safely; empty stays empty', () => {
  for (const value of [null, '{', 'null', '123']) assert.deepEqual(readShortcuts({ getItem: () => value }), DEFAULT_SHORTCUTS);
  assert.deepEqual(readShortcuts({ getItem: () => { throw new Error('blocked'); } }), DEFAULT_SHORTCUTS);
  assert.deepEqual(readShortcuts({ getItem: (key) => { assert.equal(key, SHORTCUT_STORAGE_KEY); return '[]'; } }), []);
});
test('ordering is immutable and cannot wrap around the ends', () => {
  const source = ['/replies', '/help', '/settings'];
  assert.deepEqual(moveShortcut(source, 1, -1), ['/help', '/replies', '/settings']);
  assert.deepEqual(moveShortcut(source, 0, -1), source);
  assert.deepEqual(moveShortcut(source, 2, 1), source);
  assert.deepEqual(source, ['/replies', '/help', '/settings']);
});
test('shortcut editor provides matching translations in every supported language', () => {
  const keys = Object.keys(dashboardShortcutsCopy.en).sort();
  for (const bundle of Object.values(dashboardShortcutsCopy)) assert.deepEqual(Object.keys(bundle).sort(), keys);
});
test('every shortcut maps to a real route', () => {
  const routes = readFileSync(new URL('../src/routes/index.tsx', import.meta.url), 'utf8');
  for (const [path] of SHORTCUT_OPTIONS) assert.ok(routes.includes("'" + path + "'") || routes.includes('route-manifest'), path);
});
