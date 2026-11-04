import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';

// 设置 PWA_TEST_DIST=1 时，同一组检查也验证构建产物没有漏掉安装资源。
const root = new URL('../', import.meta.url);
const publicDir = new URL(process.env.PWA_TEST_DIST === '1' ? 'dist/' : 'public/', root);
const htmlFile = new URL(process.env.PWA_TEST_DIST === '1' ? 'dist/index.html' : 'index.html', root);
const manifest = JSON.parse(await readFile(new URL('manifest.json', publicDir), 'utf8'));

test('入口声明安装清单和 Apple 图标', async () => {
  const html = await readFile(htmlFile, 'utf8');
  assert.match(html, /<link rel="manifest" href="(?:%BASE_URL%|\.\/)manifest\.json"/);
  assert.match(html, /<link rel="apple-touch-icon" href="(?:%BASE_URL%|\.\/)icons\/apple-touch-icon\.png"/);
  assert.match(html, /name="theme-color"/);
});

test('应用以稳定身份从首页独立启动，不携带登录参数，并兼容反向代理前缀', () => {
  assert.ok(manifest.name);
  assert.ok(manifest.short_name);
  // Relative to manifest.json: "/" at the site root, "/prefix/" behind a reverse proxy.
  assert.equal(manifest.id, './');
  assert.equal(manifest.start_url, './#/');
  assert.equal(manifest.scope, './');
  for (const url of [manifest.id, manifest.start_url, manifest.scope]) {
    assert.equal(new URL(url, 'https://panel.test/manifest.json').href.startsWith('https://panel.test/'), true);
    assert.equal(new URL(url, 'https://panel.test/dice/manifest.json').href.startsWith('https://panel.test/dice/'), true);
  }
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.prefer_related_applications, false);
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192' && icon.purpose === 'any'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'any'));
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
});

test('所有应用图标均为本地 PNG 且尺寸与声明一致', async () => {
  for (const icon of [...manifest.icons, { src: 'icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]) {
    assert.match(icon.src, /^icons\/[a-z0-9-]+\.png$/);
    assert.equal(icon.type, 'image/png');
    const metadata = await sharp(await readFile(new URL(icon.src, publicDir))).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(`${metadata.width}x${metadata.height}`, icon.sizes);
  }
});

test('Service Worker 提供真实的导航处理以满足安装提示，但不缓存任何内容', async () => {
  const worker = await readFile(new URL('sw.js', publicDir), 'utf8');
  assert.match(worker, /addEventListener\('fetch'/);
  assert.match(worker, /respondWith\(fetch\(event\.request\)/);
  assert.match(worker, /request\.mode !== 'navigate'/);
  assert.doesNotMatch(worker, /caches\.|CacheStorage|\.put\(/);
});
