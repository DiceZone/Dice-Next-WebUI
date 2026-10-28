import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {
  changeMenuType, fingerprint, menuBody, moveItem, newMenuItem, newPanel, newPanelItem,
  panelBody, parseTargets, qqTextWidth, readMenu, readPanel, readPanelList, targetBody, validateMenu, validatePanel,
} from '../.test-dist/lib/qq-official-editor.js';
import { qqOfficialAction } from '../.test-dist/lib/qq-official-actions.js';
import { qqOfficialEditorCopy } from '../.test-dist/i18n/qq-official-editor.js';
import { createRequestGate } from '../.test-dist/lib/request-gate.js';

const menuResponse = { version: 4, menu: { future_menu_option: true, items: [
  { type: 'send_message', name: '帮助', send_message: '.help', metadata: { id: 12 } },
  { type: 'menu', name: '更多', sub_menu_items: [{ type: 'link', name: '文档', link: 'https://example.invalid/doc', future_child: 5 }] },
  { type: 'switch', name: '搜索', switch: { switch_id: 'search', default: true, future_switch: 'keep' } },
] } };
const panelResponse = { panel_id: 'p_group', scope: 'group', target_type: 'specific', version: 4,
  group_openids: ['group-one'], panel: { version: 4, remark: '群工具', future_panel: 4,
    items: [{ type: 'command', name: '.help', desc: '帮助', only_admin: true, future_item: 'keep' }] } };

test('menu round trips preserve unknown fields, switches and child order without editor keys', () => {
  const draft = readMenu(menuResponse), body = menuBody(draft);
  assert.deepEqual(body.menu, menuResponse.menu);
  assert.equal('key' in body.menu.items[0], false);
  draft.items = moveItem(draft.items, 2, -1);
  assert.equal(menuBody(draft).menu.items[1].type, 'switch');
  assert.deepEqual(menuBody(readMenu({ data: menuResponse })), menuBody(readMenu(menuResponse)));
  assert.deepEqual(validateMenu(draft), []);
  const wire = JSON.stringify(menuResponse);
  draft.items[0].name = '新帮助'; menuBody(draft);
  assert.equal(JSON.stringify(menuResponse), wire);
});

test('menus enforce 10 top items, five children, weighted names, valid links and unique switches', () => {
  const draft = readMenu(menuResponse);
  assert.equal(qqTextWidth('帮助'), 4); assert.equal(qqTextWidth('abcdef'), 6); assert.equal(qqTextWidth('🎲'), 2);
  draft.items[0].name = '一二三四五六';
  assert.ok(validateMenu(draft).some((issue) => issue.key === 'text_limit' && issue.max === 10));
  draft.items[1].children[0].link = 'http://example.invalid';
  draft.items[2].switchId = 'with space';
  assert.ok(validateMenu(draft).some((issue) => issue.key === 'https_required'));
  assert.ok(validateMenu(draft).some((issue) => issue.key === 'switch_required'));
  draft.items[2].switchId = 'search'; draft.items.push({ ...draft.items[2] });
  assert.ok(validateMenu(draft).some((issue) => issue.key === 'switch_duplicate'));
  draft.items[1].children = Array.from({ length: 6 }, () => ({ ...newMenuItem(), name: '子项', message: '.r' }));
  assert.ok(validateMenu(draft).some((issue) => issue.key === 'children_limit'));
  draft.items[1].children[0].type = 'switch';
  assert.ok(validateMenu(draft).some((issue) => issue.key === 'type_invalid' && issue.path === '2 / 1'));
  draft.items = Array.from({ length: 11 }, () => newMenuItem());
  assert.ok(validateMenu(draft).some((issue) => issue.key === 'items_limit' && issue.max === 10));
  for (const link of ['javascript:alert(1)', 'https://user:pass@example.invalid', 'https://', 'file:///tmp/x']) {
    const invalid = readMenu(menuResponse); invalid.items[1].children[0].link = link;
    assert.ok(validateMenu(invalid).some((issue) => issue.key === 'https_required'));
  }
});

test('changing menu type removes obsolete wire fields only as an explicit edit', () => {
  const source = readMenu(menuResponse).items[1];
  const item = changeMenuType(source, 'send_message'); item.message = '.help';
  const body = menuBody({ items: [item], source: {} });
  assert.equal('sub_menu_items' in body.menu.items[0], false);
  assert.equal(body.menu.items[0].send_message, '.help');
  assert.equal(source.children.length, 1);
});

