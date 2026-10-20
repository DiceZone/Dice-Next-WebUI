import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const locales = Object.fromEntries(['zh-Hans', 'zh-Hant', 'en', 'ja'].map(lang => [lang,
  JSON.parse(readFileSync(new URL(`../src/i18n/locales/${lang}.json`, import.meta.url), 'utf8'))]));
const compiled = await build({
  stdin: { resolveDir: fileURLToPath(new URL('../', import.meta.url)), contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { I18nextProvider } from 'react-i18next';
    import { createInstance } from 'i18next';
    import { ServerInfo } from './src/components/dashboard/server-info';
    import { setSample } from './src/components/onboarding/tour-data';
    export { tourSamples } from './src/lib/tour-samples';
    export function render(sample, lang, locale) {
      setSample(sample);
      const i18n = createInstance();
      i18n.init({ lng: lang, initImmediate: false, interpolation: { escapeValue: false }, resources: { [lang]: { translation: locale } } });
      return renderToStaticMarkup(React.createElement(I18nextProvider, { i18n }, React.createElement(ServerInfo)));
    }
  ` },
  alias: { '@': fileURLToPath(new URL('../src/', import.meta.url)) },
  bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'isolated-server-info', setup(build) {
    build.onLoad({ filter: /[\\/]tour-data\.tsx$/ }, () => ({ loader: 'js', contents: `
      let sample;
      export function setSample(value) { sample = value; }
      export function useTourState() { return [sample, () => {}]; }
      export function useTourValue(value) { return value; }
      export function useTourActive() { return false; }
    ` }));
  } }],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const ui = module.exports;
const render = (sample, lang = 'zh-Hans') => ui.render(sample, lang, locales[lang]);

test('dashboard shows one data filesystem, the actual path and its whole-volume usage', () => {
  const sample = structuredClone(ui.tourSamples.system);
  sample.disks[0].mount = '/srv/dice-data';
  sample.disks[0].path = '/srv/dice-data/骰娘/dice.db';
  const html = render(sample);
  assert.equal((html.match(/data-disk-path=/g) || []).length, 1);
  assert.ok(html.includes('数据所在分区'));
  assert.ok(html.includes('数据位置：/srv/dice-data/骰娘/dice.db'));
  assert.ok(html.includes('16 / 80 GB · 20%'));
  assert.ok(html.includes('title="/srv/dice-data/骰娘/dice.db"'));
  assert.ok(!html.includes('/etc/hosts'));
});

test('failed data-volume lookup is explicitly unavailable rather than a fabricated zero or root disk', () => {
  const sample = structuredClone(ui.tourSamples.system);
  sample.disks = [];
  const html = render(sample);
  assert.ok(html.includes(locales['zh-Hans'].dashboard.disk_unavailable));
  assert.ok(!html.includes('data-disk-path='));
  assert.ok(!html.includes('0 / 0 GB'));
});

test('Windows and macOS volume/path labels are not rewritten or treated as Linux roots', () => {
  for (const [mount, path] of [
    ['E:\\', 'E:\\Dice!Next\\data\\dice.db'],
    ['/Volumes/Dice Data', '/Volumes/Dice Data/Next/data/dice.db'],
  ]) {
    const sample = structuredClone(ui.tourSamples.system);
    Object.assign(sample.disks[0], { mount, path });
    const html = render(sample, 'en');
    assert.ok(html.includes(mount));
    assert.ok(html.includes('Data location: ' + path));
  }
});

test('older backend snapshots without path remain readable; the frontend does not pick an arbitrary first drive', () => {
  const sample = structuredClone(ui.tourSamples.system);
  delete sample.disks[0].path;
  const legacy = render(sample);
  assert.ok(!legacy.includes('数据位置：'));
  assert.ok(!legacy.includes('undefined'));
  sample.disks.push({ ...sample.disks[0], mount: '/another-volume' });
  assert.equal((render(sample).match(/data-disk-path=/g) || []).length, 2);
});

test('volume copy is available in all four languages and paths remain escaped text', () => {
  for (const lang of Object.keys(locales)) {
    for (const key of ['disk', 'disk_hint', 'disk_path', 'disk_unavailable'])
      assert.equal(typeof locales[lang].dashboard[key], 'string', lang + ':' + key);
    const sample = structuredClone(ui.tourSamples.system);
    sample.disks[0].path = '<img src=x onerror=alert(1)>';
    const html = render(sample, lang);
    assert.ok(html.includes(locales[lang].dashboard.disk));
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
  }
});
