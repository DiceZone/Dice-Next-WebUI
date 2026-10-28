import { test, expect } from '@playwright/test';
import { createMcpPreview } from '../mcp-preview.mjs';

const firstId = '1'.padStart(24, '0');
const fixtureToken = `dnmcp_${'f'.repeat(64)}`;
async function fixture(page, overrides = {}) {
  const preview = createMcpPreview();
  const requests = [];
  await page.route('**/api/system/mcp**', async (route) => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.slice(4), method = request.method();
    const body = request.postDataJSON() || {};
    requests.push({ method, path }); // Never retain token-bearing request bodies in diagnostics.
    const custom = await overrides.reply?.({ method, path, body, request });
    if (custom) return route.fulfill({ contentType: 'application/json', ...custom });
    const data = preview(method, path, url, body, request.headers()['x-dice-mcp-operation-id']);
    return route.fulfill({ json: { code: 0, data } });
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#/mcp');
  await page.getByRole('button', { name: /我用过 DiceNext/ }).click();
  if (page.viewportSize().width < 1024) await page.getByRole('navigation').getByRole('button', { name: 'MCP 服务', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'MCP 服务', exact: true })).toBeVisible();
  await expect(page.getByTestId(`mcp-grant-${firstId}`)).toBeVisible();
  return { requests, errors };
}

test('server-clock expiry, pagination and selected card summaries', async ({ page }) => {
  await page.addInitScript(() => {
    const RealDate = Date;
    globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2099-01-01T00:00:00Z'])); } static now() { return RealDate.parse('2099-01-01T00:00:00Z'); } };
  });
  const { errors } = await fixture(page);
  const first = page.getByTestId(`mcp-grant-${firstId}`);
  await expect(first.getByText('有效', { exact: true })).toBeVisible();
  await expect(first.getByText('7 天内到期', { exact: true })).toBeVisible();
  await expect(page.getByTestId(`mcp-grant-${'2'.padStart(24, '0')}`).getByText('已过期', { exact: true })).toBeVisible();
  const grants = page.locator('[data-setting-anchor="mcp-grants"]');
  await grants.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(grants.getByText('浏览器演示 11', { exact: true })).toBeVisible();
  await grants.getByRole('button', { name: '上一页', exact: true }).click();
  await first.getByRole('button', { name: '编辑授权' }).click();
  const dialog = page.getByRole('dialog', { name: '编辑授权' });
  await expect(dialog.getByText('#7 · 调查员·随春生')).toBeVisible();
  await expect(dialog.getByText('所属用户: 演示用户 A')).toBeVisible();
  await expect(dialog.getByText(/所属用户已变化/)).toBeVisible();
  await expect(dialog.getByText(/人物卡不存在或已锁定读取/)).toBeVisible();
  // Measure after the intentional opening animation, not during its zoom.
  await dialog.evaluate(async (element) => { await Promise.all(element.getAnimations().map((animation) => animation.finished)); });
  const before = await dialog.boundingBox();
  await dialog.getByLabel('应用／授权使用人标签').pressSequentially(' — browser typing regression');
  await dialog.getByLabel('授权人物卡', { exact: true }).fill('没有匹配的卡');
  await expect(dialog.getByText('调查员·随春生', { exact: false }).first()).toBeVisible();
  const after = await dialog.boundingBox();
  expect(Math.abs(before.height - after.height)).toBeLessThan(2);
  expect(Math.abs(before.y - after.y)).toBeLessThan(2);
  expect(errors).toEqual([]);
});

test('local self-check displays scope, permissions and clears token after use', async ({ page }, testInfo) => {
  const { errors, requests } = await fixture(page);
  await page.getByRole('button', { name: '本机连接自检', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '本机连接自检' });
  await expect(dialog.getByText(/不验证公网域名/)).toBeVisible();
  await dialog.getByLabel('已有 MCP 凭据（可选）').fill(fixtureToken);
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: '掷骰', exact: true }).click();
  await dialog.getByRole('button', { name: '开始自检' }).click();
  await expect(dialog.getByText('此凭据未获准使用所选工具。')).toBeVisible();
  await expect(dialog.getByLabel('已有 MCP 凭据（可选）')).toHaveValue('');
  await expect(dialog).not.toContainText(fixtureToken);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(fixtureToken);
  expect(requests.filter((r) => r.method !== 'GET').map((r) => r.path)).toEqual(['/system/mcp/self-check']);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('local-self-check.png') });
});