test('malformed platform data is never mistaken for an empty publishable draft', () => {
  for (const value of [null, [], 'oops', { menu: 'oops' }, { menu: { items: {} } }, { error: 'denied' },
    { menu: { items: [{ type: 'switch', switch: { default: 'false' } }] } }]) assert.throws(() => readMenu(value), /invalid_response/);
  for (const value of [null, {}, { ...panelResponse, panel: null }, { ...panelResponse, panel: { items: {} } },
    { ...panelResponse, panel: { items: [{ type: 'command', only_admin: 'false' }] } }]) assert.throws(() => readPanel(value), /invalid_response/);
  assert.deepEqual(readMenu({ menu: null }).items, []);
  assert.deepEqual(menuBody(readMenu({})), { menu: { items: [] } });
});

test('editing a panel only changes content and never rewrites existing scene or target arrays', () => {
  const draft = readPanel(panelResponse), body = panelBody(draft);
  assert.deepEqual(Object.keys(body), ['panel']);
  assert.equal(body.panel.future_panel, 4); assert.equal(body.panel.items[0].future_item, 'keep');
  assert.equal(body.panel.items[0].only_admin, true); assert.equal('version' in body.panel, false);
  assert.equal('group_openids' in body, false);
  assert.equal(draft.targets[0], 'group-one');
  assert.deepEqual(validatePanel(draft), []);
  draft.items[0].name = '.jrrp';
  assert.equal(panelResponse.panel.items[0].name, '.help');
  const changed = { ...panelResponse, version: 100, panel: { ...panelResponse.panel, version: 100 } };
  assert.equal(fingerprint(panelBody(readPanel(changed))), fingerprint(panelBody(readPanel(panelResponse))));
});

test('new panel payloads support all four scenes and restrict specific targets correctly', () => {
  for (const scope of ['c2c', 'group', 'channel', 'dm']) {
    const draft = newPanel(scope); draft.items.push({ ...newPanelItem(), name: '.help' });
    assert.equal(panelBody(draft).scope, scope); assert.deepEqual(validatePanel(draft), []);
    draft.targetType = 'specific'; draft.targets = ['opaque-id'];
    if (['c2c', 'group'].includes(scope)) {
      assert.deepEqual(validatePanel(draft), []);
      assert.deepEqual(panelBody(draft)[scope === 'group' ? 'group_openids' : 'user_openids'], ['opaque-id']);
    } else assert.ok(validatePanel(draft).some((issue) => issue.key === 'scope_invalid'));
  }
});

test('panel length, link, element and initial-target limits are checked before publishing', () => {
  const draft = newPanel('group'); draft.items = Array.from({ length: 21 }, () => ({ ...newPanelItem(), name: '.help' }));
  assert.ok(validatePanel(draft).some((issue) => issue.key === 'items_limit'));
  draft.items = [{ ...newPanelItem(), name: '一二三四五六七八', desc: 'a'.repeat(31), type: 'link', link: 'http://example.invalid' }];
  draft.remark = '🎲'.repeat(256); draft.targetType = 'specific'; draft.targets = [];
  const issues = validatePanel(draft).map((issue) => issue.key);
  for (const key of ['remark_limit', 'panel_text_limit', 'targets_limit', 'https_required']) assert.ok(issues.includes(key));
  draft.remark = '🎲'.repeat(255); assert.ok(!validatePanel(draft).some((issue) => issue.key === 'remark_limit'));
});

test('association operations deduplicate input and never replace a full association list', () => {
  const ids = parseTargets('a, b\nc，a; d；b'); assert.deepEqual(ids, ['a', 'b', 'c', 'd']);
  assert.deepEqual(targetBody(readPanel(panelResponse), 'del', ids), { panelId: 'p_group', op: 'del', groupOpenIds: ids });
  assert.deepEqual(targetBody({ id: 'p_user', scope: 'c2c', targetType: 'specific' }, 'add', ids), { panelId: 'p_user', op: 'add', userOpenIds: ids });
  for (const record of [{ id: '', scope: 'c2c', targetType: 'specific' }, { id: 'x', scope: 'group', targetType: 'all' }, { id: 'x', scope: 'channel', targetType: 'specific' }])
    assert.throws(() => targetBody(record, 'add', ids), /invalid_targets/);
  for (const ids of [[], Array.from({ length: 21 }, (_, i) => String(i)), [' ']]) assert.throws(() => targetBody(readPanel(panelResponse), 'add', ids));
  const large = readPanel({ ...panelResponse, group_openids: Array.from({ length: 1000 }, (_, i) => `g-${i}`) });
  assert.equal(large.targets.length, 1000); assert.deepEqual(targetBody(large, 'add', ['new']), { panelId: 'p_group', op: 'add', groupOpenIds: ['new'] });
});

