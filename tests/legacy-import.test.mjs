import test from 'node:test';
import assert from 'node:assert/strict';
import { readMigrationView } from '../.test-dist/lib/legacy-import.js';
import { legacyImport } from '../.test-dist/i18n/legacy-import.js';

test('transport success never masks partial data or stage failures', () => {
  assert.equal(readMigrationView({ ok: true, complete: true }).status, 'complete');
  assert.equal(readMigrationView({ ok: true, complete: false }).status, 'partial');
  assert.equal(readMigrationView({ ok: false, complete: true }).status, 'failed');
  assert.equal(readMigrationView({ ok: true, errors: [{ stage: 'cards', reason: 'truncated' }] }).status, 'failed');
  assert.equal(readMigrationView({ error: 'wrong source root' }).status, 'failed');
  assert.equal(readMigrationView(null).status, 'partial');
});
test('file failures and preserved states remain visible without duplicate detail lists', () => {
  const view = readMigrationView({ diagnostics: [{ name: 'reply', status: 'disabled', reasons: ['unsupported gate'] }],
    plugins: { details: [{ name: 'reply', status: 'disabled' }] },
    assets: { preservedOnly: [{ name: 'old.xml', reason: 'manual conversion' }] }, sessions: 2, logs: 3, logMessages: 4 });
  assert.equal(view.details.length, 2); assert.equal(view.details[0].reason, 'unsupported gate');
  assert.equal(view.details[1].status, 'preserved');
  assert.equal(view.sessions, 2); assert.equal(view.logs, 3); assert.equal(view.messages, 4);
  assert.equal(readMigrationView({ decks: { details: [{ status: 'failed' }] } }).status, 'failed');
});
test('migration interface strings have matching keys across all languages', () => {
  for (const bundle of Object.values(legacyImport)) assert.deepEqual(Object.keys(bundle).sort(), Object.keys(legacyImport.en).sort());
});

test('session reconciliation is explicit and an optimistic complete flag cannot hide review items', () => {
  const view = readMigrationView({ ok: true, complete: true, sessionConfirmations: [
    { key: '0123456789abcdef', file: 'old.json', name: 'Old game', candidates: [{ id: 'legacy-prior', code: 'keep', name: 'Old game' }] },
    { key: '../bad', candidates: [{ id: 'legacy-other' }] },
  ] });
  assert.equal(view.status, 'partial'); assert.equal(view.sessionConfirmations.length, 1);
  assert.equal(view.sessionConfirmations[0].candidates[0].id, 'legacy-prior');
  assert.equal(readMigrationView({ ok: true, complete: true, diagnostics: [{ status: 'preserved' }] }).status, 'partial');
});

test('actionable migration details precede successful files', () => {
  const view = readMigrationView({ diagnostics: [{ name: 'good', status: 'success' }, { name: 'bad', status: 'failed' }] });
  assert.equal(view.details[0].name, 'bad'); assert.equal(view.status, 'failed');
});
