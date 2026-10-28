import { test, expect } from '@playwright/test';

for (const width of [1366, 390]) {
  for (const theme of ['light', 'dark']) {
    test('BDC SSO uses the official local icon in both UI bundles (' + width + 'px, ' + theme + ')', async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/api/auth/status', route => route.fulfill({ json: {
        code: 0, data: { required: true, authed: false, sso: [
          { id: 'bdc', kind: 'bdc', name: 'BDC', logo: 'https://example.invalid/old-bdc.svg' },
          { id: 'custom', kind: 'oidc', name: 'Custom SSO', logo: './favicon.svg' },
        ] },
      } }));
      const externalRequests = [];
      page.on('request', request => {
        if (new URL(request.url()).hostname !== '127.0.0.1') externalRequests.push(request.url());
      });
      for (const version of ['v1', 'v2']) {
        await page.goto('/' + version + '/#/');
        const button = page.getByRole('button', { name: '使用骰子之间账号登录', exact: true });
        await expect(button).toBeVisible();
        // Exercise both theme styles before the authenticated layout is mounted.
        await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme);
        expect(await page.locator('html').evaluate(el => el.classList.contains('dark'))).toBe(theme === 'dark');
        // The fixture is HTTP: changing the icon must not remove HTTPS-only SSO.
        await expect(button).toBeDisabled();
        const icon = button.locator('img');
        await expect(icon).toHaveAttribute('src', './icons/dicezone-account.svg');
        await expect(icon).toHaveAttribute('alt', '');
        await expect.poll(() => icon.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
        expect(await icon.evaluate(el => {
          const box = el.getBoundingClientRect(), parent = el.parentElement.getBoundingClientRect();
          return box.width === 16 && box.height === 16 && box.left >= parent.left && box.right <= parent.right;
        })).toBe(true);
        await expect(page.getByRole('button', { name: '使用Custom SSO登录', exact: true }).locator('img')).toHaveAttribute('src', './favicon.svg');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: 'test-results/webui-version/sso-' + version + '-' + width + '-' + theme + '.png' });
      }
      expect(externalRequests).toEqual([]);
    });
  }
}
test.beforeEach(async ({ page, request }) => {
  await request.post('/__version-test', { data: {} });
  await page.addInitScript(() => {
    localStorage.setItem('dice-lang', 'zh-Hans');
    localStorage.setItem('dice-next:tour-mode', 'veteran');
    localStorage.setItem('dice-app-store', JSON.stringify({ state: { sidebarCollapsed: true }, version: 0 }));
  });
});
for (const width of [1366, 390]) {
  test(`separate V1/V2 builds switch and retain route and shared preferences (${width}px)`, async ({ page, context, request }) => {
    await page.setViewportSize({ width, height: 900 });
    await context.addCookies([{ name: 'test-session', value: 'unchanged', url: 'http://127.0.0.1:43193' }]);
    const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/#/webui-settings?focus=webui-version');
    const card = page.locator('[data-setting-anchor="webui-version"]');
    await expect(card).toContainText('当前页面：V1');
    await card.getByRole('button', { name: /V2（预览版）/ }).click();
    await card.getByRole('button', { name: '保存并切换' }).click();
    await expect(page).toHaveURL(/\/v2\/#\/webui-settings\?focus=webui-version$/);
    await expect(card).toContainText('当前页面：V2（预览版）');
    await expect(page.locator('header')).not.toContainText('V2 预览版');
    await page.goto('/#/webui-settings');
    await expect(page).toHaveURL(/\/v2\/#\/webui-settings$/);
    await card.getByRole('button', { name: /^V1/ }).click();
    await card.getByRole('button', { name: '保存并切换' }).click();
    await expect(card).toContainText('当前页面：V1');
    expect((await request.get('/__version-test')).ok()).toBeTruthy();
    expect((await context.cookies()).find((cookie) => cookie.name === 'test-session')?.value).toBe('unchanged');
    expect(await page.evaluate(() => localStorage.getItem('dice-lang'))).toBe('zh-Hans');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    expect(await card.getByRole('button', { name: /^V1/ }).evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(40);
    await page.screenshot({ path: `test-results/webui-version/v1-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}
test('unavailable preview and restricted administrators cannot change version', async ({ page, request }) => {
  await request.post('/__version-test', { data: { selected: 'v2', available: false } });
  await page.goto('/#/webui-settings');
  const card = page.locator('[data-setting-anchor="webui-version"]');
  await expect(card.getByRole('button', { name: /V2（预览版）/ })).toBeDisabled();
  await expect(card).toContainText('已回退到可用界面');
  await request.post('/__version-test', { data: { readOnly: true } });
  await page.reload();
  await expect(card).toContainText('仅骰主可修改');
  await expect(card.getByRole('button', { name: '保存并切换' })).toBeDisabled();
});
test('failed save preserves page and server choice', async ({ page, request }) => {
  await request.post('/__version-test', { data: { failSave: true } });
  await page.goto('/#/webui-settings');
  const card = page.locator('[data-setting-anchor="webui-version"]');
  await card.getByRole('button', { name: /V2（预览版）/ }).click();
  await card.getByRole('button', { name: '保存并切换' }).click();
  await expect(page.getByText('无法保存 WebUI 版本', { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/v1\//);
  expect((await (await request.get('/__version-test')).json()).data.selected).toBe('v1');
});

test('each packaged UI loads its own local images under its version directory', async ({ page, request }) => {
  for (const version of ['v1', 'v2']) {
    await page.goto(`/${version}/#/`);
    const logo = page.locator('[data-tour="dashboard-server"] img').first();
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
    expect(await logo.getAttribute('src')).toMatch(/^\.\/os\//);
    expect((await request.get(`/${version}/favicon.svg`)).ok()).toBe(true);
  }
});
