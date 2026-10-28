import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { create } from 'zustand';
import ts from 'typescript';

test('failed dashboard reads preserve the real snapshot and expose retryable errors', async () => {
  const source = readFileSync(new URL('../src/store/dashboard-store.ts', import.meta.url), 'utf8');
  const module = { exports: {} };
  let fail = false;
  const snapshot = { uptime_seconds: 123, total_commands: 99 };
  const api = { get: async () => { if (fail) throw new Error('Offline'); return { data: snapshot }; } };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', code)((name) => {
    if (name === 'zustand') return { create };
    if (name === '@/lib/api-client') return { default: api };
    throw new Error(`Unexpected import ${name}`);
  }, module, module.exports);
  const store = module.exports.zustandDashboardStore;
  fail = true; await store.getState().fetchStats();
  assert.equal(store.getState().stats, null);
  assert.equal(store.getState().error, 'Offline');
  fail = false; await store.getState().fetchStats();
  assert.equal(store.getState().stats, snapshot);
  assert.equal(store.getState().error, null);
  fail = true; await store.getState().fetchStats();
  assert.equal(store.getState().stats, snapshot);
  assert.equal(store.getState().loading, false);
  assert.equal(store.getState().error, 'Offline');
});
