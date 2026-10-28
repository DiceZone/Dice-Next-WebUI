import test from 'node:test';
import assert from 'node:assert/strict';
import { readBanlistEntries } from '../.test-dist/lib/banlist-response.js';
test('blacklist accepts both wrapped and old bare lists, never their inherited entries method', () => {
  const rows = [{ id: 1 }];
  assert.equal(readBanlistEntries(rows), rows);
  assert.equal(readBanlistEntries({ entries: rows }), rows);
  assert.deepEqual(readBanlistEntries([]), []);
  for (const value of [null, undefined, {}, { entries: Array.prototype.entries }, { entries: 'bad' }])
    assert.equal(readBanlistEntries(value), null);
});
