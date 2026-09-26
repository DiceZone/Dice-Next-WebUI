import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeckDocument, editableEntries, replaceDeckEntries, addDeckGroup } from '../.test-dist/lib/deck-document.js';

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
