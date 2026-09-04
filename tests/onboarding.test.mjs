import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ONBOARDING_STORAGE_KEY,
  canonicalTourPath,
  completeTour,
  hasCompletedTour,
  readTourProgress,
  resetTourProgress,
} from '../.test-dist/lib/onboarding.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

test('a page tour is shown once after completion', () => {
  const storage = memoryStorage();
  assert.equal(hasCompletedTour('/settings', 1, storage), false);
  assert.equal(completeTour('/settings', 1, storage, 1234), true);
  assert.equal(hasCompletedTour('/settings', 1, storage), true);
  assert.deepEqual(readTourProgress(storage)['/settings'], { version: 1, completedAt: 1234 });
});

test('a newer tour version may be introduced without losing old progress', () => {
  const storage = memoryStorage();
  completeTour('/settings', 1, storage, 1234);
  assert.equal(hasCompletedTour('/settings', 2, storage), false);
  assert.equal(hasCompletedTour('/settings', 1, storage), true);
});

test('legacy permission URL shares progress with the current URL', () => {
  const storage = memoryStorage();
  assert.equal(canonicalTourPath('/banlist'), '/permissions');
  completeTour('/banlist', 1, storage, 1234);
  assert.equal(hasCompletedTour('/permissions', 1, storage), true);
});

test('malformed storage is ignored and progress can be reset', () => {
  const storage = memoryStorage({ [ONBOARDING_STORAGE_KEY]: '{broken' });
  assert.deepEqual(readTourProgress(storage), {});
  completeTour('/', 1, storage, 1234);
  assert.equal(resetTourProgress(storage), true);
  assert.deepEqual(readTourProgress(storage), {});
});
