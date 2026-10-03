import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { create } from 'zustand';
import { createRequestGate } from '../.test-dist/lib/request-gate.js';
import { confirmPageLeave, registerNavigationGuard } from '../.test-dist/lib/navigation-guard.js';
import { nextScheduleRun, scheduleToday, timezoneLabel } from '../.test-dist/lib/schedule-time.js';
import { runBatch } from '../.test-dist/lib/batch-operation.js';
import { canCopyDeckGroup, deckCopyFilename, deckFileKey } from '../.test-dist/lib/deck-document.js';
import { resolveReplyScope, globalReplyScope, replyScopeKey, replyScopeQuery } from '../.test-dist/lib/reply-scope.js';
import { readWorkspaceView, resolveWorkspaceView, WORKSPACE_WIDE_QUERY } from '../.test-dist/lib/workspace-view.js';
import { readPersonaPolicy, samePersonaPolicy } from '../.test-dist/lib/persona-policy.js';
import { uiRefresh } from '../.test-dist/i18n/ui-refresh.js';

test('persona access belongs to Commands; connection forms never resend stale policies', () => {
  const commands = fs.readFileSync(new URL('../src/pages/commands-page.tsx', import.meta.url), 'utf8');
  assert.match(commands, /setAccessOpen\(true\)/);
  assert.match(commands, /<PersonaAccessDialog /);
  const form = fs.readFileSync(new URL('../src/components/adapter/adapter-form.tsx', import.meta.url), 'utf8');
  for (const field of ['personaSelection', 'selectablePersonaIds', 'defaultPersonaId']) assert.ok(!form.includes(field), field);
  const policy = readPersonaPolicy({ name: 'connection', accessToken: 'secret', personaSelection: 'selected', selectablePersonaIds: [3, 1, 3], defaultPersonaId: 2 });
  assert.deepEqual(policy, { personaSelection: 'selected', selectablePersonaIds: [1, 3], defaultPersonaId: 2 });
  assert.equal(samePersonaPolicy(policy, { ...policy, selectablePersonaIds: [3, 1] }), true);
  assert.equal(samePersonaPolicy(policy, { ...policy, personaSelection: 'none' }), false);
  assert.deepEqual(readPersonaPolicy({}), { personaSelection: 'all', selectablePersonaIds: [], defaultPersonaId: 0 });
});

test('persona access saves only the chosen account policy, locks duplicate saves and preserves failed drafts', async () => {
  for (const fails of [false, true]) {
    const request = deferred(); const calls = []; const errors = []; const notices = [];
    let bots = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', personaSelection: 'none' }];
    let draft = { personaSelection: 'selected', selectablePersonaIds: [2], defaultPersonaId: 1 };
    const ctx = { tourActive: false, loading: false, adapter: bots[0], dirty: true, busy: { current: false },
      draft, readPersonaPolicy, gate: createRequestGate(), Error,
      setSaving() {}, setError: (v) => errors.push(v), setDraft: (v) => { draft = v; },
      setAdapters: (update) => { bots = update(bots); }, toast: (v) => notices.push(v), t: (key) => key,
      zustandAdapterStore: { getState: () => ({ updateAdapter: (id, policy) => { calls.push([id, policy]); return request.promise; } }) } };
    const save = handler('components/persona/persona-access-dialog.tsx', 'save', ctx);
    const pending = save(); await save();
    assert.equal(calls.length, 1); assert.equal(calls[0][0], 'a'); assert.deepEqual(calls[0][1], draft);
    if (fails) request.reject(new Error('offline')); else request.resolve();
    await pending;
    assert.equal(ctx.busy.current, false); assert.equal(notices.length, fails ? 0 : 1);
    assert.equal(bots[0].personaSelection, fails ? undefined : 'selected');
    assert.equal(bots[1].personaSelection, 'none');
    assert.deepEqual(draft.selectablePersonaIds, [2]);
    if (fails) assert.equal(errors.at(-1), 'offline');
    ctx.tourActive = true; await save(); assert.equal(calls.length, 1);
  }
});

