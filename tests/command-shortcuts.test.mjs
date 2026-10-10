import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { shortcutTemplatePreviewArgs } from '../.test-dist/lib/command-shortcuts.js';
import { shortcuts } from '../.test-dist/i18n/shortcuts.js';
import { buildTextMetadata, filterAndSortTexts } from '../.test-dist/lib/command-text-catalog.js';

const keys = ['usage', 'execute_usage', 'personal', 'group', 'added', 'replaced', 'removed', 'not_found',
  'list', 'list_item', 'list_empty', 'invalid_name', 'invalid_target', 'recursion', 'target_unknown', 'limit', 'storage_error', 'trigger_prefix'].sort();
const locales = ['zh-Hans', 'zh-Hant', 'en', 'ja'];

test('all locales name every shortcut reply and expose scope/security/migration help', () => {
  for (const locale of locales) {
    const copy = shortcuts[locale];
    assert.deepEqual(Object.keys(copy.labels).sort(), keys);
    for (const label of Object.values(copy.labels)) assert.ok(label.length > 0);
    assert.match(copy.help, /\.alias/); assert.match(copy.help, /\.a /);
    assert.match(copy.help, /--my/); assert.match(copy.help, /\.admin account-alias/);
    assert.match(copy.help, /\.bind/);
  }
  const editor = readFileSync(new URL('../src/pages/commands-page.tsx', import.meta.url), 'utf8');
  assert.match(editor, /shortcuts.labels/); assert.match(editor, /shortcuts.help/);
  assert.match(editor, /shortcutTemplatePreviewArgs/);
  const resources = readFileSync(new URL('../src/i18n/index.ts', import.meta.url), 'utf8');
  for (const locale of locales) assert.ok(resources.includes(locale.startsWith('zh')
    ? `shortcuts: shortcuts['${locale}']` : `shortcuts: shortcuts.${locale}`));
});

test('shortcut previews supply localized command/list/name without changing caller/global variables', () => {
  const base = { name: '骰娘', nick: '玩家', group: '2000', user: '1000', source: 'unrelated' };
  assert.equal(shortcutTemplatePreviewArgs(base, 'alias.added', 'en'), base);
  assert.equal(shortcutTemplatePreviewArgs(base, 'dice.roll.result', 'en'), base);
  for (const locale of locales) {
    const preview = shortcutTemplatePreviewArgs(base, 'shortcut.trigger_prefix', locale);
    assert.equal(preview.shortcut, shortcuts[locale].example_name);
    assert.equal(preview.command, shortcuts[locale].example_command);
    assert.equal(preview.source, shortcuts[locale].group);
    assert.ok(preview.list.includes(`.&${preview.shortcut}`));
    assert.equal(preview.name, base.name); assert.equal(preview.nick, base.nick);
    assert.equal(preview.group, base.group); assert.equal(preview.user, base.user);
  }
  assert.equal(base.source, 'unrelated');
  assert.equal(shortcutTemplatePreviewArgs(base, 'shortcut.list', 'unknown').source, shortcuts['zh-Hans'].group);
});

test('shortcut texts are searchable with distinct labels in Tools, not account permissions', () => {
  const metadata = buildTextMetadata([{ cmd: '.alias', title: '快捷指令', category: '工具',
    example: '.alias 侦查 .ra 侦查 / .&侦查 60', replies: keys.map(key => ({ key: `shortcut.${key}` })) }],
    key => shortcuts['zh-Hans'].labels[key.split('.')[1]] ?? '');
  const rows = [...metadata].map(([key, info]) => ({ key, ...info, group: 'shortcut', default: 'text', override: null }));
  assert.equal(rows.length, keys.length);
  const matched = filterAndSortTexts(rows, '调用结果前缀', '工具', { field: 'description', direction: 'asc' });
  assert.equal(matched.length, 1); assert.equal(matched[0].key, 'shortcut.trigger_prefix');
  assert.equal(filterAndSortTexts(rows, '', '权限', { field: 'description', direction: 'asc' }).length, 0);
});

const backendDirectory = new URL('../../Dice-Next/server/i18n/', import.meta.url);
test('production backend preview resolves shortcut variables and nested sample in all locales', {
  skip: !process.env.DICENEXT_TEST_RENDERER || !existsSync(new URL('zh-Hans.json', backendDirectory)),
}, () => {
  for (const locale of locales) {
    const backend = JSON.parse(readFileSync(new URL(`${locale}.json`, backendDirectory), 'utf8'));
    assert.deepEqual(Object.keys(backend.shortcut).sort(), keys);
    const args = shortcutTemplatePreviewArgs({ name: 'Dice', nick: 'Player' }, 'shortcut.added', locale);
    const input = { locale, args, format: 'plain', variants: [{ text: 'NEVER', weight: 0 },
      { text: backend.shortcut.added + ' {sample:{shortcut}|{shortcut}}', weight: 1 }] };
    const result = spawnSync(process.env.DICENEXT_TEST_RENDERER, [], { input: JSON.stringify(input), encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.code, 0);
    assert.ok(output.data.onebot.includes(args.shortcut));
    assert.ok(output.data.onebot.includes(args.command));
    assert.ok(!output.data.onebot.includes('NEVER'));
    assert.ok(!/\{(?:shortcut|source|command|sample):?/.test(output.data.onebot));
  }
});
