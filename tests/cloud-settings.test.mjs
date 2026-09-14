import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { CLOUD_SETTING_IDS, cloudKeyPatch, isCloudSettingsQuery, resolveSettingsRoute } from '../.test-dist/lib/cloud-settings.js';
import { SETTINGS_SEARCH_ENTRIES, searchDestination, matchSettingsSearch } from '../.test-dist/lib/settings-search.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

// Bundle real components/store in memory; no browser or running backend required.
const compiled = await build({
  stdin: {
    contents: [
      "import React from 'react';",
      "import { renderToStaticMarkup } from 'react-dom/server';",
      "import { I18nextProvider } from 'react-i18next';",
      "import { createInstance } from 'i18next';",
      "import locale from './src/i18n/locales/zh-Hans.json';",
      "import { SettingsPage } from './src/pages/settings-page';",
      "import { CloudSettingsPage } from './src/pages/cloud-settings-page';",
      "export { zustandAdapterStore as store } from './src/store/adapter-store';",
      "const i18n = createInstance(); i18n.init({ lng: 'zh-Hans', initImmediate: false, resources: { 'zh-Hans': { translation: locale } } });",
      "export const render = (cloud = false) => renderToStaticMarkup(React.createElement(I18nextProvider, { i18n }, React.createElement(cloud ? CloudSettingsPage : SettingsPage)));",
    ].join('\n'),
    resolveDir: fileURLToPath(new URL('../', import.meta.url)),
  },
  alias: { '@': fileURLToPath(new URL('../src/', import.meta.url)) },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
});
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const ui = module.exports;

test('independent cloud page excludes image hosting while basic settings retain it', () => {
  const original = globalThis.window;
  try {
    for (const hash of ['#/cloud-services', '#/settings?tab=cloud', '#/settings?focus=settings-heartbeat']) {
      globalThis.window = { location: { hash } };
      const [path, query = ''] = hash.slice(1).split('?');
      const html = ui.render(resolveSettingsRoute(path, query).path === '/cloud-services');
      for (const id of CLOUD_SETTING_IDS) assert.ok(html.includes('data-setting-anchor="' + id + '"'), id);
      assert.ok(!html.includes('data-setting-anchor="settings-master"'));
      assert.ok(!html.includes('data-setting-anchor="settings-image-host"'));
      assert.ok(!html.includes('role="tablist"'));
      assert.ok(html.includes('骰娘密钥配置管理'));
      // Radix emits hidden native selects for form compatibility; the visible UI is styled.
      for (const [select] of html.matchAll(/<select[^>]*>/g)) {
        assert.ok(select.includes('aria-hidden="true"'));
        assert.ok(select.includes('tabindex="-1"'));
      }
    }
    globalThis.window = { location: { hash: '#/settings' } };
    const html = ui.render();
    assert.ok(html.includes('data-setting-anchor="settings-master"'));
    assert.ok(html.includes('data-setting-anchor="settings-image-host"'));
    assert.ok(html.includes('基础设置'));
    for (const id of CLOUD_SETTING_IDS) assert.ok(!html.includes('data-setting-anchor="' + id + '"'), id);
  } finally {
    if (original === undefined) delete globalThis.window; else globalThis.window = original;
  }
});

test('shared adapter store sends key-only updates, preserves other accounts and propagates failures', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const adapters = [
    { id: '1', name: 'fixture one', enabled: true, endpoint: 'ws://fixture.invalid', heartApiKeyConfigured: false },
    { id: '2', name: 'fixture two', enabled: false, heartApiKeyConfigured: false },
  ];
  globalThis.localStorage = { getItem: () => null };
  ui.store.setState({ adapters });
  try {
    for (const key of ['bdc_fixture_1234', '']) {
      globalThis.fetch = async (url, options) => {
        assert.equal(url, '/api/adapters/1');
        assert.equal(options.method, 'PUT');
        assert.deepEqual(JSON.parse(options.body), { heartApiKey: key });
        return new Response(JSON.stringify({ code: 0, data: { ...adapters[0], heartApiKeyConfigured: !!key, heartApiKeyTail: key.slice(-4) } }), { headers: { 'Content-Type': 'application/json' } });
      };
      await ui.store.getState().updateAdapter('1', cloudKeyPatch(key, !key));
      assert.equal(ui.store.getState().adapters[0].heartApiKeyConfigured, !!key);
      assert.equal(ui.store.getState().adapters[0].endpoint, adapters[0].endpoint);
      assert.deepEqual(ui.store.getState().adapters[1], adapters[1]);
    }
    const before = ui.store.getState().adapters;
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 1, message: 'fixture rejected' }), { headers: { 'Content-Type': 'application/json' } });
    await assert.rejects(ui.store.getState().updateAdapter('1', { heartApiKey: 'bdc_fixture_error' }));
    assert.deepEqual(ui.store.getState().adapters, before);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = originalStorage;
  }
});

