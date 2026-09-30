import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequestGate } from '../.test-dist/lib/request-gate.js';
import { confirmPageLeave, registerNavigationGuard } from '../.test-dist/lib/navigation-guard.js';
import { nextScheduleRun, scheduleToday, timezoneLabel } from '../.test-dist/lib/schedule-time.js';
import { runBatch } from '../.test-dist/lib/batch-operation.js';
import { canCopyDeckGroup, deckCopyFilename, deckFileKey } from '../.test-dist/lib/deck-document.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function deckCopyContext(overrides = {}) {
  return {
    current: { filename: '合集.json', source: 'builtin' }, activeGroup: '硬币', document: { 硬币: ['正', '反'] },
    readOnly: true, busy: false, copying: { current: false }, touring: false,
    canCopyDeckGroup, deckCopyFilename, deckFileKey, t: (key) => key,
    setBusy() {}, setSelected() {}, setSearch() {}, setGroup() {}, setEntryPage() {}, setRevision() {},
    toast() {}, notifyError() {}, fetchDecks: async () => {}, ...overrides,
  };
}

test('deck copy cancellation and ineligible groups never send a write', async () => {
  let writes = 0, prompts = 0, busy = false;
  const common = { dlg: { prompt: async () => { prompts++; return null; } }, deckRequest: async () => { writes++; }, setBusy: (value) => { busy = value; } };
  for (const scope of [{}, { touring: true }, { readOnly: false, current: { filename: '合集.json', source: 'user' } }, { activeGroup: '_隐藏' }, { document: null }]) {
    const ctx = deckCopyContext({ ...common, ...scope });
    await handler('pages/decks-page.tsx', 'copyGroup', ctx)();
    assert.equal(ctx.copying.current, false);
  }
  assert.equal(prompts, 1); assert.equal(writes, 0); assert.equal(busy, false);
});

test('deck copy locks duplicate submissions, captures the source and selects the new user file', async () => {
  const answer = deferred(); const writes = []; let selected, group, refreshes = 0, busy;
  const ctx = deckCopyContext({ dlg: { prompt: () => answer.promise },
    deckRequest: async (path, options) => { writes.push({ path, body: JSON.parse(options.body) }); return { filename: '我的硬币.json', entry: '硬币' }; },
    setSelected: (value) => { selected = value; }, setGroup: (value) => { group = value; },
    setBusy: (value) => { busy = value; }, fetchDecks: async () => { refreshes++; },
  });
  const run = handler('pages/decks-page.tsx', 'copyGroup', ctx);
  const pending = run(); await run(); assert.equal(writes.length, 0); assert.equal(busy, true);
  ctx.current = { filename: 'other.json', source: 'builtin' }; ctx.activeGroup = '别的牌堆';
  answer.resolve('  我的硬币.json  '); await pending;
  assert.deepEqual(writes, [{ path: '/copy', body: { filename: '合集.json', entry: '硬币', targetFilename: '我的硬币.json' } }]);
  assert.equal(selected, deckFileKey({ filename: '我的硬币.json', source: 'user' }));
  assert.equal(group, '硬币'); assert.equal(refreshes, 1); assert.equal(busy, false); assert.equal(ctx.copying.current, false);
});

test('deck copy errors preserve selection and release the operation lock', async () => {
  const errors = []; let selected = false, success = false;
  const ctx = deckCopyContext({ dlg: { prompt: async () => '已有.json' },
    deckRequest: async () => { throw new Error('同名用户牌堆文件已存在'); },
    setSelected: () => { selected = true; }, toast: () => { success = true; },
    notifyError: (error, title) => { errors.push([error.message, title]); },
  });
  await handler('pages/decks-page.tsx', 'copyGroup', ctx)();
  assert.deepEqual(errors, [['同名用户牌堆文件已存在', 'decks.copy_fail']]);
  assert.equal(selected, false); assert.equal(success, false); assert.equal(ctx.copying.current, false);
});
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