test('list pagination uses records and next_cursor and rejects malformed list structures', () => {
  const page = readPanelList({ records: [panelResponse], next_cursor: 'next', is_end: false });
  assert.equal(page.records[0].id, 'p_group'); assert.equal(page.next, 'next');
  assert.equal(readPanelList({ records: [], next_cursor: 'ignored', is_end: true }).next, '');
  for (const value of [{ panels: [] }, { records: null }, { records: [], next_cursor: 123 }]) assert.throws(() => readPanelList(value));
});

test('account-scoped action calls keep authentication, encoded IDs, timeouts and errors', async () => {
  const oldFetch = globalThis.fetch, oldStorage = globalThis.localStorage;
  const calls = [];
  globalThis.localStorage = { getItem: () => 'fixture-key' };
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ code: 0, data: { version: 4 } }), { headers: { 'Content-Type': 'application/json' } }); };
  try {
    assert.deepEqual(await qqOfficialAction('account/a?', 'qq_get_menu'), { version: 4 });
    assert.equal(calls[0].url, '/api/adapters/account%2Fa%3F/qq-official-actions');
    assert.equal(calls[0].options.headers['X-API-Key'], 'fixture-key');
    assert.ok(calls[0].options.signal);
    assert.deepEqual(JSON.parse(calls[0].options.body), { action: 'qq_get_menu', params: {} });
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 1, message: 'permission denied' }), { headers: { 'Content-Type': 'application/json' } });
    await assert.rejects(qqOfficialAction('b', 'qq_set_menu'), /permission denied/);
  } finally { globalThis.fetch = oldFetch; globalThis.localStorage = oldStorage; }
});

