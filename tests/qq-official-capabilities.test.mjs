import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const form = readFileSync(new URL('../src/components/adapter/adapter-form.tsx', import.meta.url), 'utf8');
const labels = readFileSync(new URL('../src/i18n/feature-help.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(labels, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports });

test('official event switches keep safe defaults in schemas and edit/reset values', () => {
  assert.match(form, /subscribeGroupMemberEvents: z\.boolean\(\)\.optional\(\)\.default\(false\)/);
  assert.match(form, /autoAcknowledgeInteractions: z\.boolean\(\)\.optional\(\)\.default\(true\)/);
  for (const field of ['subscribeGroupMemberEvents', 'autoAcknowledgeInteractions']) {
    assert.equal([...form.matchAll(new RegExp(`${field}: adapter\\?\\.${field}`, 'g'))].length, 2);
    assert.match(form, new RegExp(`${field}: current\\.${field}`));
  }
});

test('official event switches use shared frontend switches and clickable feature help', () => {
  assert.match(form, /\['subscribeGroupMemberEvents', 'autoAcknowledgeInteractions'\]/);
  assert.match(form, /<HelpLabel htmlFor=\{key\}/);
  assert.match(form, /<Switch id=\{key\} checked=\{watch\(key\)\}/);
});

test('all supported languages explain subscription permissions and callback ownership', () => {
  const copy = module.exports.featureHelpCopy;
  for (const language of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
    for (const key of ['subscribeGroupMemberEvents_title', 'subscribeGroupMemberEvents_desc', 'autoAcknowledgeInteractions_title', 'autoAcknowledgeInteractions_desc']) {
      assert.equal(typeof copy[language][key], 'string'); assert.ok(copy[language][key].trim());
    }
  }
  assert.match(copy['zh-Hans'].autoAcknowledgeInteractions_desc, /不会把回调数据自动当成指令执行/);
  assert.match(copy['zh-Hans'].subscribeGroupMemberEvents_desc, /默认关闭/);
});
