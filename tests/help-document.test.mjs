import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHelpImport, validHelpName, helpArchive, parseHelpArchive, helpSourceKind,
  canEditHelp, belongsInCommandTexts, HELP_KINDS } from '../.test-dist/lib/help-document.js';
import { helpLibraryCopy } from '../.test-dist/i18n/help-library.js';
import { readTemplateVariants } from '../.test-dist/lib/weighted-templates.js';
import fs from 'node:fs';

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

test('help sources distinguish custom topics/files, builtin customizations, plugin engines, packs and future sources', () => {
  for (const [source, expected] of Object.entries({
    builtin: 'builtin', custom: 'custom', 'file:关于御主': 'custom',
    plugin: 'plugin', 'plugin:dailynews': 'plugin', 'lua:求签': 'plugin',
    'rule:coc7': 'rule', 'helpdoc:Rules': 'helpdoc', 'future:source': 'other',
  })) assert.equal(helpSourceKind(source), expected);
  for (const source of ['builtin', 'custom']) {
    assert.equal(canEditHelp({ source, i18nKey: 'help.topic.关于Master', editable: true }), true);
    assert.equal(canEditHelp({ source, editable: true }), false);
    assert.equal(canEditHelp({ source, i18nKey: 'dice.roll.result', editable: true }), false);
  }
  assert.equal(canEditHelp({ source: 'file:指南', editable: true }), true);
  assert.equal(canEditHelp({ source: 'custom', i18nKey: 'help.topic.name', editable: false }), false);
  for (const source of ['lua:mod', 'plugin:mod', 'helpdoc:pack', 'future:source'])
    assert.equal(canEditHelp({ source, i18nKey: 'help.topic.name', editable: true }), false);
});

test('standalone global help moves out of unclassified command text without hiding persona or command usage editing', () => {
  assert.equal(belongsInCommandTexts('help.topic.关于Master', false, 0), false);
  assert.equal(belongsInCommandTexts('help.topic.关于Master', false, 2), true);
  assert.equal(belongsInCommandTexts('help.topic.r', true, 0), true);
  assert.equal(belongsInCommandTexts('dice.roll.result', false, 0), true);
  assert.equal(belongsInCommandTexts('legacy.unrecognized', false, 0), true);
});

test('help archive round-trips files, legacy DB topics, locales, formats, blanks and weighted raw templates', () => {
  const files = [{ name: '同名词条', content: '文件版本\n第二行' }];
  const variants = [{ text: '**甲**', weight: 1 }, { text: '{sample:乙|丙}', weight: 3 }];
  const archive = helpArchive(files, {
    'zh-Hans': { 'help.topic.同名词条': { value: '**原内容**', format: 'markdown' },
      'help.topic.关于Master': '', 'dice.roll.result': 'excluded', 'help.topic.r': { value: '**甲**', format: 'markdown', variants } },
    en: { 'help.topic.同名词条': 'Translation' },
  });
  assert.equal(archive.templates.length, 4);
  assert.deepEqual(parseHelpArchive('backup.json', JSON.stringify(archive)), archive);
  assert.deepEqual(archive.files, files);
  assert.deepEqual(archive.templates.find(item => item.key === 'help.topic.同名词条' && item.locale === 'zh-Hans'),
    { locale: 'zh-Hans', key: 'help.topic.同名词条', content: '**原内容**', format: 'markdown' });
  assert.deepEqual(readTemplateVariants(archive.templates.find(item => item.key === 'help.topic.r').content), variants);
  assert.equal(archive.templates.find(item => item.key === 'help.topic.关于Master').content, '');
  assert.deepEqual(parseHelpArchive('legacy.json', '{"关于御主":"原文"}').files, [{ name: '关于御主', content: '原文' }]);
  assert.deepEqual(parseHelpArchive('guide.md', '# guide').files, [{ name: 'guide', content: '# guide' }]);
  const dbOnly = helpArchive([], { ja: { 'help.topic.a/b.c': { value: 'DB names need not be filenames', format: 'plain' } } });
  assert.deepEqual(parseHelpArchive('db.json', JSON.stringify(dbOnly)), dbOnly);
});

test('versioned help archive rejects duplicate templates and non-help or malformed entries before requests', () => {
  const base = { kind: 'dicenext.help', version: 1, files: [], templates: [{ locale: 'zh-Hans', key: 'help.topic.介绍', content: 'ok', format: 'plain' }] };
  for (const invalid of [
    { ...base, version: 2 }, { ...base, files: {} }, { ...base, templates: [] },
    { ...base, templates: [...base.templates, ...base.templates] },
    ...[
      { key: 'dice.roll.result' }, { key: 'help.topic.' }, { content: null }, { locale: '../../x' },
      { locale: '' }, { format: 'html' }, { key: 'help.topic.a\nb' },
    ].map(patch => ({ ...base, templates: [{ ...base.templates[0], ...patch }] })),
  ]) assert.throws(() => parseHelpArchive('bad.json', JSON.stringify(invalid)));
});

test('source controls use frontend selects, send category before pagination and preserve the edit locale/format', () => {
  const page = fs.readFileSync(new URL('../src/pages/help-docs-page.tsx', import.meta.url), 'utf8');
  assert.ok(page.includes("q: search, kind, source, page:"));
  assert.ok(page.includes("q: search, kind, management:"));
  assert.ok(page.includes("setKind(value === '__all__' ? '' : value as HelpKind); setSource(''); setPage(1);"));
  assert.ok(page.includes('locale: edit.locale, key: edit.i18nKey, value: edit.content, format: edit.format'));
  assert.ok(page.includes('entry.locale || i18n.language'));
  assert.ok(page.includes('if (controller.signal.aborted) return;'));
  assert.ok(!page.includes('<select'));
  const commands = fs.readFileSync(new URL('../src/pages/commands-page.tsx', import.meta.url), 'utf8');
  assert.ok(commands.includes('belongsInCommandTexts(row.key, textMetadata.has(row.key), personaId)'));
  assert.ok(commands.includes('href="#/help"'));
});

test('help library source labels and explanations are localized consistently', () => {
  const languages = Object.values(helpLibraryCopy);
  const expected = Object.keys(languages[0]).sort();
  for (const copy of languages) {
    assert.deepEqual(Object.keys(copy).sort(), expected);
    assert.deepEqual(Object.keys(copy.kinds).sort(), [...HELP_KINDS].sort());
    for (const label of Object.values(copy.kinds)) assert.ok(label.trim());
    assert.ok(copy.language.includes('{{locale}}'));
    assert.ok(copy.export_hint.trim());
  }
});
