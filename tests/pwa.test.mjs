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
  assert.match(html, /<link rel="manifest" href="\/manifest\.json"/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png"/);
  assert.match(html, /name="theme-color"/);
});

test('应用以稳定身份从首页独立启动，不携带登录参数', () => {
  assert.ok(manifest.name);
  assert.ok(manifest.short_name);
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/#/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.prefer_related_applications, false);
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192' && icon.purpose === 'any'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'any'));
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
});

test('所有应用图标均为本地 PNG 且尺寸与声明一致', async () => {
  for (const icon of [...manifest.icons, { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]) {
    assert.match(icon.src, /^\/icons\/[a-z0-9-]+\.png$/);
    assert.equal(icon.type, 'image/png');
    const metadata = await sharp(await readFile(new URL(icon.src.slice(1), publicDir))).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(`${metadata.width}x${metadata.height}`, icon.sizes);
  }
});
