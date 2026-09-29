import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeckDocument, editableEntries, replaceDeckEntries, addDeckGroup, deckFileKey, isReadonlyDeck, canCopyDeckGroup, deckCopyFilename } from '../.test-dist/lib/deck-document.js';
import { readFile } from 'node:fs/promises';

test('same-named built-in and user decks have distinct selection and content identities', () => {
  const user = { filename: '合集.json', source: 'user', readonly: false };
  const builtin = { filename: '合集.json', source: 'builtin', readonly: true };
  assert.notEqual(deckFileKey(user), deckFileKey(builtin));
  assert.equal(deckFileKey(user), deckFileKey({ filename: user.filename }));
  assert.equal(deckFileKey(builtin), deckFileKey({ filename: builtin.filename, readonly: true }));
  assert.equal(isReadonlyDeck(builtin), true);
  assert.equal(isReadonlyDeck({ filename: builtin.filename, source: 'builtin' }), true);
  assert.equal(isReadonlyDeck({ filename: builtin.filename, readonly: true }), true);
  assert.equal(isReadonlyDeck(user), false);
  assert.equal(isReadonlyDeck({ filename: user.filename }), false);
});

test('deck UI scopes reads by source and guards built-in mutation controls', async () => {
  const page = await readFile(new URL('../src/pages/decks-page.tsx', import.meta.url), 'utf8');
  assert.ok(page.includes('&source=${source}'));
  assert.ok(page.includes('[filename, source, revision,'));
  assert.ok(page.includes('deckFileKey(content) === currentKey'));
  assert.ok(page.includes('key={deckFileKey(file)}'));
  assert.ok(page.includes('if (!current || readOnly || busy'));
  assert.ok(page.includes('if (!readOnly) setEditing(current)'));
  assert.ok(page.includes('disabled={readOnly || currentContent === undefined || busy}'));
  for (const locale of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
    const strings = JSON.parse(await readFile(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8'));
    assert.ok(strings.decks.builtin_readonly);
    assert.ok(strings.decks.builtin_readonly_hint);
  }
});

test('entry edits preserve metadata, extension fields, weights, references and multiline entries', () => {
  const input = { _title: ['旅行'], _meta: { author: '希亚' }, extension: { enabled: true }, 隐藏: ['::3::{另一牌堆}'], 旅途: ['第一行\n第二行', '旧内容'] };
  const result = parseDeckDocument(replaceDeckEntries(JSON.stringify(input), '旅途', ['第一行\n第二行', '新内容']));
  assert.deepEqual(result, { ...input, 旅途: ['第一行\n第二行', '新内容'] });
});

test('copying is limited to loaded nonempty public built-in groups', () => {
  const builtin = { filename: '合集.json', source: 'builtin' };
  const document = { 硬币: ['正', '反'], 空牌堆: [], _隐藏: ['内容'], _title: ['标题'], 扩展: {} };
  assert.equal(canCopyDeckGroup(builtin, '硬币', document), true);
  assert.equal(canCopyDeckGroup({ filename: '合集.json', readonly: true }, '硬币', document), true);
  assert.equal(canCopyDeckGroup({ filename: '合集.json', source: 'user' }, '硬币', document), false);
  for (const name of [undefined, '', '空牌堆', '_隐藏', '_title', '扩展', '不存在', 'toString']) {
    assert.equal(canCopyDeckGroup(builtin, name, document), false);
  }
  assert.equal(canCopyDeckGroup(builtin, '硬币', null), false);
});

test('copy filename suggestions handle Chinese, invalid paths and Windows reserved names', () => {
  assert.equal(deckCopyFilename('硬币'), '硬币.json');
  assert.equal(deckCopyFilename('a/b:c?*'), 'a_b_c__.json');
  assert.equal(deckCopyFilename('...  '), 'deck.json');
  assert.equal(deckCopyFilename('CON'), '_CON.json');
  assert.equal(deckCopyFilename('Lpt1.foo'), '_Lpt1.foo.json');
  assert.equal(deckCopyFilename('🌟'.repeat(101)), `${'🌟'.repeat(100)}.json`);
});

test('merged deck UI uses styled copy dialog, copy API and user-source selection', async () => {
  const page = await readFile(new URL('../src/pages/decks-page.tsx', import.meta.url), 'utf8');
  assert.ok(page.includes('await dlg.prompt('));
  assert.ok(page.includes("deckRequest<{ filename: string; entry: string }>('/copy'"));
  assert.ok(page.includes('filename: sourceFilename, entry, targetFilename: targetFilename.trim()'));
  assert.ok(page.includes("deckFileKey({ filename: data.filename, source: 'user' })"));
  assert.ok(page.includes('copying.current || touring'));
  assert.ok(page.includes('disabled={busy || touring}'));
  for (const locale of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
    const strings = JSON.parse(await readFile(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8'));
    for (const key of ['copy_entry', 'copy_title', 'copy_description', 'copy_success', 'copy_fail']) assert.ok(strings.decks[key]);
  }
});
test('import validation matches backend arrays-only contract, editing retains extensions', () => {
  for (const bad of ['null', '[]', '1', '"text"', '{']) assert.throws(() => parseDeckDocument(bad));
  assert.throws(() => parseDeckDocument('{"_meta":{}}', true));
  assert.deepEqual(parseDeckDocument('{"_meta":{}}'), { _meta: {} });
  assert.deepEqual(parseDeckDocument('{"a":["x",1,{}]}', true), { a: ['x', 1, {}] });
  assert.equal(editableEntries(['a', '\n']), true);
  assert.equal(editableEntries(['a', 1]), false);
});
test('adding a group never overwrites metadata or an existing group', () => {
  const input = '{"_title":["标题"],"a":["x"]}';
  assert.throws(() => addDeckGroup(input, ' a '));
  assert.throws(() => addDeckGroup(input, '_title'));
  assert.throws(() => addDeckGroup(input, '  '));
  assert.deepEqual(parseDeckDocument(addDeckGroup(input, ' b ')), { _title: ['标题'], a: ['x'], b: [] });
});
test('special property names remain own data fields', () => {
  const result = parseDeckDocument(addDeckGroup('{}', '__proto__'));
  assert.equal(Object.hasOwn(result, '__proto__'), true);
  assert.deepEqual(result.__proto__, []);
});