test('persona access confirms scope changes and retains drafts when leaving is cancelled', async () => {
  let selected = 'a', draft = { personaSelection: 'selected', selectablePersonaIds: [1], defaultPersonaId: 0 };
  const ctx = { adapterId: 'a', adapters: [{ id: 'b', personaSelection: 'none' }], readPersonaPolicy,
    confirmLeave: async () => false, setAdapterId: (v) => { selected = v; }, setDraft: (v) => { draft = v; }, setError() {} };
  const select = handler('components/persona/persona-access-dialog.tsx', 'selectAdapter', ctx);
  await select('b'); assert.equal(selected, 'a'); assert.equal(draft.personaSelection, 'selected');
  ctx.confirmLeave = async () => true;
  await select('b'); assert.equal(selected, 'b'); assert.equal(draft.personaSelection, 'none');
});

test('persona access load failures are retryable and older responses cannot reset the current account', async () => {
  let bots = [], personas = [], selected = '', draft, loading, error;
  const requests = [];
  const ctx = { tourActive: false, gate: createRequestGate(), readPersonaPolicy, Error,
    setLoading: (v) => { loading = v; }, setError: (v) => { error = v; },
    setAdapters: (v) => { bots = v; }, setPersonas: (v) => { personas = v; },
    setAdapterId: (v) => { selected = v; }, setDraft: (v) => { draft = v; },
    apiClient: { get: (url) => { const request = deferred(); requests.push({ url, ...request }); return request.promise; } } };
  const load = handler('components/persona/persona-access-dialog.tsx', 'load', ctx);
  const failed = load(); requests[0].reject(new Error('offline')); requests[1].resolve({ data: [] });
  await failed; assert.equal(error, 'offline'); assert.equal(loading, false); assert.equal(selected, '');
  const old = load(), fresh = load();
  requests[4].resolve({ data: [{ id: 'b', personaSelection: 'none' }] });
  requests[5].resolve({ data: [{ id: 2, name: 'B' }] });
  await fresh;
  requests[2].resolve({ data: [{ id: 'a', personaSelection: 'all' }] });
  requests[3].resolve({ data: [{ id: 1, name: 'A' }] });
  await old;
  assert.equal(bots[0].id, 'b'); assert.equal(personas[0].id, 2); assert.equal(selected, 'b');
  assert.equal(draft.personaSelection, 'none'); assert.equal(loading, false); assert.equal(error, '');
  ctx.tourActive = true; await load(); assert.equal(requests.length, 6);
});

test('persona access leave confirmation is single-flight and does not allow leaving during save', async () => {
  const confirmation = deferred(); let prompts = 0;
  const ctx = { busy: { current: true }, dirty: true, t: (key) => key,
    dlg: { confirm: () => { prompts++; return confirmation.promise; } } };
  const leave = handler('components/persona/persona-access-dialog.tsx', 'confirmLeave', ctx);
  assert.equal(await leave(), false); assert.equal(prompts, 0);
  ctx.busy.current = false;
  const first = leave(); assert.equal(ctx.busy.current, true);
  assert.equal(await leave(), false); assert.equal(prompts, 1);
  confirmation.resolve(false); assert.equal(await first, false); assert.equal(ctx.busy.current, false);
  ctx.dirty = false; assert.equal(await leave(), true); assert.equal(prompts, 1);
});

