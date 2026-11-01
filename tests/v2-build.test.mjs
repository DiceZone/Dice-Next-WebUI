import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('vendored components retain full licenses in source and production builds', async () => {
  for (const name of ['Tremor-LICENSE.txt', 'shadcn-LICENSE.txt']) {
    const source = await readFile(new URL(`../THIRD_PARTY/${name}`, import.meta.url), 'utf8');
    assert.ok(source.includes('Copyright') || source.includes('copyright'));
    assert.ok(source.length > 1000);
    if (process.env.PWA_TEST_DIST === '1') {
      const built = await readFile(new URL(`../dist/licenses/${name}`, import.meta.url), 'utf8');
      assert.equal(built, source);
    }
  }
});

test('wordmark matches V1 Inter typography and only accents the exclamation mark', async () => {
  const brand = await readFile(new URL('../src/components/layout/brand-wordmark.tsx', import.meta.url), 'utf8');
  assert.match(brand, /role="img" aria-label="Dice!Next"/);
  assert.match(brand, /Dice<span className="text-primary">!<\/span>Next/);
  assert.match(brand, /className="v2-wordmark text-foreground"/);
  assert.doesNotMatch(brand, /<svg\b|https?:/);
  const entry = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(entry, /rajdhani|novecento|sora/i);
  assert.match(entry, /@fontsource\/inter\/700\.css/);
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(css, /--font-sans: 'Inter'/);
  assert.match(css, /\.v2-wordmark\s*\{[^}]*font-family: 'Inter'[^}]*font-size: 1\.125rem[^}]*font-weight: 700[^}]*letter-spacing: -0\.025em[^}]*line-height: 1\.75rem/);
});