test('one-time credential is displayed once, copyable and cleared on close', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { errors } = await fixture(page);
  await page.getByRole('button', { name: '创建凭据', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: '创建凭据', exact: true });
  await dialog.getByLabel('应用／授权使用人标签').fill('临时浏览器客户端');
  await dialog.getByRole('button', { name: '创建', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '保存 MCP 凭据', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('input')).toHaveValue(fixtureToken);
  await dialog.getByRole('button', { name: '复制', exact: true }).first().click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(fixtureToken);
  await dialog.getByRole('button', { name: '已保存，关闭' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(fixtureToken);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(fixtureToken);
  expect(errors).toEqual([]);
});

test('failed read-back keeps an uncertain write locked and never repeats the mutation', async ({ page }) => {
  let failRead = false, writes = 0;
  const { errors } = await fixture(page, { reply: ({ method, path }) => {
    if (path === '/system/mcp' && method === 'PUT') { ++writes; failRead = true; return { status: 503, json: { message: 'fixture lost response' } }; }
    if (path.includes('/operations/')) return { json: { code: 0, data: { state: 'succeeded', action: 'configure' } } };
    if (path === '/system/mcp' && method === 'GET' && failRead) return { status: 503, json: { message: 'fixture offline' } };
  } });
  await page.getByRole('switch', { name: '启用 MCP 服务', exact: true }).click();
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(page.getByRole('button', { name: '核对操作状态' })).toBeVisible();
  await page.getByRole('button', { name: '核对操作状态' }).click();
  await expect(page.getByRole('button', { name: '核对操作状态' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '保存设置', exact: true })).toBeDisabled();
  await expect(page.getByRole('switch', { name: '启用 MCP 服务', exact: true })).not.toBeChecked();
  expect(writes).toBe(1);
  failRead = false;
  await page.getByRole('button', { name: '核对操作状态' }).click();
  await expect(page.getByRole('button', { name: '保存设置', exact: true })).toBeEnabled();
  await expect(page.getByRole('switch', { name: '启用 MCP 服务', exact: true })).toBeChecked();
  expect(writes).toBe(1); expect(errors).toEqual([]);
});

test('successful rotation preserves known usage if the list refresh fails', async ({ page }) => {
  let rotated = false;
  const { errors, requests } = await fixture(page, { reply: ({ method, path }) => {
    if (path.endsWith('/rotate') && method === 'POST') {
      rotated = true;
      const epoch = Date.parse('2030-01-01T00:00:00Z') / 1000;
      return { json: { code: 0, data: { id: firstId, name: '轮换后的演示授权', enabled: true,
        tools: ['get_status', 'get_character_card'], card_ids: [7, 8, 99], created_at: epoch - 86400,
        expires_at: epoch + 2 * 86400, requires_rotation: false, token: fixtureToken } } };
    }
    if (path === '/system/mcp' && method === 'GET' && rotated) return { status: 503, json: { message: 'fixture read-back offline' } };
  } });
  const first = page.getByTestId(`mcp-grant-${firstId}`);
  const usage = await first.getByText(/^最近保留的成功调用:/).textContent();
  const expiry = await first.getByText(/^到期时间:/).textContent();
  await first.getByRole('button', { name: '更多操作' }).click();
  await page.getByRole('menuitem', { name: '重新生成凭据' }).click();
  await page.getByRole('dialog', { name: '重新生成此凭据？' }).getByRole('button', { name: '确定', exact: true }).click();
  const secret = page.getByRole('dialog', { name: '保存 MCP 凭据' });
  await expect(secret.locator('input')).toHaveValue(fixtureToken);
  await secret.getByRole('button', { name: '已保存，关闭' }).click();
  await expect(first.getByText('轮换后的演示授权')).toBeVisible();
  await expect(first.getByText(usage, { exact: true })).toBeVisible();
  await expect(first.getByText(expiry, { exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(fixtureToken);
  expect(requests.filter((row) => row.path.endsWith('/rotate'))).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('narrow-screen editor and server-filtered audit remain usable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { requests, errors } = await fixture(page);
  const audit = page.locator('[data-setting-anchor="mcp-audit"]');
  await audit.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(audit.getByText('第 2 / 2 页', { exact: false })).toBeVisible();
  await audit.getByRole('combobox').last().click();
  await page.getByRole('option', { name: '已拒绝', exact: true }).click();
  await expect(audit.getByText('共 13 条', { exact: false })).toBeVisible();
  await page.getByTestId(`mcp-grant-${firstId}`).getByRole('button', { name: '编辑授权' }).click();
  const dialog = page.getByRole('dialog', { name: '编辑授权' });
  await dialog.getByLabel('应用／授权使用人标签').fill('窄屏名称');
  await dialog.evaluate(async (element) => { await Promise.all(element.getAnimations().map((animation) => animation.finished)); });
  const bounds = await dialog.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  await expect(dialog.getByRole('button', { name: '保存设置', exact: true })).toBeVisible();
  expect(requests.some((r) => r.path === '/system/mcp/audit')).toBeTruthy();
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('narrow-editor.png') });
});