test('editors preserve drafts across tabs and failures and use styled controls, guards and overwrite confirmations', () => {
  const page = readFileSync(new URL('../src/pages/qq-official-page.tsx', import.meta.url), 'utf8');
  const menu = readFileSync(new URL('../src/components/adapter/qq-menu-editor.tsx', import.meta.url), 'utf8');
  const panels = readFileSync(new URL('../src/components/adapter/qq-panel-editor.tsx', import.meta.url), 'utf8');
  assert.match(page, /AccountEditors key=\{adapter\.id\}/);
  assert.equal([...page.matchAll(/TabsContent forceMount/g)].length, 2);
  assert.match(page, /query\.set\('adapter', value\)/);
  assert.match(readFileSync(new URL('../src/routes/index.tsx', import.meta.url), 'utf8'), /createNavigationBlocker\(confirmPageLeave\)/);
  for (const source of [menu, panels]) {
    assert.match(source, /useUnsavedChanges\(/); assert.match(source, /dlg\.confirm\(/);
    assert.match(source, /new Error\('conflict'\)/); assert.match(source, /EditorPreview/);
    assert.doesNotMatch(source, /window\.(?:alert|confirm|prompt)\(|<select\b|dangerouslySetInnerHTML/);
  }
  assert.match(panels, /if \(operation\.current \|\| !connected\) return/);
  assert.match(panels, /cursors\.current\.has\(page\.next\)/);
  assert.match(menu, /fingerprint\(menuBody\(latest\)\)/);
});

test('all editor labels and validation errors are localized in the four supported languages', () => {
  const reference = Object.keys(qqOfficialEditorCopy['zh-Hans']);
  for (const language of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
    assert.deepEqual(Object.keys(qqOfficialEditorCopy[language]), reference);
    for (const value of Object.values(qqOfficialEditorCopy[language])) assert.ok(typeof value === 'string' && value.trim());
  }
});

function componentAction(file, name, context) {
  const source = readFileSync(new URL(`../src/components/adapter/${file}.tsx`, import.meta.url), 'utf8');
  const tree = ts.createSourceFile(file + '.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let action;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) action = node.initializer;
    ts.forEachChild(node, visit);
  }; visit(tree); assert.ok(action, name);
  const code = ts.transpileModule('(' + action.getText(tree) + ')', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return vm.runInNewContext(code, context);
}
function menuContext(qqOfficialAction) {
  const events = [], baseline = readMenu(menuResponse), draft = readMenu(menuResponse);
  draft.items[0].name = '新帮助';
  return { events, draft, baseline, issues: [], connected: true, adapterId: 'account-a', accountName: 'A',
    gate: { current: createRequestGate() }, operation: { current: false }, dlg: { confirm: async () => true },
    readMenu, menuBody, fingerprint, errorMessage: error => error.message, qqOfficialAction, t: key => key,
    setBusy: value => events.push(['busy', value]), setError: value => events.push(['error', value]),
    setDraft: value => events.push(['draft', value]), setBaseline: value => events.push(['baseline', value]), toast: value => events.push(['toast', value]) };
}
test('menu publishing detects concurrent edits and preserves the draft on rejected writes', async () => {
  for (const cause of ['conflict', 'permission denied']) {
    const calls = [], context = menuContext(async (adapter, action) => {
      calls.push([adapter, action]);
      if (action === 'qq_get_menu') return cause === 'conflict' ? { ...menuResponse, version: 99 } : menuResponse;
      throw new Error(cause);
    });
    await componentAction('qq-menu-editor', 'publish', context)();
    assert.equal(calls.filter(([, action]) => action === 'qq_set_menu').length, cause === 'conflict' ? 0 : 1);
    assert.equal(context.events.filter(([event]) => event === 'draft' || event === 'baseline' || event === 'toast').length, 0);
    assert.ok(context.events.some(([event, value]) => event === 'error' && value.includes(cause)));
    assert.equal(context.draft.items[0].name, '新帮助'); assert.equal(context.operation.current, false);
  }
});
test('duplicate publish clicks and retired-account responses cannot overwrite newer state', async () => {
  let finish; const calls = [];
  const context = menuContext(async (adapter, action) => {
    calls.push([adapter, action]); if (action === 'qq_get_menu') return menuResponse;
    return new Promise(resolve => { finish = resolve; });
  });
  const publish = componentAction('qq-menu-editor', 'publish', context);
  const pending = publish();
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  await publish(); assert.equal(calls.filter(([, action]) => action === 'qq_set_menu').length, 1);
  context.gate.current.invalidate(); finish({ version: 5 }); await pending;
  assert.equal(context.events.filter(([event]) => event === 'draft' || event === 'baseline' || event === 'toast').length, 0);
});

test('advanced replies is one parent with independent custom-reply and card/button pages', () => {
  const source = readFileSync(new URL('../src/components/layout/sidebar.tsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('sidebar.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const icons = {}, declarations = {};
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier.text === 'lucide-react')
      for (const item of node.importClause.namedBindings.elements) icons[item.name.text] = item.name.text;
    if (ts.isVariableDeclaration(node) && ['NAV', 'isActivePath'].includes(node.name.getText(tree))) declarations[node.name.getText(tree)] = node.initializer;
    ts.forEachChild(node, visit);
  }; visit(tree);
  const evaluate = (name) => vm.runInNewContext(ts.transpileModule('(' + declarations[name].getText(tree) + ')', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, icons);
  const nav = evaluate('NAV'), active = evaluate('isActivePath');
  const group = nav.find((item) => item.labelKey === 'nav.replies');
  assert.equal('path' in group, false);
  assert.deepEqual(Array.from(group.children, (child) => [child.labelKey, child.path]), [['nav.custom_replies', '/replies'], ['qq_editor.title', '/qq-official']]);
  assert.equal(active('/adapters', '/qq-official'), false);
  assert.equal(active('/qq-official', '/qq-official'), true);
  assert.match(source, /setExpandedGroup\(active\.labelKey\)/);
  const adapters = readFileSync(new URL('../src/pages/adapters-page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(adapters, /window\.location\.hash = '\/qq-official'/);
  assert.match(adapters, /onOfficialControls=/); // The account-scoped contextual shortcut remains.
});

test('new page names are localized without changing old URLs or removing official-feature help', () => {
  const expected = { 'zh-Hans': ['自定义回复', '卡片与按钮'], 'zh-Hant': ['自訂回覆', '卡片與按鈕'], en: ['Custom Replies', 'Cards & Buttons'], ja: ['カスタム返信', 'カードとボタン'] };
  for (const [language, [custom, cards]] of Object.entries(expected)) {
    const locale = JSON.parse(readFileSync(new URL(`../src/i18n/locales/${language}.json`, import.meta.url), 'utf8'));
    assert.equal(locale.nav.custom_replies, custom); assert.equal(locale.replies.title, custom);
    assert.equal(qqOfficialEditorCopy[language].title, cards);
    assert.match(qqOfficialEditorCopy[language].subtitle, /QQ/);
  }
  const routes = JSON.parse(readFileSync(new URL('../src/routes/route-manifest.json', import.meta.url), 'utf8'));
  assert.equal(routes.find((route) => route.path === '/replies').component, 'RepliesPage');
  assert.equal(routes.find((route) => route.path === '/qq-official').component, 'QQOfficialPage');
});
