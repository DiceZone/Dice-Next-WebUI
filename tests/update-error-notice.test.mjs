import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getVisibleUpdateError,
  INITIAL_UPDATE_ERROR_NOTICE,
  updateErrorNoticeReducer,
} from '../.test-dist/lib/update-error-notice.js';

const apply = (state, ...events) => events.reduce(updateErrorNoticeReducer, state);

test('successful polling does not erase an explicit operation error', () => {
  const state = apply(
    INITIAL_UPDATE_ERROR_NOTICE,
    { type: 'operation-started' },
    { type: 'operation-finished', error: 'download failed' },
    { type: 'poll-succeeded', error: '' },
  );

  assert.equal(getVisibleUpdateError(state), 'download failed');
});

test('an asynchronous operation error discovered by polling remains visible', () => {
  const state = apply(
    INITIAL_UPDATE_ERROR_NOTICE,
    { type: 'operation-started' },
    { type: 'operation-finished', error: '' },
    { type: 'poll-succeeded', error: 'all update sources failed' },
    { type: 'poll-succeeded', error: '' },
  );

  assert.equal(getVisibleUpdateError(state), 'all update sources failed');
});

test('the user can dismiss an operation error until the next operation', () => {
  const failed = apply(
    INITIAL_UPDATE_ERROR_NOTICE,
    { type: 'operation-finished', error: 'download failed' },
    { type: 'dismissed' },
    { type: 'poll-succeeded', error: 'download failed' },
  );
  assert.equal(getVisibleUpdateError(failed), '');

  const retried = apply(
    failed,
    { type: 'operation-started' },
    { type: 'operation-finished', error: 'download failed' },
  );
  assert.equal(getVisibleUpdateError(retried), 'download failed');
});

test('transient polling failures clear after polling recovers', () => {
  const state = apply(
    INITIAL_UPDATE_ERROR_NOTICE,
    { type: 'poll-failed', error: 'network offline' },
    { type: 'poll-succeeded', error: '' },
  );

  assert.equal(getVisibleUpdateError(state), '');
});
