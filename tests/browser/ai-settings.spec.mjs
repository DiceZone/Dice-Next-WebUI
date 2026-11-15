import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, info) => {
  await page.addInitScript((theme) => {
    localStorage.setItem('dice-lang', 'zh-Hans');
    localStorage.setItem('dice-next:tour-mode', 'veteran');
    localStorage.setItem('dice-app-store', JSON.stringify({ state: { sidebarCollapsed: true, theme }, version: 0 }));
  }, info.project.name === 'dark' ? 'dark' : 'light');
});

for (const [section, placeholder, keywords] of [
  ['chat', '如：骰娘, 在吗, 讲个笑话', (body) => body.chat.keywords],
  ['translate', '.lang 切换关键词，逗号分隔（如 de, german, 德语）', (body) => body.translate.langs[0].keywords],
  ['npc', '如 店家, 老板', (body) => body.npc.list[0].triggers],
]) {
  test(`AI ${section} keywords retain typed separators and save individual items`, async ({ page }) => {
    let written;
    const data = { enabled: true, chat: { enabled: true }, translate: { enabled: true, langs: [{ name: 'test', keywords: [] }] },
      npc: { enabled: true, list: [{ id: 'n1', name: 'test', triggers: [] }] } };
    await page.route('**/api/system/ai', route => {
      if (route.request().method() === 'PUT') written = route.request().postDataJSON();
      return route.fulfill({ json: { code: 0, data } });
    });
    await page.goto('/#/ai/' + section);
    const input = page.getByPlaceholder(placeholder, { exact: true });
    await input.fill('alpha'); await input.press('End'); await input.press(',');
    await expect(input).toHaveValue('alpha,');
    await page.keyboard.insertText('在吗'); await page.keyboard.insertText('，');
    await expect(input).toHaveValue('alpha,在吗，');
    await page.keyboard.insertText(' third ');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect.poll(() => written && keywords(written)).toEqual(['alpha', '在吗', 'third']);
  });
}

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

test('manual AI edits survive canceled navigation and failed saves while confirmed switches stay clean', async ({ page }) => {
  const data = { enabled: true, chat: { enabled: true, keywords: ['alpha'] } };
  let rejectManual = true;
  await page.route('**/api/system/ai', route => {
    if (route.request().method() === 'PUT') {
      const patch = route.request().postDataJSON();
      if (rejectManual && patch.chat?.keywords) return route.fulfill({ json: { code: 1, message: '模拟保存失败' } });
      Object.assign(data.chat, patch.chat);
    }
    return route.fulfill({ json: { code: 0, data } });
  });
  const go = path => page.evaluate(async destination => {
    const { navigatePanel } = await import('/src/lib/panel-navigation.ts');
    navigatePanel(destination);
  }, path);
  const input = page.getByPlaceholder('如：骰娘, 在吗, 讲个笑话');
  const dialog = page.getByRole('dialog', { name: '放弃未保存的修改？' });
  await page.goto('/#/ai/chat');
  await expect(input).toHaveValue('alpha');
  await input.fill('alpha,beta');
  await page.locator('[data-setting-anchor="ai-chat"] input[type=checkbox]').first().click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('模拟保存失败')).toBeVisible();
  await go('/ai/polish'); await dialog.getByRole('button', { name: '继续编辑' }).click();
  await expect(input).toHaveValue('alpha, beta');
  rejectManual = false;
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => data.chat.keywords).toEqual(['alpha','beta']);
  await page.locator('[data-setting-anchor="ai-chat"] input[type=checkbox]').first().click();
  await go('/ai/polish'); await expect(page.locator('[data-setting-anchor="ai-polish"]')).toBeVisible();
  await go('/ai/chat'); await expect(input).toHaveValue('alpha, beta');
  await input.fill('discard me');
  await go('/help'); await dialog.getByRole('button', { name: '放弃修改' }).click();
  await expect(page).toHaveURL(/#\/help$/);
  await expect(input).toHaveCount(0);
  await go('/ai/chat'); await expect(input).toHaveValue('alpha, beta');
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

test('model thinking and off-peak prices survive save; vision has its own budget', async ({ page }) => {
  const writes = [];
  const data = { enabled: true, providers: [{ id: 'p1', name: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', enabled: true }],
    models: [{ id: 'm1', name: 'DeepSeek Flash', provider_id: 'p1', model: 'deepseek-flash', kind: 'chat', vision: true, enabled: true, price_in: 0.3, price_out: 1.2, token_limit: 0, cost_limit: 0, used_tokens: 0, used_cost: 0 }],
    vision: { enabled: true } };
  await page.route('**/api/system/ai', route => {
    if (route.request().method() === 'PUT') {
      const patch = route.request().postDataJSON(); writes.push(patch);
      if (patch.models) data.models = patch.models;
      if (patch.vision) data.vision = { ...data.vision, ...patch.vision };
    }
    return route.fulfill({ json: { code: 0, data } });
  });
  await page.goto('/#/ai?focus=ai-models');
  // The model list is the second tab on wide screens and a select on mobile.
  const tabs = page.getByRole('tab', { name: '模型', exact: true });
  if (test.info().project.name !== 'mobile') await tabs.click();
  else { await page.getByRole('combobox', { name: '模型列表', exact: true }).click(); await page.getByRole('option', { name: '模型', exact: true }).click(); }
  await page.getByRole('button', { name: '编辑 DeepSeek Flash', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: '思考模式', exact: true }).click();
  await page.getByRole('option', { name: '关闭', exact: true }).click();
  await dialog.getByRole('spinbutton', { name: '单次输出额度（token，0 跟随用途）', exact: true }).fill('8192');
  await dialog.getByRole('switch', { name: '启用谷时价格', exact: true }).click();
  await dialog.getByRole('combobox', { name: '谷时开始', exact: true }).first().click();
  await page.getByRole('option', { name: '23', exact: true }).click();
  await dialog.getByRole('combobox', { name: '谷时结束', exact: true }).first().click();
  await page.getByRole('option', { name: '07', exact: true }).click();
  await dialog.getByLabel('谷时输入单价（USD / 百万 token）', { exact: true }).fill('0.15');
  await dialog.screenshot({ path: 'test-results/ai-model-options-' + test.info().project.name + '.png' });
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => writes.some((p) => p.models?.[0]?.thinking === 'disabled')).toBe(true);
  expect(data.models[0].max_tokens).toBe(8192);
  expect(data.models[0].off_peak).toMatchObject({ enabled: true, start: '23:00', end: '07:00', price_in: 0.15, utc_offset_minutes: 480 });
  await page.reload();
  await page.goto('/#/ai/chat');
  const vision = page.locator('[data-setting-anchor="ai-vision"]');
  await expect(vision.getByLabel('识图输出额度（token）', { exact: true })).toHaveValue('2048');
  await vision.getByLabel('识图输出额度（token）', { exact: true }).fill('4096');
  await vision.getByLabel('识图超时（秒）', { exact: true }).fill('120');
  await vision.getByRole('combobox', { name: '识图思考模式', exact: true }).click();
  await page.getByRole('option', { name: '开启', exact: true }).click();
  await expect.poll(() => data.vision.thinking).toBe('enabled');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => data.vision.max_tokens).toBe(4096);
  expect(data.vision.timeout_sec).toBe(120);
  await page.reload();
  await expect(vision.getByLabel('识图输出额度（token）', { exact: true })).toHaveValue('4096');
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
