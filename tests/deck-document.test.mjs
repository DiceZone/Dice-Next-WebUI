import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeckDocument, editableEntries, replaceDeckEntries, addDeckGroup, deckFileKey, isReadonlyDeck } from '../.test-dist/lib/deck-document.js';
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
