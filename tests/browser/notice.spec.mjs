import { test, expect } from '@playwright/test';
import { createNoticePreview } from '../notice-preview.mjs';

const samples = { adapters: [{ id: 'demo-adapter', type: 'onebot_v11', name: '主骰娘', loginId: '10001' }],
  groups: [{ platform: 'onebot_v11', groupId: 'new-group', name: '新窗口' }, { platform: 'onebot_v11', groupId: '933145117', name: '已配置群' }], players: [] };
async function fixture(page, options = {}) {
  const preview = createNoticePreview(samples), writes = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/system/notice/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.slice(4), method = req.method(), body = req.postDataJSON() || {};
    if (method !== 'GET') writes.push({ path, method, body });
    try {
      const data = preview(method, path, url, body);
      if (path.endsWith('/meta') && options.smtp === false) data.smtp_ready = false;
      return route.fulfill({ json: { code: 0, data } });
    } catch (e) { return route.fulfill({ status: 400, json: { code: 400, message: e.message } }); }
  });
  await page.goto('/#/notice-settings' + (options.query || ''));
  await page.getByRole('button', { name: /我用过 DiceNext/ }).click();
  if (page.viewportSize().width < 1024) await page.getByRole('navigation').getByRole('button', { name: '通知设置', exact: true }).click();
  await expect(page.getByRole('button', { name: '添加通知窗口', exact: true })).toBeEnabled();
  return { writes, errors };
}
async function open(page) { await page.getByRole('button', { name: '添加通知窗口', exact: true }).click(); return page.getByTestId('notice-editor'); }
async function select(page, element, name) { await element.click(); await page.getByRole('option', { name, exact: true }).click(); }
async function settled(dialog) { await dialog.evaluate(async el => { await Promise.all(el.getAnimations().map(a => a.finished)); }); }

test('one destination, multiple senders, independent sources and no third-party tab', async ({ page }) => {
  const { writes, errors } = await fixture(page);
  await expect(page.getByRole('tab', { name: '第三方推送' })).toHaveCount(0);
  await expect(page.getByTestId('notice-window').first()).toContainText('随春生');
  const dialog = await open(page);
  await expect(dialog.getByRole('button', { name: '选择此窗口 已配置群' })).toBeDisabled();
  await dialog.getByRole('button', { name: '选择此窗口 新窗口' }).click();
  await dialog.getByRole('checkbox', { name: /备用骰娘/ }).check();
  await select(page, dialog.locator('#notice-source-0'), '指定账号（可多选）');
  await dialog.getByTestId('notice-policy-0').getByRole('checkbox', { name: /主骰娘/ }).check();
  await select(page, dialog.locator('#notice-subscription-0'), '按通知级别');
  await dialog.getByRole('checkbox', { name: '例行通知', exact: true }).uncheck();
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toHaveLength(1);
  const value = writes[0].body;
  expect(value.channels).toBeUndefined(); expect(value.channel.chat_id).toBe('new-group');
  expect(value.channel.adapter_ids).toEqual(['demo-adapter', 'notice-demo-secondary']);
  expect(value.subscriptions[0].source.adapter_ids).toEqual(['demo-adapter']);
  expect(value.subscriptions[0].level_mask).toBe(14); expect(errors).toEqual([]);
});

test('historical source-event pairs remain separate when editing one window', async ({ page }) => {
  const { writes } = await fixture(page);
  await page.getByTestId('notice-window').nth(1).getByRole('button', { name: '编辑', exact: true }).click();
  const dialog = page.getByTestId('notice-editor');
  await expect(dialog.getByTestId('notice-policy-1')).toBeVisible();
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[0].body.subscriptions).toHaveLength(2);
  expect(writes[0].body.subscriptions[0].source.mode).toBe('all');
  expect(writes[0].body.subscriptions[1].source.adapter_ids).toEqual(['demo-adapter']);
  expect(writes[0].body.subscriptions[1].events).toEqual(['error']);
});

test('duplicate destination cannot be saved through manual entry and its draft stays open', async ({ page }) => {
  const { writes } = await fixture(page); const dialog = await open(page);
  await dialog.getByText('手动输入号码 / OpenID', { exact: true }).click();
  await dialog.getByLabel('手动输入号码 / OpenID').fill('933145117');
  await dialog.getByRole('button', { name: '选择', exact: true }).click();
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('该通知窗口已存在，请编辑已有窗口')).toBeVisible();
  await expect(dialog).toBeVisible(); expect(writes).toHaveLength(1);
});

test('search deep links open destination settings even when already on this page', async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { location.hash = '/notice-settings?tab=windows&focus=notice-smtp'; });
  let dialog = page.getByTestId('notice-editor'); await expect(dialog.getByLabel('收件人邮箱')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(() => { location.hash = '/notice-settings?tab=windows&focus=notice-webhook'; });
  dialog = page.getByTestId('notice-editor'); await expect(dialog.getByLabel('Webhook URL')).toBeVisible();
});

test('missing SMTP blocks saving and links to shared settings without losing the draft', async ({ page }) => {
  const { writes } = await fixture(page, { smtp: false }); const dialog = await open(page);
  await select(page, dialog.locator('#notice-kind'), '邮件');
  await expect(dialog.getByRole('alert')).toContainText('尚无可用 SMTP 配置');
  await expect(dialog.getByRole('link', { name: '配置 SMTP' })).toHaveAttribute('href', '#/settings?focus=settings-identity-email');
  await dialog.getByLabel('收件人邮箱').fill('owner@example.com');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog.getByLabel('收件人邮箱')).toHaveValue('owner@example.com'); expect(writes).toEqual([]);
});

