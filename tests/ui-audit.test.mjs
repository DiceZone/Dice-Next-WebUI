import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequestGate } from '../.test-dist/lib/request-gate.js';
import { confirmPageLeave, registerNavigationGuard } from '../.test-dist/lib/navigation-guard.js';
import { nextScheduleRun, scheduleToday, timezoneLabel } from '../.test-dist/lib/schedule-time.js';
import { runBatch } from '../.test-dist/lib/batch-operation.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
// Execute the actual component handlers with controlled responses. This catches
// contract bugs between parent callbacks and dialogs without copying handlers.
function handler(file, name, context) {
  const source = fs.readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let node;
  const visit = (n) => { if (ts.isVariableDeclaration(n) && n.name.getText(tree) === name) node = n.initializer; ts.forEachChild(n, visit); };
  visit(tree); assert.ok(node, name);
  if (ts.isCallExpression(node) && /useCallback$/.test(node.expression.getText(tree))) node = node.arguments[0];
  const js = ts.transpileModule('globalThis.callback = ' + node.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(js, context);
  return context.callback;
}

test('request gate rejects slow old scopes, repeated selections and stale refreshes', () => {
  const gate = createRequestGate(); gate.select('A'); const a = gate.start();
  gate.select('B'); const b = gate.start();
  assert.equal(a(), false); assert.equal(b(), true);
  gate.select('A'); assert.equal(a(), false); assert.equal(b(), false);
  const refresh1 = gate.start(), refresh2 = gate.start();
  assert.equal(refresh1(), false); assert.equal(refresh2(), true);
  const save = gate.capture(); gate.select('B'); assert.equal(save(), false);
  gate.invalidate(); assert.equal(refresh2(), false);
});

test('persona loader cannot display a late A response under B', async () => {
  const gate = createRequestGate(); gate.select('1:zh-Hans');
  const a = deferred(), b = deferred(); let shown, loaded;
  const common = { personaGate: gate, lang: 'zh-Hans', t: (s) => s,
    setPersonaLoaded: (v) => { loaded = v; }, setPersonaError() {}, setPersonaMap: (v) => { shown = v; } };
  const runA = handler('pages/commands-page.tsx', 'loadPersonaMap', { ...common, personaId: 1, personaKey: '1:zh-Hans', fetch: () => a.promise });
  const pa = runA(); gate.select('2:zh-Hans');
  const runB = handler('pages/commands-page.tsx', 'loadPersonaMap', { ...common, personaId: 2, personaKey: '2:zh-Hans', fetch: () => b.promise });
  const pb = runB();
  const response = (value) => ({ ok: true, json: async () => ({ code: 0, data: [{ key: 'dice.roll', locale: 'zh-Hans', value }] }) });
  b.resolve(response('B')); await pb; a.resolve(response('A')); await pa;
  assert.equal(shown['dice.roll'].value, 'B'); assert.equal(loaded, '2:zh-Hans');
});

test('causal editor waits for save and preserves the draft after failure', async () => {
  for (const fails of [false, true]) {
    const request = deferred(), closed = [], errors = []; let calls = 0;
    const ctx = { savingRef: { current: false }, editing: { name: 'draft' }, setSaving() {},
      onSave: () => { calls++; return request.promise; }, onOpenChange: (v) => closed.push(v),
      t: (s) => s, toast: (v) => errors.push(v) };
    const save = handler('components/causal/causal-rule-editor.tsx', 'handleSave', ctx);
    const pending = save(); await save(); assert.equal(calls, 1); assert.deepEqual(closed, []);
    if (fails) request.reject(new Error('offline')); else request.resolve();
    await pending;
    assert.deepEqual(closed, fails ? [] : [false]); assert.equal(errors.length, fails ? 1 : 0);
    assert.equal(ctx.savingRef.current, false);
  }
});

test('adapter parent propagates save failure so the form cannot announce success', async () => {
  const error = new Error('offline');
  for (const name of ['handleCreate', 'handleUpdate']) {
    const run = handler('pages/adapters-page.tsx', name, { createAdapter: async () => { throw error; }, updateAdapter: async () => { throw error; }, editingAdapter: { id: 'a' }, toast() {}, t: (s) => s });
    await assert.rejects(run({}), /offline/);
  }
});

test('rule test sends the draft and selected context, refuses old server results', async () => {
  const editing = { id: 10, name: 'unsaved', conditions: [{ content: 'new' }] };
  for (const supported of [true, false]) {
    let sent, result; const errors = [];
    const run = handler('components/causal/causal-rule-editor.tsx', 'handleTest', {
      editing, testMsg: 'new', testUser: '123', testGroup: '', testNick: 'Nick', testGate: createRequestGate(),
      setTesting() {}, setTestResult: (v) => { result = v; }, t: (s) => s, toast: (v) => errors.push(v),
      apiClient: { post: async (_url, payload) => { sent = payload; return { data: { matched: true, draftTested: supported } }; } },
    });
    await run(); assert.equal(sent.rule, editing); assert.equal(sent.userId, '123'); assert.equal(sent.groupId, '');
    assert.equal(Boolean(result?.matched), supported); assert.equal(errors.length, supported ? 0 : 1);
  }
});

test('image upload failures are visible and existing replies are not modified', async () => {
  let error = '', changed = false, busy = false;
  const run = handler('components/reply/reply-form.tsx', 'uploadImage', {
    uploading: false, imgTarget: { current: 0 }, setUploading: (v) => { busy = v; }, setError: (v) => { error = v; },
    setResults: () => { changed = true; }, t: (s) => s,
    FileReader: class { readAsDataURL() { this.result = 'data:image/png;base64,x'; this.onload(); } },
    fetch: async () => ({ json: async () => ({ code: 1, message: 'upload refused' }) }),
  });
  await run({ name: 'a.png' }); assert.match(error, /upload refused/); assert.equal(changed, false); assert.equal(busy, false);
});

test('navigation guards wait for confirmation and can keep or discard a draft', async () => {
  const answer = deferred(); const unregister = registerNavigationGuard(() => answer.promise);
  let settled = false; const attempt = confirmPageLeave().then((ok) => { settled = true; return ok; });
  await Promise.resolve(); assert.equal(settled, false);
  answer.resolve(false); assert.equal(await attempt, false); unregister();
  const unregister2 = registerNavigationGuard(async () => true);
  assert.equal(await confirmPageLeave(), true); unregister2(); assert.equal(await confirmPageLeave(), true);
});

test('reply, causal and schedule deletion require confirmation', async () => {
  for (const [file, name] of [['pages/replies-page.tsx', 'handleDelete'], ['pages/replies-page.tsx', 'handleCausalDelete'], ['pages/schedules-page.tsx', 'remove']]) {
    let writes = 0;
    const run = handler(file, name, { replies: [{ id: 1, matchContent: 'hello' }], causalRules: [{ id: 1, name: 'rule' }], tasks: [{ id: 1, name: 'task' }],
      dlg: { confirm: async () => false }, t: (s) => s, deleteReply: () => { writes++; }, apiClient: { delete: () => { writes++; } }, fetch: () => { writes++; }, toast() {} });
    await run(1); assert.equal(writes, 0);
  }
});

test('browser Back keeps the editor mounted until confirmation and restores its URL on cancel', async () => {
  for (const accepted of [false, true]) {
    const answer = deferred(); const writes = [], commits = [];
    const ctx = { readHashRoute: () => ({ raw: '/help', path: '/help', query: '' }),
      locationRef: { current: { raw: '/decks', path: '/decks', query: '' } }, navigating: { current: false },
      confirmPageLeave: () => answer.promise, ROUTES: { '/help': true, '/decks': true },
      setLocation: (value) => commits.push(value),
      window: { history: { replaceState: (_s, _t, url) => writes.push(['replace', url]), pushState: (_s, _t, url) => writes.push(['push', url]) } },
    };
    const run = handler('routes/index.tsx', 'handleHashChange', ctx);
    const pending = run(); assert.equal(commits.length, 0); assert.equal(writes.length, 0);
    answer.resolve(accepted); await pending;
    assert.equal(commits.length, accepted ? 1 : 0);
    assert.deepEqual(writes, accepted ? [['replace', '#/help']] : [['push', '#/decks']]);
    assert.equal(ctx.navigating.current, false);
  }
});

test('scoped settings reject late loads and late save responses after scope changes', async () => {
  for (const [name, gateName, applyName, section] of [
    ['loadEvents', 'eventGate', 'applyEventData', 'events'],
    ['loadExpression', 'expressionGate', 'applyExpressionData', 'expression'],
    ['loadGlobals', 'globalGate', 'applyGlobalData', 'global'],
  ]) {
    const gate = createRequestGate(); gate.select('A'); const request = deferred(); let applied = false;
    const run = handler('pages/settings-page.tsx', name, { [gateName]: gate, [applyName]: () => { applied = true; },
      settingsScope: 'account', settingsTarget: 'A', settingsPlatform: 'qq_official', scopeKey: 'A',
      setLoadedScopes() {}, setScopeError() {}, URLSearchParams, scopedQuery: () => '', fetch: () => request.promise,
    });
    const pending = run(); gate.select('B');
    request.resolve({ ok: true, json: async () => ({ code: 0, data: { section } }) }); await pending;
    assert.equal(applied, false, name);
  }
  const scopeGate = createRequestGate(); scopeGate.select('A'); const request = deferred(); let applied = false;
  const save = handler('pages/settings-page.tsx', 'saveWelcomeMinimums', {
    scopeGate, scopedReady: true, savingEvents: false, setSavingEvents() {}, welcomeMinDelay: 0, welcomeMinCooldown: 0,
    scopedEventBody: (data) => data, fetch: () => request.promise, applyEventData: () => { applied = true; }, toast() {}, t: (s) => s,
  });
  const pending = save(); scopeGate.select('B'); request.resolve({ json: async () => ({ code: 0, data: {} }) }); await pending;
  assert.equal(applied, false);
});

const task = { enabled: true, cronTime: '08:00', days: '', lastRun: '', triggerType: 'daily', intervalMin: 30, onceDate: '' };
test('schedule estimates use the bot clock across UTC date and weekday boundaries', () => {
  const now = Date.parse('2026-09-26T23:30:00Z');
  assert.equal(scheduleToday(480, now), '2026-09-27');
  assert.equal(nextScheduleRun({ ...task, days: '0' }, 480, now), '2026-09-27 08:00');
  assert.equal(nextScheduleRun({ ...task, days: '0', lastRun: '2026-09-27' }, 480, now), '2026-10-04 08:00');
  assert.equal(nextScheduleRun(task, -300, now), '2026-09-27 08:00');
  assert.equal(timezoneLabel(345), 'UTC+5:45'); assert.equal(timezoneLabel(-210), 'UTC-3:30');
});
test('schedule estimates handle catch-up, intervals, one-off tasks and unknown timezone', () => {
  const now = Date.parse('2026-09-27T00:30:00Z');
  assert.equal(nextScheduleRun(task, 480, now), '2026-09-27 08:30');
  assert.equal(nextScheduleRun({ ...task, lastRun: '2026-09-27' }, 480, now), '2026-09-28 08:00');
  assert.equal(nextScheduleRun({ ...task, triggerType: 'interval', lastRun: '2026-09-27 08:20' }, 480, now), '2026-09-27 08:50');
  assert.equal(nextScheduleRun({ ...task, triggerType: 'once', onceDate: '2026-09-26' }, 480, now), '—');
  assert.equal(nextScheduleRun({ ...task, triggerType: 'once', onceDate: '2026-09-27' }, 480, now), '2026-09-27 08:30');
  assert.equal(nextScheduleRun(task, null, now), '—');
  assert.equal(nextScheduleRun({ ...task, cronTime: '99:99' }, 480, now), '—');
});

test('schedule edit opens a dialog with the task and a matching clean baseline', () => {
  let form, baseline, opened = false;
  const run = handler('pages/schedules-page.tsx', 'startEdit', {
    setEditingId() {}, setForm(v) { form = v; }, setDaySet() {}, setCondKind() {}, setCondN() {}, parseCond: () => ({ kind: 'none', n: 7 }),
    snapshot: (v) => JSON.stringify(v), setBaseline(v) { baseline = v; }, setEditorOpen(v) { opened = v; },
  });
  run({ ...task, id: 1 }); assert.equal(opened, true); assert.equal(baseline, JSON.stringify(form));
});

test('batch operations preserve failures for retry without stopping subsequent tasks', async () => {
  const called = [];
  const result = await runBatch([1, 2, 3], async (id) => { called.push(id); if (id === 2) throw new Error('offline'); });
  assert.deepEqual(called, [1, 2, 3]); assert.deepEqual(result.succeeded, [1, 3]); assert.deepEqual(result.failed, [2]);
});

test('schedule batch delete cancellation sends no requests and releases the operation lock', async () => {
  let writes = 0; const lock = { current: false };
  const run = handler('pages/schedules-page.tsx', 'batch', { operationLock: lock, selectedIds: new Set([1, 2]), setBusy() {},
    dlg: { confirm: async () => false }, t: (s) => s, fetch() { writes++; } });
  await run('delete'); assert.equal(writes, 0); assert.equal(lock.current, false);
});

test('schedule batch updates only enabled and reports partial failures', async () => {
  const calls = []; let selected, notice;
  const run = handler('pages/schedules-page.tsx', 'batch', { operationLock: { current: false }, selectedIds: new Set([1, 2]), setBusy() {}, runBatch,
    fetch: async (url, opts) => { calls.push([url, JSON.parse(opts.body)]); return { ok: true, json: async () => ({ code: url.endsWith('/2') ? 1 : 0 }) }; },
    setSelectedIds(v) { selected = [...v]; }, toast(v) { notice = v; }, t: (_s, v) => v, load: async () => {} });
  await run('disable'); assert.deepEqual(calls, [['/api/schedules/1', { enabled: false }], ['/api/schedules/2', { enabled: false }]]);
  assert.deepEqual(selected, [2]); assert.equal(notice.title.ok, 1); assert.equal(notice.title.fail, 1);
});

test('workspace width defaults to modern, persists, and leaves classic page widths intact', () => {
  const store = fs.readFileSync(new URL('../src/store/app-store.ts', import.meta.url), 'utf8');
  const layout = fs.readFileSync(new URL('../src/components/layout/layout.tsx', import.meta.url), 'utf8');
  assert.ok(store.includes("contentWidth: 'modern'")); assert.ok(store.includes('contentWidth: state.contentWidth'));
  assert.ok(layout.includes("contentWidth !== 'classic' && 'mx-auto w-full max-w-7xl [&>*]:max-w-none'"));
});

test('group mutations choose the filtered adapter instead of another primary account', () => {
  const primary = { adapterId: 'A', endpointId: 'group-A' }, filtered = { adapterId: 'B', endpointId: 'group-B' };
  const run = handler('pages/groups-page.tsx', 'accountPayload', { primaryAccount: () => primary });
  assert.equal(run({ accounts: [primary, filtered] }, 'B').endpointId, 'group-B');
  assert.equal(run({ accounts: [primary, filtered] }, 'all').adapterId, 'A');
});

test('player selection waits for the detail leave guard and respects cancellation', async () => {
  for (const allowed of [false, true]) {
    const answer = deferred(); let changed = false;
    const run = handler('pages/players-page.tsx', 'change', { leaveGuard: { current: () => answer.promise } });
    const pending = run(() => { changed = true; });
    assert.equal(changed, false); answer.resolve(allowed); await pending; assert.equal(changed, allowed);
  }
});
