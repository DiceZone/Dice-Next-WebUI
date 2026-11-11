import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, info) => {
  await page.addInitScript((theme) => {
    localStorage.setItem('dice-lang', 'zh-Hans');
    localStorage.setItem('dice-next:tour-mode', 'veteran');
    localStorage.setItem('dice-app-store', JSON.stringify({ state: { sidebarCollapsed: true, theme }, version: 0 }));
  }, info.project.name === 'dark' ? 'dark' : 'light');
});

test('provider and model presets use dialogs and compact entries', async ({ page }, info) => {
  const tab = async (name) => {
    if (info.project.name === 'mobile') {
      await page.getByRole('combobox', { name: '模型列表', exact: true }).click();
      await page.getByRole('option', { name, exact: true }).click();
    } else await page.getByRole('tab', { name, exact: true }).click();
  };
  await page.route('**/api/system/ai', route => route.fulfill({ json: { code: 0, data: { enabled: true, providers: [], models: [] } } }));
  await page.goto('/#/ai');
  await page.getByRole('button', { name: '添加提供商', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: 'DeepSeek', exact: true }).click();
  await expect(dialog.locator('input').nth(0)).toHaveValue('DeepSeek');
  await expect(dialog.locator('input').nth(1)).toHaveValue('https://api.deepseek.com/v1');
  await dialog.locator('input[type=password]').fill('test-key');
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  await expect(page.getByRole('button', { name: '编辑 DeepSeek', exact: true })).toBeVisible();
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await tab('模型');
  await page.getByRole('button', { name: '添加模型', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'DeepSeek Flash', exact: true }).click();
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  await expect(page.getByRole('button', { name: '编辑 DeepSeek Flash', exact: true })).toBeVisible();
  await expect(page.getByText('输入 $0.3 / 输出 $1.2（每百万 token）')).toBeVisible();
  await tab('用途分配');
  await expect(page.locator('[data-setting-anchor="ai-usage-polish"]')).toHaveCount(0);
  await expect(page.locator('[data-setting-anchor="ai-usage-vision"]')).toBeVisible();
  await page.getByRole('button', { name: '高级用途设置', exact: true }).click();
  await expect(page.locator('[data-setting-anchor="ai-usage-polish"]')).toBeVisible();
});

test('feature switches save only the changed field and roll back on failure', async ({ page }) => {
  const writes = []; let fail = false;
  await page.route('**/api/system/ai', route => {
    if (route.request().method() === 'PUT') {
      writes.push(route.request().postDataJSON());
      return route.fulfill({ json: fail ? { code: 1, message: '保存失败' } : { code: 0, data: {} } });
    }
    return route.fulfill({ json: { code: 0, data: { enabled: true, polish: { enabled: false } } } });
  });
  await page.goto('/#/ai/polish');
  const toggle = page.locator('[data-setting-anchor="ai-polish"]').getByRole('switch');
  await toggle.click(); await expect(toggle).toBeChecked();
  expect(writes).toEqual([{ polish: { enabled: true } }]);
  fail = true; await toggle.click();
  await expect(page.getByText('保存失败', { exact: true })).toBeVisible();
  await expect(toggle).toBeChecked();
});

test('memory graph filters groups and edits or deletes the selected record only', async ({ page }, info) => {
  const writes = [];
  await page.route('**/api/system/ai', route => route.fulfill({ json: { code: 0, data: { enabled: true, memory: { short: { enabled: true } } } } }));
  await page.route('**/api/system/ai/memory**', route => {
    const req = route.request(); if (req.method() !== 'GET') writes.push({ method: req.method(), body: req.postDataJSON(), url: req.url() });
    return route.fulfill({ json: { code: 0, data: { items: [
      { id: 1, scope: 'group', scope_id: 'onebot:111', content: '第一群的记忆', updated_at: 1700000000, hits: 2 },
      { id: 2, scope: 'group', scope_id: 'onebot:222', content: '第二群的记忆', updated_at: 1700000000, hits: 0 },
    ] } } });
  });
  await page.goto('/#/ai/chat');
  await page.getByRole('button', { name: '查看', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '第一群的记忆', exact: true }).click();
  await page.screenshot({ path: `test-results/ai-memory-${info.project.name}.png` });
  await expect(dialog.getByRole('button', { name: '第二群的记忆' })).toHaveCount(0);
  await dialog.getByLabel('记忆内容', { exact: true }).fill('修改后的记忆');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '修改后的记忆', exact: true })).toBeVisible();
  expect(writes[0].body).toEqual({ id: 1, content: '修改后的记忆', previous_content: '第一群的记忆' });
  await dialog.getByRole('button', { name: '删除', exact: true }).click();
  await page.getByRole('dialog', { name: '删除这条记忆？', exact: true }).getByRole('button', { name: '删除', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '修改后的记忆', exact: true })).toHaveCount(0);
  expect(writes[1].url).toContain('?id=1');
});