test('blank input preserves keys, explicit clearing removes only the key', () => {
  assert.equal(cloudKeyPatch('', false), null);
  assert.equal(cloudKeyPatch('  \t ', false), null);
  assert.deepEqual(cloudKeyPatch(' bdc_fixture_1234 ', false), { heartApiKey: 'bdc_fixture_1234' });
  assert.deepEqual(cloudKeyPatch('ignored draft', true), { heartApiKey: '' });
  assert.deepEqual(cloudKeyPatch('', true), { heartApiKey: '' });
});

test('cloud search uses its own route; old cloud bookmarks and image-host links remain usable', () => {
  for (const id of CLOUD_SETTING_IDS) {
    const entry = SETTINGS_SEARCH_ENTRIES.find((item) => item.id === id);
    assert.ok(entry, id);
    assert.equal(entry.path, '/cloud-services', id);
    assert.equal(entry.tab, undefined, id);
    const query = searchDestination(entry).split('?')[1];
    assert.equal(isCloudSettingsQuery(query), true, id);
    assert.equal(new URLSearchParams(query).get('focus'), id);
    // Bookmarks from before migration did not include a tab.
    assert.equal(isCloudSettingsQuery('focus=' + id), true, id);
  }
  assert.equal(isCloudSettingsQuery(''), false);
  assert.equal(isCloudSettingsQuery('focus=settings-master'), false);
  assert.equal(isCloudSettingsQuery('tab=cloud'), true);
  assert.equal(isCloudSettingsQuery('tab=invalid'), false);
  assert.deepEqual(resolveSettingsRoute('/settings', 'tab=cloud'), { path: '/cloud-services', query: '' });
  for (const path of ['/settings', '/cloud-services']) {
    assert.deepEqual(resolveSettingsRoute(path, 'tab=cloud&focus=settings-image-host'),
      { path: '/settings', query: 'focus=settings-image-host' });
  }
  assert.equal(SETTINGS_SEARCH_ENTRIES.find((entry) => entry.id === 'settings-image-host').path, '/settings');
});

test('cloud settings vocabulary and labels exist in all four languages', () => {
  const hans = JSON.parse(read('../src/i18n/locales/zh-Hans.json'));
  for (const lang of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
    const locale = JSON.parse(read('../src/i18n/locales/' + lang + '.json'));
    assert.deepEqual(Object.keys(locale.cloud).sort(), Object.keys(hans.cloud).sort());
    for (const text of Object.values(locale.cloud)) assert.ok(text.trim());
  }
  const cases = [
    ['settings-cloud-keys', ['密钥', 'bdc', 'key']],
    ['settings-cloudban', ['云黑名单', 'cloudban', '同步']],
    ['settings-cloud-cards', ['云人物卡', '云卡', '授权']],
    ['settings-heartbeat', ['心跳', '骰主', '上报']],
  ];
  for (const [id, queries] of cases) {
    const entry = SETTINGS_SEARCH_ENTRIES.find((item) => item.id === id);
    const lookup = (key) => key?.split('.').reduce((value, part) => value?.[part], hans) || '';
    const document = { title: lookup(entry.titleKey), description: lookup(entry.descriptionKey), page: lookup(entry.pageKey), keywords: entry.keywords };
    for (const query of queries) assert.ok(matchSettingsSearch(query, document), id + ': ' + query);
  }
});

test('cloud UI preserves adapter entry and original service endpoints', () => {
  const settings = read('../src/pages/settings-page.tsx');
  const cloudPanel = read('../src/pages/cloud-settings-page.tsx');
  for (const marker of ['<CloudKeysCard', '<CloudCardsCard', '<CloudBanCard', '<HeartbeatCard', 'settings-logsite']) {
    assert.ok(cloudPanel.includes(marker), marker);
  }
  assert.ok(settings.includes('<ImageHostCard'));
  assert.ok(!cloudPanel.includes('<ImageHostCard'));
  const sidebar = read('../src/components/layout/sidebar.tsx');
  const systemGroup = sidebar.slice(sidebar.indexOf("{ labelKey: 'nav.system'"), sidebar.indexOf("{ labelKey: 'nav.roadmap'"));
  for (const path of ['/settings', '/cloud-services', '/notice-settings']) assert.ok(systemGroup.includes("path: '" + path + "'"));
  assert.ok(read('../src/components/adapter/adapter-form.tsx').includes("register('heartApiKey')"));
  const keys = read('../src/components/settings/cloud-services.tsx');
  assert.ok(keys.includes('await updateAdapter(adapter.id, patch)'));
  assert.ok(!keys.includes('localStorage'));
  const ban = read('../src/pages/banlist-page.tsx');
  assert.ok(ban.includes('#/cloud-services?focus=settings-cloudban'));
  assert.ok(!ban.includes('/system/cloudban'));
  const cloudBan = read('../src/components/settings/cloud-ban-card.tsx');
  assert.ok(cloudBan.includes("'/system/cloudban'"));
  assert.ok(cloudBan.includes("'/system/cloudban/sync'"));
});