test('persona access has a scrollable body and fixed action footer with localized labels', () => {
  const source = fs.readFileSync(new URL('../src/components/persona/persona-access-dialog.tsx', import.meta.url), 'utf8');
  assert.match(source, /min-h-0 flex-1 overflow-y-auto overscroll-contain/);
  assert.match(source, /DialogFooter className="shrink-0"/);
  assert.match(source, /useUnsavedChanges\(dirty \|\| saving, confirmLeave\)/);
  const keys = [...source.matchAll(/t\('([^']+)'\)/g)].map((match) => match[1]);
  for (const locale of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
    const labels = { ...JSON.parse(fs.readFileSync(new URL('../src/i18n/locales/' + locale + '.json', import.meta.url), 'utf8')), ui_refresh: uiRefresh[locale] };
    for (const key of keys) {
      const value = key.split('.').reduce((object, part) => object?.[part], labels);
      assert.ok(typeof value === 'string' && value.length > 0, locale + ': ' + key);
    }
    assert.equal(labels.adapters.persona_scope_title, undefined);
  }
});

test('automatic workspace follows the split breakpoint; explicit views override it', () => {
  assert.equal(WORKSPACE_WIDE_QUERY, '(min-width: 1024px)');
  assert.equal(resolveWorkspaceView('auto', false), 'card');
  assert.equal(resolveWorkspaceView('auto', true), 'split');
  for (const view of ['split', 'card', 'table'])
    for (const wide of [false, true]) assert.equal(resolveWorkspaceView(view, wide), view);
  assert.equal(readWorkspaceView(null, false), 'auto');
  assert.equal(readWorkspaceView('invalid', true), 'auto');
  assert.equal(readWorkspaceView('table', false), 'auto');
  assert.equal(readWorkspaceView('table', true), 'table');
});

test('record cards have a deliberate identity hierarchy instead of stacked columns', () => {
  const files = ['commands', 'groups', 'schedules', 'logs', 'backup', 'banlist', 'statistics', 'notice-settings', 'roadmap'];
  let records = 0;
  for (const file of files) {
    const source = fs.readFileSync(new URL('../src/pages/' + file + '-page.tsx', import.meta.url), 'utf8');
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node) => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === 'table') {
        const classes = node.openingElement.attributes.properties.find(p => p.name?.getText(tree) === 'className')?.initializer?.text || '';
        if (classes.split(' ').includes('rt-record')) {
          records++;
          assert.match(node.getText(tree), /rt-title/, file + ' needs a primary title');
          if (node.getText(tree).includes("t('common.actions')") || node.getText(tree).includes('data-label="操作"'))
            assert.match(node.getText(tree), /rt-footer/, file + ' needs an action footer');
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  assert.equal(records, 14); // Explicit group table view stays a horizontally scrollable table.
  const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(css, /table\.rt\.rt-record tr\s*\{[^}]*display: grid;/);
  assert.match(css, /\.rt-footer\s*\{[^}]*grid-column: 1 \/ -1;[^}]*border-top:/);
  assert.match(css, /\.rt-check input\s*\{[^}]*width: 1\.125rem;/);
});

test('workspace layout changes reuse details and keep list pagination stable', () => {
  const groups = fs.readFileSync(new URL('../src/pages/groups-page.tsx', import.meta.url), 'utf8');
  const players = fs.readFileSync(new URL('../src/pages/players-page.tsx', import.meta.url), 'utf8');
  assert.equal((groups.match(/<GroupDetail /g) || []).length, 1);
  assert.equal((players.match(/<PlayerDetailView /g) || []).length, 1);
  for (const source of [groups, players]) {
    assert.match(source, /useWorkspaceView\('/);
    assert.match(source, /value="auto"/);
    assert.match(source, /useDetailScroll\(workspaceRef\)/);
    assert.match(source, /previousView\.current/);
  }
  assert.match(groups, /const pageSize = 15;/);
  assert.match(groups, /<table className="w-full min-w-\[720px\] text-sm">/);
  assert.match(players, /const PAGE_SIZE = 20;/);
  assert.match(players, /detailScroll\.close/);
  assert.match(players, /void change\(\(\) => detailScroll\.open/);
  const hook = fs.readFileSync(new URL('../src/hooks/use-workspace-view.ts', import.meta.url), 'utf8');
  assert.match(hook, /useSyncExternalStore/);
  assert.match(hook, /query\.removeEventListener\('change'/);
  assert.match(hook, /readWorkspaceView\(localStorage\.getItem/);
  const scroll = fs.readFileSync(new URL('../src/hooks/use-detail-scroll.ts', import.meta.url), 'utf8');
  assert.match(scroll, /saved\.current\.panel\.scrollTop = saved\.current\.top/);
  assert.match(scroll, /cancelAnimationFrame/);
});

test('bordered responsive table frames opt in without stripping section cards', () => {
  for (const file of ['pages/commands-page.tsx', 'pages/groups-page.tsx', 'pages/logs-page.tsx',
    'pages/schedules-page.tsx', 'pages/modules-page.tsx', 'components/import/import-result-card.tsx']) {
    const source = fs.readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let frames = 0;
    const visit = (node) => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === 'table') {
        const attr = node.openingElement.attributes.properties.find(p => p.name?.getText(tree) === 'className');
        if (attr?.initializer?.text?.split(' ').includes('rt') && ts.isJsxElement(node.parent)) {
          const parentClass = node.parent.openingElement.attributes.properties.find(p => p.name?.getText(tree) === 'className')?.initializer?.text || '';
          if (parentClass.split(' ').includes('border')) {
            assert.ok(parentClass.split(' ').includes('rt-frame'), file);
            frames++;
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(tree); assert.ok(frames > 0, file);
  }
});

test('mobile table chrome and command hierarchy are scoped to the narrow breakpoint', () => {
  const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const mobile = css.slice(css.indexOf('@media (max-width: 639.9px)'), css.indexOf('/* ── Global settings search'));
  assert.match(mobile, /\.rt-frame, \.rt-section\s*\{[^}]*border-width: 0;[^}]*background: transparent;/);
  assert.doesNotMatch(mobile, /\.rt-frame, \.rt-section\s*\{[^}]*(max-height|overflow-y):/);
  assert.match(mobile, /table\.rt td > \.truncate\s*\{[^}]*white-space: normal;/);
  assert.match(mobile, /table\.rt tr\.command-row\s*\{[^}]*display: grid;/);
  assert.match(mobile, /\.command-description\s*\{[^}]*grid-area: 2/);
  assert.match(mobile, /\.command-actions\s*\{[^}]*grid-area: 4/);
  assert.match(mobile, /tr:last-child\s*\{[^}]*border-width: 1px;/);
  assert.match(mobile, /\.command-actions\[data-empty="true"\]\s*\{ display: none;/);
  const commands = fs.readFileSync(new URL('../src/pages/commands-page.tsx', import.meta.url), 'utf8');
  for (const marker of ['command-title', 'command-name', 'command-description', 'command-example', 'command-actions', 'command-reply-row'])
    assert.ok(commands.includes(marker), marker);
  assert.match(commands, /aria-expanded=\{isOpen\}/);
});

test('every responsive table has an explicit mobile frame, section or compact-list treatment', () => {
  const walkFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    return entry.isDirectory() ? walkFiles(url) : entry.name.endsWith('.tsx') ? [url] : [];
  });
  const files = [...walkFiles(new URL('../src/pages/', import.meta.url)), ...walkFiles(new URL('../src/components/', import.meta.url))];
  let count = 0;
  for (const file of files) {
    const tree = ts.createSourceFile(file.pathname, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const classes = (node) => ts.isJsxElement(node)
      ? (node.openingElement.attributes.properties.find(p => p.name?.getText(tree) === 'className')?.initializer?.text || '').split(' ') : [];
    const visit = (node) => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === 'table' && classes(node).includes('rt')) {
        count++;
        let marked = classes(node).includes('rt-flat');
        for (let ancestor = node.parent; ancestor && !marked; ancestor = ancestor.parent)
          marked = classes(ancestor).some(cls => cls === 'rt-frame' || cls === 'rt-section');
        assert.ok(marked, 'Missing mobile container treatment: ' + file.pathname);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  assert.ok(count >= 20, 'audit must include every existing table');
});

test('nested key-value editors keep one entity panel and preserve scrolling', () => {
  const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(css, /table\.rt\.rt-flat tr\s*\{[^}]*border-width: 0;[^}]*border-radius: 0;[^}]*background: transparent;/);
  assert.match(css, /\.rt-section-header\s*\{[^}]*padding: 0 0 0\.75rem;/);
  assert.match(css, /\.rt-section-content\s*\{[^}]*padding: 0;/);
  const player = fs.readFileSync(new URL('../src/pages/players-page.tsx', import.meta.url), 'utf8');
  assert.equal((player.match(/className="rt rt-flat /g) || []).length, 3);
  for (const file of ['pages/modules-page.tsx', 'components/import/import-result-card.tsx']) {
    const source = fs.readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
    assert.match(source, /rt-frame max-h-48 overflow/);
    assert.match(source, /className="rt rt-flat /);
  }
  const replies = fs.readFileSync(new URL('../src/components/reply/reply-table.tsx', import.meta.url), 'utf8');
  assert.match(replies, /<div className="space-y-3 sm:hidden">/);
  assert.match(replies, /<article[^>]+bg-card/);
});

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function replyStore(apiClient) {
  const source = fs.readFileSync(new URL('../src/store/reply-store.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, Error, require: (path) => {
    if (path === 'zustand') return { create };
    if (path === 'i18next') return { default: { t: (key) => key } };
    if (path === '@/lib/api-client') return { default: apiClient };
    if (path === '@/lib/reply-scope') return { globalReplyScope, replyScopeKey, replyScopeQuery };
    throw new Error('Unexpected store dependency: ' + path);
  } });
  return exports.zustandReplyStore;
}

test('reply collection switches clear old rows and reject late responses, including switch-back races', async () => {
  const requests = [];
  const store = replyStore({ get: (path) => { const response = deferred(); requests.push({ path, ...response }); return response.promise; } });
  const account = resolveReplyScope('account:bot:A:1', [{ id: 'bot:A:1', type: 'onebot_v11' }]);
  const a = store.getState().fetchReplies(account);
  const b = store.getState().fetchReplies(globalReplyScope);
  requests[1].resolve({ data: [{ id: 'global', channelScope: 'global' }] }); await b;
  assert.equal(store.getState().replies[0].id, 'global');
  const back = store.getState().fetchReplies(account);
  assert.equal(store.getState().replies.length, 0);
  requests[2].resolve({ data: [{ id: 'fresh-account', channelScope: 'account', channelTarget: 'bot:A:1' }], replyScope: account }); await back;
  requests[0].resolve({ data: [{ id: 'old-account' }] }); await a;
  assert.equal(store.getState().replies[0].id, 'fresh-account');
  assert.equal(store.getState().loading, false);
  assert.equal(requests[0].path, '/replies?scope=account&target=bot%3AA%3A1');
});

test('reply create owns its selected scope and a late save cannot insert rows into another collection', async () => {
  const pending = deferred(); let payload;
  const account = resolveReplyScope('account:bot:A:1', [{ id: 'bot:A:1', type: 'onebot_v11' }]);
  const store = replyStore({ get: async () => ({ data: [], replyScope: account }), post: async (_path, body) => { payload = body; return pending.promise; } });
  await store.getState().fetchReplies(account);
  const save = store.getState().createReply({ results: ['hello'], channelScope: 'global', channelTarget: '' });
  assert.equal(payload.channelScope, 'account'); assert.equal(payload.channelTarget, 'bot:A:1');
  await store.getState().fetchReplies(globalReplyScope);
  pending.resolve({ data: { id: 'account-row' } }); await save;
  assert.equal(store.getState().replies.length, 0);
  assert.equal(store.getState().scope.scope, 'global');
});

test('reply deduplication refresh and partial toggle stay in the selected platform collection', async () => {
  const requests = [], writes = [];
  const rule = { id: 'p1', enabled: true, channelScope: 'adapter', channelTarget: 'qq_official', results: ['hi'] };
  const store = replyStore({
    get: async (path) => { requests.push(path); return { data: [rule], replyScope: { scope: 'adapter', target: 'qq_official' } }; },
    put: async (path, body) => { writes.push({ path, body }); return { data: { ...rule, ...body, deduplicated: true } }; },
  });
  await store.getState().fetchReplies(resolveReplyScope('adapter:qq_official', []));
  await store.getState().toggleReply('p1');
  assert.deepEqual(JSON.parse(JSON.stringify(writes)), [{ path: '/replies/p1', body: { enabled: false } }]);
  assert.deepEqual(requests, ['/replies?scope=adapter&target=qq_official', '/replies?scope=adapter&target=qq_official']);
});

test('legacy backends cannot silently save scoped replies into the global collection', async () => {
  let writes = 0;
  const store = replyStore({ get: async () => ({ data: [] }), post: async () => { writes++; return { data: {} }; } });
  await store.getState().fetchReplies(resolveReplyScope('adapter:qq_official', []));
  assert.ok(store.getState().error.includes('scope_backend_required'));
  await assert.rejects(store.getState().createReply({ results: ['do not save globally'] }));
  assert.equal(writes, 0);
  await store.getState().fetchReplies(globalReplyScope);
  assert.equal(store.getState().error, null);
});

test('reply preview sends its account context and discards results after a scope switch', async () => {
  const file = 'reply-match-preview.tsx';
  const source = fs.readFileSync(new URL('../src/components/reply/' + file, import.meta.url), 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect;
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect') effect = node.arguments[0];
    ts.forEachChild(node, visit);
  };
  visit(tree); assert.ok(effect);
  const js = ts.transpileModule('globalThis.effect = ' + effect.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const a = deferred(), b = deferred(), writes = [];
  let shown, scheduled;
  const context = { timer: { current: null }, showingSamples: false, testText: ' hello ', groupId: ' 123 ',
    scope: resolveReplyScope('account:bot:A:1', [{ id: 'bot:A:1', type: 'qq_official' }]),
    setResult: (value) => { shown = value; }, setLoading() {}, AbortController,
    setTimeout: (callback) => { scheduled = callback; return 1; }, clearTimeout() {},
    fetch: async (_path, options) => { writes.push(options); return writes.length === 1 ? a.promise : b.promise; },
  };
  vm.runInNewContext(js, context);
  const cleanup = context.effect(); const first = scheduled();
  const payload = JSON.parse(writes[0].body);
  assert.deepEqual(payload, { text: 'hello', groupId: '123', scope: 'account', platform: 'qq_official', adapterId: 'bot:A:1' });
  cleanup(); assert.equal(writes[0].signal.aborted, true);
  context.scope = globalReplyScope;
  const cleanupB = context.effect(); const second = scheduled();
  const response = (value) => ({ json: async () => ({ code: 0, data: value }) });
  b.resolve(response({ reply: 'global' })); await second;
  a.resolve(response({ reply: 'wrong-account' })); await first;
  assert.equal(shown.reply, 'global');
  assert.deepEqual(JSON.parse(writes[1].body), { text: 'hello', groupId: '123', scope: 'global' });
  cleanupB();
});

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

test('reply scope keeps platforms and individual accounts distinct, including IDs containing colons', () => {
  const accounts = [{ id: 'onebot:bot-a', type: 'onebot_v11' }, { id: 'onebot:bot-b', type: 'onebot_v11' }];
  assert.deepEqual(resolveReplyScope('global', accounts), { scope: 'global', target: '', platform: '' });
  assert.deepEqual(resolveReplyScope('adapter:onebot_v11', accounts), { scope: 'adapter', target: 'onebot_v11', platform: 'onebot_v11' });
  assert.deepEqual(resolveReplyScope('account:onebot:bot-b', accounts), { scope: 'account', target: 'onebot:bot-b', platform: 'onebot_v11' });
  assert.throws(() => resolveReplyScope('adapter:', accounts));
});

test('poke loads and saves the page-selected scope without defaulting back to global', async () => {
  const scope = { scope: 'account', target: 'bot-b', platform: 'onebot_v11' };
  let endpoint, payload, opened = false, loading = false;
  const settings = { poke_enabled: true, poke: 'hello' };
  const context = {
    scope, samples: false, loading: false, i18n: { language: 'zh-Hans' }, URLSearchParams,
    setLoading: (value) => { loading = value; }, setSettings() {}, setRule() {},
    setOpen: (value) => { opened = value; }, pokeReplyRule: (value) => value,
    toast() {}, t: (key) => key,
    apiClient: { get: async (path) => { endpoint = path; return { data: settings }; },
      put: async (_path, body) => { payload = body; } },
  };
  await handler('components/reply/poke-reply-button.tsx', 'start', context)();
  const query = new URLSearchParams(endpoint.split('?')[1]);
  assert.equal(query.get('scope'), 'account'); assert.equal(query.get('target'), 'bot-b');
  assert.equal(query.get('platform'), 'onebot_v11'); assert.equal(query.get('lang'), 'zh-Hans');
  assert.equal(opened, true); assert.equal(loading, false);
  const data = { results: ['hello'], enabled: false };
  await handler('components/reply/poke-reply-button.tsx', 'save', context)(data);
  assert.equal(payload.scope, 'account'); assert.equal(payload.target, 'bot-b');
  assert.equal(payload.values.poke_enabled, false); assert.equal(payload.values.poke_reply, data);
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
  for (const section of ['playground-context', 'playground-shortcuts']) {
    const classes = page.match(new RegExp(`data-tour="${section}" className="([^"]+)"`))?.[1];
    assert.ok(classes);
    assert.ok(!/\bborder-[bt]\b/.test(classes));
  }
  assert.ok(page.includes('rounded-lg border bg-card text-card-foreground'));
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
  assert.ok(source.includes('data-label={t(\'noticeset.audit_area\')} className="rt-status p-2 whitespace-nowrap"'));
  assert.ok(source.includes('inline-flex shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-xs'));
  assert.ok(source.includes('data-label={t(\'noticeset.audit_msg\')} className="rt-body p-2 text-xs break-all"'));
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
