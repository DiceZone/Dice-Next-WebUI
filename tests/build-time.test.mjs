import assert from 'node:assert/strict';
import test from 'node:test';
import { formatBuildTimeUtc8 } from '../.test-dist/lib/build-time.js';

test('an unzoned server build time is treated as UTC and shown in UTC+8', () => {
  assert.equal(formatBuildTimeUtc8('2026-09-05 00:15:30'), '2026-09-05 08:15:30');
});

test('UTC+8 conversion crosses the date boundary correctly', () => {
  assert.equal(formatBuildTimeUtc8('2026-12-31 18:30:00'), '2027-01-01 02:30:00');
});

test('an explicit ISO offset is normalized to UTC+8 without double shifting', () => {
  assert.equal(formatBuildTimeUtc8('2026-09-05T08:15:30+08:00'), '2026-09-05 08:15:30');
});

test('an unknown build-time format is preserved instead of guessed', () => {
  assert.equal(formatBuildTimeUtc8('development build'), 'development build');
  assert.equal(formatBuildTimeUtc8('2026-02-30 10:00:00'), '2026-02-30 10:00:00');
});
