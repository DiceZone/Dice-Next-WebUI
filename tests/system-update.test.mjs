import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { create } from 'zustand';
import { formatVersion, isUpdateBusy } from '../.test-dist/lib/system-update.js';
import { apiClient, ApiError, ApiTimeoutError } from '../.test-dist/lib/api-client.js';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function updateStore(apiClient) {
  const js = ts.transpileModule(read('src/store/system-update-store.ts'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: (path) => {
    if (path === 'zustand') return { create };
    if (path === '@/lib/api-client') return { apiClient };
    throw new Error('Unexpected dependency: ' + path);
  } });
  return exports.useSystemUpdateStore;
}

test('version labels use the actual binary channel and build number, including legacy servers', () => {
  assert.equal(formatVersion({ version: '3.0.0', build: 123, prerelease: true }), 'beta-3.0.0(123)');
  assert.equal(formatVersion({ version: '3.0.0', build: 123, prerelease: false }), 'v3.0.0(123)');
  assert.equal(formatVersion({ version: '3.0.0', buildNumber: '007' }), 'beta-3.0.0(7)');
  assert.equal(formatVersion({ version: '3.0.0', build: 0, prerelease: false }), 'v3.0.0(0)');
  assert.equal(formatVersion({ version: '3.1.0', build: 4, tag: 'v3.1.0' }), 'v3.1.0(4)');
  assert.equal(formatVersion({ version: '3.1.0', build: 4, tag: 'v3.1.0-beta.4' }), 'beta-3.1.0(4)');
  assert.equal(formatVersion({ version: '3.0.0' }), 'beta-3.0.0(?)');
  assert.equal(formatVersion(null), '—');
});

test('connecting, verification, preparation and cancellation stay busy until the backend has finished', () => {
  for (const phase of ['checking', 'connecting', 'downloading', 'verifying', 'preparing', 'cancelling', 'installing']) {
    assert.equal(isUpdateBusy(phase), true, phase);
  }
  for (const phase of ['idle', 'available', 'error', 'cancelled', 'downloaded', 'staged', 'up_to_date']) {
    assert.equal(isUpdateBusy(phase), false, phase);
  }
});

test('shared polling is deduplicated and a late GET cannot undo an explicit action', async () => {
  const reply = deferred();
  let requests = 0;
  const store = updateStore({ get: () => { requests++; return reply.promise; } });
  const first = store.getState().refresh();
  const second = store.getState().refresh();
  assert.equal(requests, 1);
  const active = { current: { version: '3.0.0', build: 123 }, phase: 'connecting' };
  store.getState().accept(active);
  reply.resolve({ data: { current: { version: '3.0.0', build: 123 }, phase: 'available' } });
  assert.equal(await first, active);
  assert.equal(await second, active);
  assert.equal(store.getState().status.phase, 'connecting');
});

test('failed polling permits retry; fallback version cannot overwrite updater metadata', async () => {
  const fallback = deferred();
  let requests = 0;
  const status = { current: { version: '3.0.0', build: 123, prerelease: false }, phase: 'idle' };
  const store = updateStore({ get: (path) => {
    if (path === '/system/status') return fallback.promise;
    return ++requests === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ data: status });
  } });
  const load = store.getState().loadVersion();
  await assert.rejects(store.getState().refresh(), /offline/);
  await store.getState().refresh();
  fallback.resolve({ data: { version: 'old', buildNumber: 1 } });
  await load;
  assert.equal(store.getState().version, status.current);
});

test('reconciliation starts a fresh GET and an obsolete request cannot unlock or clear it', async () => {
  const old = deferred(), fresh = deferred();
  let requests = 0;
  const store = updateStore({ get: () => ++requests === 1 ? old.promise : fresh.promise });
  const obsolete = store.getState().refresh();
  store.getState().invalidate();
  const current = store.getState().refresh();
  old.resolve({ data: { current: { version: 'old' }, phase: 'available' } });
  await obsolete;
  assert.equal(store.getState().status, null);
  const duplicate = store.getState().refresh();
  assert.equal(requests, 2);
  const status = { current: { version: '3.0.0' }, phase: 'downloading' };
  fresh.resolve({ data: status });
  assert.equal(await current, status);
  assert.equal(await duplicate, status);
});

const withFetch = async (fetch, run) => {
  const previousFetch = globalThis.fetch;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  globalThis.fetch = fetch;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'test-key' } });
  try { await run(); } finally {
    globalThis.fetch = previousFetch;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  }
};

test('an update request timeout aborts HTTP waiting without pretending to cancel the server job', async () => {
  let aborted = false;
  await withFetch((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
  }), async () => {
    await assert.rejects(apiClient.post('/system/update/download', undefined, { timeoutMs: 20 }), ApiTimeoutError);
  });
  assert.equal(aborted, true);
});

test('HTTP timeout includes reading the response body', async () => {
  await withFetch(async (_url, options) => ({
    ok: true, headers: { get: () => 'application/json' },
    json: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('body aborted')));
    }),
  }), async () => {
    await assert.rejects(apiClient.get('/system/update', { timeoutMs: 20 }), ApiTimeoutError);
  });
});

test('normal API calls keep authentication and application errors without imposing a timeout', async () => {
  await withFetch(async (_url, options) => {
    assert.equal(options.headers['X-API-Key'], 'test-key');
    assert.equal(options.signal, undefined);
    return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ code: 7, message: 'denied' }) };
  }, async () => {
    await assert.rejects(apiClient.get('/replies'), (error) => error instanceof ApiError && error.code === 7);
  });
});

test('version entry replaces connection badge and sidebar placeholder, and uses the supplied safe New SVG', () => {
  const header = read('src/components/layout/header.tsx');
  assert.ok(!header.includes('apiOnline'));
  assert.ok(header.includes("onNavigate('/about?focus=about-update')"));
  assert.ok(header.includes('formatVersion(version)'));
  assert.ok(header.includes('updateStatus?.updateAvailable && <img src="/new.svg"'));
  const versionEntry = header.match(/<button\b[\s\S]*?<\/button>/)?.[0];
  assert.ok(versionEntry?.includes("onNavigate('/about?focus=about-update')"));
  assert.ok(versionEntry.includes('focus-visible:ring-2'));
  assert.ok(!/variant=|\bborder\b|\bbg-/.test(versionEntry));
  assert.ok(!read('src/components/layout/sidebar.tsx').includes('v3.0.0 — Dice!Next'));
  const svg = read('public/new.svg');
  assert.ok(svg.includes('fill="#EE502F"'));
  assert.ok(!/<script|href=|onload=|DOCTYPE/.test(svg));
});

test('update controls reconcile uncertain requests and never offer installation cancellation', () => {
  const about = read('src/pages/about-page.tsx');
  assert.ok(about.includes('setStatusUncertain(true);\n      invalidateStatus();\n      await loadUpdateStatus();'));
  assert.ok(about.includes('updateStatus?.cancelSupported && (updateStatus.canCancel'));
  assert.ok(about.includes("runAction('cancel')"));
  assert.ok(about.includes('isUpdateBusy(phase)'));
  for (const locale of ['en', 'ja', 'zh-Hans', 'zh-Hant']) {
    const copy = JSON.parse(read(`src/i18n/locales/${locale}.json`)).about;
    for (const key of ['version_open', 'version_new_available', 'update_cancel', 'update_request_timeout',
      'update_refresh_status', 'update_status_uncertain', 'phase_connecting', 'phase_verifying',
      'phase_preparing', 'phase_cancelling', 'phase_cancelled']) {
      assert.ok(copy[key], `${locale}: ${key}`);
    }
  }
});