test('reply dialogs scroll a normal container, keep the fieldset inside and pin the footer outside', () => {
  const source = fs.readFileSync(new URL('../src/components/reply/reply-form.tsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('reply-form.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const elements = [];
  const visit = (node) => { if (ts.isJsxElement(node)) elements.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const tag = (node) => node.openingElement.tagName.getText(tree);
  const classes = (node) => node.openingElement.attributes.properties.find((p) => p.name?.getText(tree) === 'className')?.initializer?.text || '';
  const fieldset = elements.find((node) => tag(node) === 'fieldset');
  const scroll = fieldset.parent;
  assert.equal(tag(scroll), 'div');
  for (const cls of ['min-h-0', 'flex-1', 'overflow-y-auto', 'overscroll-contain']) assert.ok(classes(scroll).split(' ').includes(cls));
  assert.doesNotMatch(classes(fieldset), /overflow-|flex-1/);
  assert.match(fieldset.openingElement.getText(tree), /disabled=\{uploading \|\| submitting\}/);
  const dialog = scroll.parent;
  assert.equal(tag(dialog), 'DialogContent');
  const header = dialog.children.find((node) => ts.isJsxElement(node) && tag(node) === 'DialogHeader');
  const footer = dialog.children.find((node) => ts.isJsxElement(node) && tag(node) === 'DialogFooter');
  assert.ok(classes(header).includes('shrink-0'));
  assert.ok(classes(footer).includes('shrink-0'));
  assert.ok(dialog.children.indexOf(footer) > dialog.children.indexOf(scroll));
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

test('playground keeps a definite height in either width mode and scrolls only its chat', () => {
  const layout = fs.readFileSync(new URL('../src/components/layout/layout.tsx', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../src/pages/playground-page.tsx', import.meta.url), 'utf8');
  assert.ok(layout.includes("currentPath === '/playground' && 'h-full min-h-[32rem]'"));
  assert.ok(page.includes('ref={chatRef} data-tour="playground-chat"'));
  assert.ok(page.includes("chat?.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' })"));
  assert.ok(!page.includes('scrollIntoView'));
  assert.ok(!page.includes('main.style.overflow'));
  assert.ok(page.includes('data-tour="playground-composer" className="flex shrink-0'));
});

test('toast entry points share a bounded portal independent of page width rules', () => {
  const toaster = fs.readFileSync(new URL('../src/components/ui/toaster.tsx', import.meta.url), 'utf8');
  const compatibility = fs.readFileSync(new URL('../src/components/ui/toast.tsx', import.meta.url), 'utf8');
  assert.ok(toaster.includes('return createPortal('));
  assert.ok(toaster.includes('document.body'));
  assert.ok(toaster.includes('w-[calc(100%-2rem)] max-w-[388px]'));
  assert.ok(toaster.includes('[overflow-wrap:anywhere]'));
  assert.ok(compatibility.includes("export { Toaster as ToastViewport } from './toaster'"));
});

test('group mutations choose the filtered adapter instead of another primary account', () => {
  const primary = { adapterId: 'A', endpointId: 'group-A' }, filtered = { adapterId: 'B', endpointId: 'group-B' };
  const run = handler('pages/groups-page.tsx', 'accountPayload', { primaryAccount: () => primary });
  assert.equal(run({ accounts: [primary, filtered] }, 'B').endpointId, 'group-B');
  assert.equal(run({ accounts: [primary, filtered] }, 'all').adapterId, 'A');
});

test('detail hard-disable requires confirmation, unlock changes only locked', async () => {
  for (const [locked, confirmed, expected] of [[false, false, null], [false, true, true], [true, false, false]]) {
    const writes = []; let confirmations = 0;
    const run = handler('pages/groups-page.tsx', 'toggleGroupLock', {
      savingSwitch: false, group: { locked, left: false, name: 'Example' }, t: (s) => s,
      dlg: { confirm: async () => { confirmations++; return confirmed; } },
      setFunction: async (key, value) => writes.push([key, value]),
    });
    await run(); assert.equal(confirmations, locked ? 0 : 1);
    assert.deepEqual(writes, expected === null ? [] : [['locked', expected]]);
  }
});

test('detail switches reject archived, locked and in-flight changes', async () => {
  for (const [savingSwitch, locked, left, key, allowed] of [
    [true, false, false, 'enabled', false], [false, true, false, 'enabled', false],
    [false, false, true, 'locked', false], [false, true, false, 'locked', true],
    [false, false, false, 'enabled', true],
  ]) {
    const writes = [];
    const run = handler('pages/groups-page.tsx', 'setFunction', { savingSwitch, group: { locked, left }, setSavingSwitch() {}, save: async (body) => writes.push(body) });
    await run(key, false); assert.equal(writes.length, Number(allowed));
    if (allowed) assert.equal(writes[0][key], false);
  }
});

test('group detail panels fill their container and list cards use the theme surface', () => {
  const source = fs.readFileSync(new URL('../src/pages/groups-page.tsx', import.meta.url), 'utf8');
  for (const panel of ['function', 'ai', 'plugins']) {
    assert.ok(source.includes(`data-group-panel="${panel}" className="min-w-0 w-full space-y-`));
  }
  assert.ok(source.includes('<Card key={`${g.platform}/${g.groupId}`}'));
});

test('shared tab panels and AI settings grids use the available container width', () => {
  const tabs = fs.readFileSync(new URL('../src/components/ui/tabs.tsx', import.meta.url), 'utf8');
  const ai = fs.readFileSync(new URL('../src/pages/ai-page.tsx', import.meta.url), 'utf8');
  assert.ok(tabs.includes('mt-2 min-w-0 w-full ring-offset-background'));
  assert.ok(!ai.includes('grid max-w-'));
  assert.ok(tabs.includes('w-fit flex-nowrap')); // tab bars themselves remain compact
});

test('audit severity labels do not wrap or fragment when long messages compete for width', () => {
  const source = fs.readFileSync(new URL('../src/pages/notice-settings-page.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('data-label={t(\'noticeset.audit_area\')} className="p-2 whitespace-nowrap"'));
  assert.ok(source.includes('inline-flex shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-xs'));
  assert.ok(source.includes('data-label={t(\'noticeset.audit_msg\')} className="p-2 text-xs break-all"'));
});

test('compact pagination bounds page buttons without enumerating all pages', () => {
  for (const page of [1, 5, 6]) {
    const numbers = handler('components/ui/pagination-bar.tsx', 'pageNumbers', { compact: true, page, totalPages: 6 });
    assert.deepEqual(Array.from(numbers), [...new Set([1, page, 6])].sort((a, b) => a - b));
  }
  const numbers = handler('components/ui/pagination-bar.tsx', 'pageNumbers', { compact: false, page: 500000, totalPages: 1000000 });
  assert.deepEqual(Array.from(numbers), [1, 499999, 500000, 500001, 1000000]);
});

test('pagination jump clamps boundaries, clears drafts and refuses changes during loading', () => {
  for (const [jump, disabled, expected] of [['5', false, 5], ['0', false, 1], ['999', false, 6], ['', false, null], ['5', true, null]]) {
    let result = null, cleared = false;
    const run = handler('components/ui/pagination-bar.tsx', 'goJump', { jump, disabled, totalPages: 6,
      onPageChange: (v) => { result = v; }, setJump: () => { cleared = true; } });
    run(); assert.equal(result, expected); assert.equal(cleared, expected !== null);
  }
});

test('split-pane pagers use the shared fixed two-row layout', () => {
  const pager = fs.readFileSync(new URL('../src/components/ui/pagination-bar.tsx', import.meta.url), 'utf8');
  assert.ok(pager.includes('data-pagination-layout="compact" className="grid min-w-0 gap-2 pt-2"'));
  assert.ok(pager.includes('items-center gap-1 overflow-x-auto" data-pagination-pages'));
  for (const file of ['help-docs', 'groups', 'players', 'decks']) {
    const page = fs.readFileSync(new URL(`../src/pages/${file}-page.tsx`, import.meta.url), 'utf8');
    assert.match(page, /<PaginationBar[^\n]+fixedSize compact/);
  }
});

test('player selection waits for the detail leave guard and respects cancellation', async () => {
  for (const allowed of [false, true]) {
    const answer = deferred(); let changed = false;
    const run = handler('pages/players-page.tsx', 'change', { leaveGuard: { current: () => answer.promise } });
    const pending = run(() => { changed = true; });
    assert.equal(changed, false); answer.resolve(allowed); await pending; assert.equal(changed, allowed);
  }
});
