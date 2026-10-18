import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEFAULT_BOT_MESSAGE, BOT_MESSAGE_LIMIT, readBotMessageSettings, botMessageValues, validBotMessage } from '../.test-dist/lib/bot-message.js';
import { botMessageCopy } from '../.test-dist/i18n/bot-message.js';
import { SETTINGS_SEARCH_ENTRIES } from '../.test-dist/lib/settings-search.js';

test('new installations show the requested default footer without editable system lines', () => {
  assert.equal(DEFAULT_BOT_MESSAGE, 'Dice!Next 测试群：933145116\n如有故障或建议欢迎加群反馈\n使用 .help 查看帮助');
  assert.deepEqual(readBotMessageSettings(null), {
    message: DEFAULT_BOT_MESSAGE, legacyHeader: '', defaultLocale: 'zh-Hans', overridden: false,
  });
});

test('explicit blank appendices and exact owner whitespace survive reading and saving', () => {
  assert.equal(readBotMessageSettings({ values: { bot_msg: '' } }).message, '');
  assert.deepEqual(botMessageValues('  原文\n{self}\n', ''), { bot_msg: '  原文\n{self}\n', bot_header: '' });
  assert.deepEqual(botMessageValues('', ''), { bot_msg: '', bot_header: '' });
});

test('language metadata is from the backend and scope metadata controls reset availability', () => {
  const value = readBotMessageSettings({ scope: 'account', values: { bot_msg: 'Owner', bot_header: 'Old header' },
    default_locale: 'en', overrides: { bot_msg: '' } });
  assert.deepEqual(value, { message: 'Owner', legacyHeader: 'Old header', defaultLocale: 'en', overridden: true });
  assert.equal(readBotMessageSettings({ scope: 'global', overrides: { bot_msg: '' } }).overridden, false);
  assert.equal(readBotMessageSettings({ scope: 'account', overrides: { other: true } }).overridden, false);
  assert.equal(readBotMessageSettings({ values: { bot_msg: false, bot_header: [] } }).message, DEFAULT_BOT_MESSAGE);
});

test('appendix limits count UTF-8 bytes rather than Chinese characters or UTF-16 units', () => {
  assert.equal(validBotMessage('a'.repeat(BOT_MESSAGE_LIMIT), ''), true);
  assert.equal(validBotMessage('a'.repeat(BOT_MESSAGE_LIMIT + 1), ''), false);
  assert.equal(validBotMessage('', '字'.repeat(Math.floor(BOT_MESSAGE_LIMIT / 3) + 1)), false);
  assert.equal(validBotMessage('😀'.repeat(BOT_MESSAGE_LIMIT / 4), ''), true);
  assert.equal(validBotMessage('😀'.repeat(BOT_MESSAGE_LIMIT / 4 + 1), ''), false);
});

test('all four interface languages document fixed information and the independent global reply language', () => {
  assert.deepEqual(Object.keys(botMessageCopy).sort(), ['en', 'ja', 'zh-Hans', 'zh-Hant']);
  for (const bundle of Object.values(botMessageCopy)) {
    assert.deepEqual(Object.keys(bundle).sort(), Object.keys(botMessageCopy.en).sort());
    assert.ok(bundle.help.includes('ShiaNyaa')); assert.ok(bundle.help.includes('希亚'));
    assert.ok(bundle.migration_help.includes('strBotMsg')); assert.ok(bundle.language.includes('{{locale}}'));
  }
});

test('BotMsg editor is discoverable in system settings and keeps scope/reset and fixed-field boundaries', () => {
  const entry = SETTINGS_SEARCH_ENTRIES.find((value) => value.id === 'settings-bot-message');
  assert.equal(entry.path, '/settings'); assert.equal(entry.titleKey, 'bot_message.title');
  assert.ok(entry.keywords.includes('strBotMsg'));
  const source = fs.readFileSync(new URL('../src/pages/settings-page.tsx', import.meta.url), 'utf8');
  const card = source.slice(source.indexOf('const BotMessageCard:'), source.indexOf('// ── 图片发送方式'));
  assert.ok(card.includes('useScopedLoader(scopeProps, apply)'));
  assert.ok(card.includes('botMessageValues(message, header)'));
  assert.ok(card.includes("reset ? ['bot_msg', 'bot_header'] : undefined"));
  assert.ok(card.includes('saveLock.current')); assert.ok(card.includes('if (current())'));
  assert.ok(source.includes('<BotMessageCard key={scopeKey} {...currentScopeProps} />'));
  assert.equal(card.includes('changeLanguage('), false);
  for (const key of ['version', 'compiler', 'expression_order', 'default_locale']) assert.equal(card.includes(`\"${key}\"`), false);
});
