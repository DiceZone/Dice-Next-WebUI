import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHelpImport, validHelpName } from '../.test-dist/lib/help-document.js';

test('help imports preserve multiline, blank content and special object keys', () => {
  const text = '# 帮助\n.r  // 掷骰\n{draw:天气}';
  assert.deepEqual(parseHelpImport('入门.MD', text), [{ name: '入门', content: text }]);
  assert.deepEqual(parseHelpImport('docs.json', '{"__proto__":"正文","空文档":""}'), [{ name: '__proto__', content: '正文' }, { name: '空文档', content: '' }]);
  assert.deepEqual(parseHelpImport('docs.json', '[{"key":"入门","content":"保留"}]'), [{ name: '入门', content: '保留' }]);
});
test('help import validates the whole bundle and rejects duplicate or unsafe names', () => {
  for (const text of ['null', '5', '[]', '{}', '{"ok":"正文","bad":null}', '[{"name":"same","content":"a"},{"name":"same","content":"b"}]', '[null]', '{"../bad":"内容"}']) assert.throws(() => parseHelpImport('docs.json', text));
  assert.throws(() => parseHelpImport('docs.exe', 'text'));
  for (const name of ['', ' ', '.', '..', 'a/b', 'a\\b', 'a\n', ' a']) assert.equal(validHelpName(name), false);
  assert.equal(validHelpName('跑团指南'), true);
});
