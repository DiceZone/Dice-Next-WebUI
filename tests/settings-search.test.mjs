import assert from 'node:assert/strict';
import test from 'node:test';
import {
  matchSettingsSearch,
  SETTINGS_SEARCH_ENTRIES,
} from '../.test-dist/lib/settings-search.js';

const updateEntry = SETTINGS_SEARCH_ENTRIES.find((entry) => entry.id === 'about-update');
assert.ok(updateEntry);

const updateDocument = {
  title: '检测与自动更新',
  description: '从 GitHub Release 检测新版本，并自动选择可用镜像下载。',
  page: '关于',
  keywords: updateEntry.keywords ?? '',
};

test('container update vocabulary reaches the update settings', () => {
  ['更新', '升级', '容器', 'docker', 'container', '镜像升级', '自动检测', '容器更新'].forEach((query) => {
    assert.ok(matchSettingsSearch(query, updateDocument), `${query} should match update settings`);
  });
});

test('a no-space compound keeps every concept as a required qualifier', () => {
  const pluginOnly = {
    title: '插件管理',
    description: '管理 JavaScript 与 Lua 插件。',
    page: '插件',
    keywords: '插件 plugin js javascript lua module extension',
  };
  const scheduledPlugin = {
    title: '定时任务',
    description: '定时调用插件指令。',
    page: '定时任务',
    keywords: '定时任务 schedule cron timer plugin command lua 群 指令',
  };

  assert.equal(matchSettingsSearch('定时插件', pluginOnly), null);
  assert.ok(matchSettingsSearch('定时插件', scheduledPlugin));

  const replyOnly = {
    title: '回复模板',
    description: '编辑回复文案。',
    page: '回复',
    keywords: '回复 reply response template text markdown',
  };
  const translatedReply = {
    title: '回复翻译',
    description: '将回复自动翻译为目标语言。',
    page: '人工智能',
    keywords: '回复翻译 translate translation language',
  };
  assert.equal(matchSettingsSearch('回复翻译', replyOnly), null);
  assert.ok(matchSettingsSearch('回复翻译', translatedReply));
});

test('spaced multilingual aliases still use AND matching', () => {
  assert.ok(matchSettingsSearch('docker update', updateDocument));
  assert.equal(matchSettingsSearch('docker plugin', updateDocument), null);
});