test('Webhook presets, advanced JSON variables, validation and request preview', async ({ page }) => {
  const { writes, errors } = await fixture(page); const dialog = await open(page);
  await select(page, dialog.locator('#notice-kind'), 'Webhook');
  await dialog.getByRole('button', { name: '配置 Webhook' }).click(); await expect(dialog.getByLabel('Webhook URL')).toBeFocused();
  await dialog.getByLabel('Webhook URL').fill('https://example.com/fixture-hook');
  for (const preset of ['企业微信', '钉钉', '飞书']) {
    await select(page, dialog.locator('#notice-provider'), preset);
    await dialog.getByText('请求体示例（不发送）', { exact: true }).click();
    await expect(dialog.locator('pre')).toContainText('这是一条测试通知');
    await expect(dialog.locator('pre')).not.toContainText('{{message}}');
    await dialog.getByText('请求体示例（不发送）', { exact: true }).click();
  }
  await select(page, dialog.locator('#notice-provider'), '自定义请求');
  await dialog.getByLabel('请求体模板（JSON）').fill('{');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('有效 JSON'); expect(writes).toEqual([]);
  await dialog.getByLabel('请求体模板（JSON）').fill('{"text":"{{message}}","level":"{{level}}","user":"{{user_name}}"}');
  await dialog.getByLabel('请求头（JSON）').fill('{"X-Api-Key":"fixture-only"}');
  await select(page, dialog.locator('#notice-method'), 'PATCH');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[0].body.channel).toMatchObject({ kind: 'webhook', profile: 'custom', method: 'PATCH', headers: { 'X-Api-Key': 'fixture-only' }, body_template: { text: '{{message}}', level: '{{level}}' } });
  expect(errors).toEqual([]);
});

for (const width of [1366, 390]) test(`editor scrolls without clipped focus rings or typing resize at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 740 }); const { errors } = await fixture(page); const dialog = await open(page);
  await dialog.getByRole('button', { name: '选择此窗口 新窗口' }).click();
  await select(page, dialog.locator('#notice-subscription-0'), '按具体事件');
  await settled(dialog); const before = await dialog.boundingBox();
  await dialog.getByLabel('窗口名称（选填）').pressSequentially('窗口名称输入抖动回归测试'); const after = await dialog.boundingBox();
  expect(Math.abs(before.height - after.height)).toBeLessThan(2); expect(Math.abs(before.y - after.y)).toBeLessThan(2);
  const body = dialog.getByTestId('notice-editor-scroll');
  const layout = await body.evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth, pad: Number.parseFloat(getComputedStyle(el).paddingLeft), height: el.clientHeight, full: el.scrollHeight }));
  expect(layout.pad).toBeGreaterThanOrEqual(20); expect(layout.scroll).toBeLessThanOrEqual(layout.client + 1); expect(layout.full).toBeGreaterThan(layout.height);
  await body.hover(); await page.mouse.wheel(0, 1800); await expect.poll(() => body.evaluate(el => el.scrollTop)).toBeGreaterThan(20);
  await expect(dialog.getByRole('button', { name: '保存', exact: true })).toBeVisible(); expect(errors).toEqual([]);
  await body.evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: info.outputPath(`notice-editor-${width}.png`) });
});

test('audit rows stay fixed and headers horizontal; details retain the full message', async ({ page }, info) => {
  const full = '完整通知首行\n' + '多行长内容用于验证固定行高。'.repeat(100) + '\n通知结尾完整保留';
  await page.route('**/api/system/audit', route => route.fulfill({ json: { code: 0, data: { items: [full, '短内容'].map(msg => ({ ts: '2026-10-25 04:00:00', level: 8, op: 'error', origin: 'onebot_v11:933145116', msg })) } } }));
  await fixture(page); await page.getByRole('tab', { name: '审计日志' }).click();
  const table = page.getByTestId('notice-audit-table'); await expect(table.locator('tbody tr')).toHaveCount(2);
  const heights = await table.locator('tbody tr').evaluateAll(rows => rows.map(el => el.getBoundingClientRect().height));
  expect(Math.abs(heights[0] - heights[1])).toBeLessThan(1); expect(heights[0]).toBeLessThanOrEqual(49);
  expect(await table.locator('th').evaluateAll(heads => heads.every(el => getComputedStyle(el).whiteSpace === 'nowrap'))).toBe(true);
  await table.getByRole('button', { name: '查看通知详情' }).first().click();
  const detail = page.getByTestId('notice-audit-detail'); await expect(detail.locator('pre')).toHaveText(full);
  await page.screenshot({ path: info.outputPath('notice-audit-detail.png') });
});

test('narrow audit table scrolls horizontally without wrapping headers or stretching the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 }); await fixture(page);
  await page.getByRole('tab', { name: '审计日志' }).click(); const table = page.getByTestId('notice-audit-table');
  await expect(table.locator('th').first()).toBeVisible();
  const size = await table.evaluate(el => ({ table: el.scrollWidth, frame: el.parentElement.clientWidth, page: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(size.table).toBeGreaterThan(size.frame); expect(size.page).toBeLessThanOrEqual(size.viewport + 1);
  expect(await table.locator('th').evaluateAll(heads => heads.every(el => getComputedStyle(el).whiteSpace === 'nowrap'))).toBe(true);
});
