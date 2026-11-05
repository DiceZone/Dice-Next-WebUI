import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync(new URL('../../src/routes/route-manifest.json', import.meta.url)));

test('reason reply editor previews the inherited custom roll and can override it independently', async ({ page }) => {
  const previews = [];
  await page.route('**/api/commands?*', route => route.fulfill({ json: { code: 0, data: [{ cmd: 'r', title: '掷骰', category: '掷骰', sources: ['core'], example: '.r', desc: '掷骰', replies: [
    { key: 'dice.roll.result', default: 'DEFAULT {res}', override: '我的回复 {res}', format: 'plain', defaultFormat: 'plain', vars: [{ name: 'res', desc: '结果' }] },
    { key: 'dice.roll.result_reason', default: 'DEFAULT REASON {reason} {res}', override: null, format: 'plain', defaultFormat: 'plain', vars: [{ name: 'res', desc: '结果' }, { name: 'reason', desc: '理由' }] },
  ] }] } }));
  await page.route('**/api/templates/preview', route => { previews.push(route.request().postDataJSON()); return route.fulfill({ json: { code: 0, data: { templateVersion: 1, simulation: { version: 1, seed: 1, command: '.r d100 理由', family: '', grade: '', args: {}, facts: {}, unresolved: [], issues: [] }, preview: { text: '我的回复 D100=55', plain: '我的回复 D100=55', markdown: false, payload: null, actions: [] } } } }); });
  await page.route('**/api/templates/markdown-source', route => route.fulfill({ json: { code: 0, data: { value: '我的回复 {res}' } } }));
  await page.goto('/#/commands');
  await page.getByRole('button', { name: '编辑 (2)', exact: true }).click();
  await page.getByRole('button', { name: '编辑', exact: true }).nth(1).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('switch', { name: '单独设置此回复', exact: true })).not.toBeChecked();
  await expect(dialog.getByText(/当前继承：.*普通掷骰/)).toBeVisible();
  await expect.poll(() => previews.at(-1)?.variants?.[0]?.text).toBe('我的回复 {res}');
  await dialog.getByRole('switch', { name: '单独设置此回复', exact: true }).click();
  await expect(dialog.getByLabel('回复 1', { exact: true })).toHaveValue('我的回复 {res}');
});

test('expression engine priority follows drag and arrow order after saving and reloading', async ({ page }, info) => {
  let order = ['dicenext', 'onedice', 'dicescript'];
  await page.route('**/api/system/expression-engine*', async route => {
    if (route.request().method() === 'PUT') order = route.request().postDataJSON().values.expression_order;
    await route.fulfill({ json: { code: 0, data: { mode: 'custom', order, engines: order.map(id => ({ id, available: true })), overrides: {}, sources: {} } } });
  });
  await page.goto('/#/settings?focus=settings-expression');
  const list = page.getByTestId('expression-engine-order');
  const ids = () => list.locator('[data-engine-id]').evaluateAll(rows => rows.map(row => row.dataset.engineId));
  await expect(list.locator('[data-engine-id]')).toHaveCount(3);
  const one = list.locator('[data-engine-id="onedice"]');
  await one.getByRole('button', { name: '提高优先级', exact: true }).click();
  await expect.poll(ids).toEqual(['onedice', 'dicenext', 'dicescript']);
  const handle = one.getByRole('button', { name: /^拖动排序:/ });
  await handle.focus(); await page.keyboard.press('ArrowDown');
  await expect.poll(ids).toEqual(['dicenext', 'onedice', 'dicescript']);
  await list.scrollIntoViewIfNeeded();
  // Exercise actual pointer drag, including the narrow mobile layout.
  await expect(handle).toBeVisible();
  const from = await handle.boundingBox();
  const to = await list.locator('[data-engine-id="dicenext"]').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, to.y + 5, { steps: 18 });
  await page.mouse.up();
  await expect.poll(ids).toEqual(['onedice', 'dicenext', 'dicescript']);
  await page.locator('[data-setting-anchor="settings-expression"]').getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => order).toEqual(['onedice', 'dicenext', 'dicescript']);
  await page.reload();
  await expect.poll(ids).toEqual(order);
  expect(await list.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('engine-order.png'), fullPage: true });
});

test('official materials load images only on preview and upload, paginate and delete per account', async ({ page }, info) => {
  const calls = [], imageRequests = [];
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=', 'base64');
  await page.route('https://assets.example.test/**', route => { imageRequests.push(route.request().url()); return route.fulfill({ contentType: 'image/png', body: png }); });
  await page.route('**/api/adapters/*/qq-official-actions', async route => {
    const posted = route.request().postDataJSON(); calls.push(posted);
    const data = posted.action === 'qq_material_list' ? { images: [{ image_id: 'image-1', file_name: 'image.png', url: 'qqbot-media://image/v1/token', preview_url: 'https://assets.example.test/preview.png', expires_at: 1900000000 }], next_cursor: posted.params.cursor ? '' : 'page2', total: 2 }
      : posted.action === 'qq_material_upload' ? { image_id: 'new', url: 'qqbot-media://image/v1/new' } : {};
    await route.fulfill({ json: { code: 0, data } });
  });
  await page.goto('/#/qq-official?focus=qq-materials');
  const materials = page.locator('[data-setting-anchor="qq-materials"]');
  await materials.getByRole('button', { name: '刷新', exact: true }).click();
  await expect(materials.getByText('image.png', { exact: true })).toBeVisible();
  expect(imageRequests).toHaveLength(0);
  await materials.getByRole('button', { name: '预览图片', exact: true }).click();
  await expect(page.getByRole('dialog').locator('img')).toBeVisible();
  await expect.poll(() => imageRequests.length).toBe(1);
  await page.keyboard.press('Escape');
  await materials.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(materials.getByRole('button', { name: '下一页', exact: true })).toBeDisabled();
  expect(calls.some(call => call.params.cursor === 'page2')).toBe(true);
  await materials.getByLabel('上传图片', { exact: true }).setInputFiles({ name: 'upload.png', mimeType: 'image/png', buffer: png });
  await materials.locator('button').filter({ hasText: /^上传图片$/ }).click();
  await expect(materials.getByRole('status')).toContainText('图片上传成功');
  expect(calls.find(call => call.action === 'qq_material_upload').params.base64).toBe(png.toString('base64'));
  await materials.getByRole('button', { name: '删除', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确定', exact: true }).click();
  await expect.poll(() => calls.filter(call => call.action === 'qq_material_delete').length).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('qq-materials.png'), fullPage: true });
});

test('official picture composer validates inputs and sends the selected native card payload', async ({ page }, info) => {
  const calls = [];
  await page.route('**/api/adapters/*/qq-official-actions', async route => { calls.push(route.request().postDataJSON()); await route.fulfill({ json: { code: 0, data: { id: 'sent' } } }); });
  await page.goto('/#/qq-official?focus=qq-messages');
  const composer = page.locator('[data-setting-anchor="qq-messages"]');
  await composer.getByLabel('标题（1–50 字）').fill('调查员日报');
  await composer.getByLabel('描述（1–200 字）').fill('本周团务');
  await composer.getByLabel('跳转链接（HTTPS）').fill('http://example.test/news');
  await composer.getByLabel('图片链接（HTTPS）').fill('https://example.test/image.png');
  await composer.getByLabel('接收对象 OpenID').fill('group-openid');
  await expect(composer.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
  await composer.getByLabel('跳转链接（HTTPS）').fill('https://example.test/news');
  await composer.getByRole('button', { name: '发送', exact: true }).click();
  expect(calls.filter(call => call.action === 'qq_send_message')).toHaveLength(0);
  await page.getByRole('dialog').getByRole('button', { name: '确定', exact: true }).click();
  await expect(composer.getByRole('status')).toHaveText('平台已接受发送请求。');
  expect(calls.find(call => call.action === 'qq_send_message')).toMatchObject({ action: 'qq_send_message', params: { groupId: 'group-openid', body: { msg_type: 8, card: { type: 'tuwen', content: { title: '调查员日报', description: '本周团务', url: 'https://example.test/news', pic_url: 'https://example.test/image.png' } } } } });
  await composer.getByRole('combobox', { name: '类型', exact: true }).click();
  await page.getByRole('option', { name: 'Markdown', exact: true }).click();
  await composer.getByRole('button', { name: '插入 @全体成员', exact: true }).click();
  await expect(composer.getByLabel('Markdown', { exact: true })).toHaveValue('<qqbot-at-everyone />');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('qq-message-composer.png'), fullPage: true });
});

test('visual templates keep edited buttons and formulas after saving and reopening', async ({ page }, info) => {
  test.skip(!process.env.DICENEXT_UI_PREVIEW_RENDERER, 'Production template renderer required');
  const preset = '**{nick}** 掷骰\n> `{res}`\n[[action:再掷一次|.r]]';
  let saved = null;
  let previewRequests = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/templates/preview') previewRequests++; });
  await page.route('**/api/commands?*', route => route.fulfill({ json: { code: 0, data: [{
    cmd: 'r', title: '掷骰', category: '掷骰', sources: ['core'], example: '.r', desc: '掷骰', replies: [{
      key: 'dice.roll.result', default: preset, override: saved?.value ?? null, format: saved?.format ?? 'markdown', defaultFormat: 'markdown',
      vars: [{ name: 'res', desc: '结果' }], presetStyle: 'visual',
      presets: { visual: { value: preset, format: 'markdown' }, standard: { value: '{nick} {res}', format: 'plain' }, traditional: { value: '{nick} {res}', format: 'plain' } },
    }],
  }] } }));
  await page.route('**/api/templates', async route => {
    saved = route.request().postDataJSON();
    await route.fulfill({ json: { code: 0, data: null } });
  });
  await page.goto('/#/commands');
  await page.getByRole('button', { name: '编辑', exact: true }).first().click();
  let dialog = page.getByRole('dialog');
  // Narrow screens show one pane at a time; wide screens show editor and preview together.
  const narrow = (page.viewportSize()?.width ?? 1440) < 1024;
  const pane = async name => { if (narrow) await dialog.getByRole('tab', { name, exact: true }).click(); };
  await expect(dialog.getByLabel('按钮文字 1')).toHaveValue('再掷一次');
  await expect(dialog.getByTestId('markdown-toolbar')).toBeVisible();
  await dialog.getByRole('button', { name: '载入预设', exact: true }).click();
  await page.getByRole('menuitem', { name: '标准文案', exact: true }).click();
  await page.getByRole('dialog', { name: '载入预设', exact: true }).getByRole('button', { name: '确定', exact: true }).click();
  await expect(dialog.getByLabel('回复 1', { exact: true })).toHaveValue('{nick} {res}');
  await expect(dialog.getByLabel('按钮文字 1')).toHaveCount(0);
  await dialog.getByRole('button', { name: '载入预设', exact: true }).click();
  await page.getByRole('menuitem', { name: '高级视觉文案', exact: true }).click();
  await page.getByRole('dialog', { name: '载入预设', exact: true }).getByRole('button', { name: '确定', exact: true }).click();
  await expect(dialog.getByLabel('按钮文字 1')).toHaveValue('再掷一次');
  await dialog.getByLabel('回复 1', { exact: true }).fill('我的结果：' + preset);
  // Toolbar: select a word and make it bold; the source keeps the Markdown.
  const reply = dialog.getByLabel('回复 1', { exact: true });
  await reply.evaluate(el => el.setSelectionRange(0, 4));
  await dialog.getByRole('button', { name: '粗体', exact: true }).click();
  await expect(reply).toHaveValue('**我的结果**：' + preset);
  await dialog.getByLabel('按钮文字 1').fill('继续掷骰');
  await dialog.getByLabel('填入的指令 1').fill('/r 2d6');
  await dialog.getByRole('button', { name: '添加公式', exact: true }).click();
  await pane('预期回复示例');
  await expect(dialog.locator('[data-math-preview]')).toBeVisible();
  await expect(dialog.getByText('继续掷骰 · /r 2d6', { exact: true })).toBeVisible();
  // A settled editor must not repeatedly request previews without any edits.
  await page.waitForTimeout(500);
  const settledRequests = previewRequests;
  await page.waitForTimeout(1200);
  expect(previewRequests).toBe(settledRequests);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await pane('编辑');
  await dialog.getByLabel('TeX 公式 2').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('visual-template-editor.png'), fullPage: true });
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(saved.value).toContain('**我的结果**：');
  expect(saved.format).toBe('markdown');
  expect(saved.value).toContain('[[action:继续掷骰|/r 2d6]]');
  expect(saved.value).toContain('[[math:');
  await page.reload();
  await page.getByRole('button', { name: '编辑', exact: true }).first().click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('填入的指令 1')).toHaveValue('/r 2d6');
  await pane('预期回复示例');
  await expect(dialog.locator('[data-math-preview]')).toBeVisible();
});

test('a saved plain reply offers one-click Markdown and keeps its toolbar off until then', async ({ page }) => {
  let saved = null;
  await page.route('**/api/commands?*', route => route.fulfill({ json: { code: 0, data: [{
    cmd: 'r', title: '掷骰', category: '掷骰', sources: ['core'], example: '.r', desc: '掷骰', replies: [{
      key: 'dice.roll.result', default: '**{nick}** {res}', override: '{nick} 掷出 2*3 {res}', format: 'plain', defaultFormat: 'markdown',
      vars: [{ name: 'res', desc: '结果' }],
    }],
  }] } }));
  await page.route('**/api/templates/markdown-source', route => route.fulfill({ json: { code: 0, data: { value: '{nick} 掷出 2*3 {res}' } } }));
  // CI has no production renderer: a fixed preview keeps the editor saveable.
  await page.route('**/api/templates/preview', route => route.fulfill({ json: { code: 0, data: { templateVersion: 1,
    preview: { text: '测试玩家 掷出 2*3 D100=42', plain: '测试玩家 掷出 2*3 D100=42', markdown: true, payload: { msg_type: 2 }, actions: [] },
    markdown: '测试玩家 掷出 2*3 D100=42', onebot: '测试玩家 掷出 2*3 D100=42',
    simulation: { version: 1, seed: 1, command: '.r', family: '', grade: '', args: {}, facts: {}, unresolved: [], issues: [] } } } }));
  await page.route('**/api/templates', async route => { saved = route.request().postDataJSON(); await route.fulfill({ json: { code: 0, data: null } }); });
  await page.goto('/#/commands');
  await page.getByRole('button', { name: '编辑', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('plain-format-notice')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '粗体', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: '转为 Markdown', exact: true }).click();
  await expect(dialog.getByTestId('plain-format-notice')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '粗体', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(saved).toMatchObject({ format: 'markdown', value: '{nick} 掷出 2*3 {res}' });
});

test('migrated plain replies convert to Markdown in one step after a dry run', async ({ page }) => {
  const calls = [];
  await page.route('**/api/templates/convert-markdown', async route => {
    const body = route.request().postDataJSON();
    calls.push(body);
    await route.fulfill({ json: { code: 0, data: body.dryRun ? { total: 3, escaped: 1, converted: 0 } : { total: 3, escaped: 1, converted: 3 } } });
  });
  await page.goto('/#/commands');
  await page.locator('[data-tour="commands-toolbar"]').getByRole('button', { name: '更多操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '全部转为 Markdown', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: '全部转为 Markdown', exact: true });
  await expect(confirm).toContainText('3 条纯文本文案');
  await expect(confirm).toContainText('其中 1 条');
  await confirm.getByRole('button', { name: '全部转为 Markdown', exact: true }).click();
  await expect(page.getByText('已将 3 条文案转为 Markdown').first()).toBeVisible();
  expect(calls.map(call => call.dryRun)).toEqual([true, false]);
  expect(calls[0]).toMatchObject({ personaId: 0, locale: 'zh-Hans' });
});

test('official webhook warns on local HTTP access without blocking the editor', async ({ page }) => {
  await page.goto('/#/adapters');
  const card = page.getByTestId('adapter-card').first();
  await card.getByRole('button', { name: '更多操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '编辑', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#qqReceiveMode').click();
  await page.getByRole('option', { name: 'Webhook', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('公网 IP');
  await expect(dialog.getByRole('alert')).toContainText('TLS');
  await expect(dialog.getByRole('alert')).toContainText('WebSocket');
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await dialog.locator('#qqReceiveMode').click();
  await page.getByRole('option', { name: 'WebSocket', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
});

test('official SN presets and custom format persist with scoped overrides', async ({ page }) => {
  const global = { qq_sn_banner: 'small_red', qq_sn_template: '> {sn}', qq_sn_color: '#E5484D' };
  const scoped = {};
  const writes = [];
  await page.route('**/api/system/global**', async route => {
    const body = route.request().method() === 'PUT' ? route.request().postDataJSON() : null;
    const query = new URL(route.request().url()).searchParams;
    const scope = body?.scope || query.get('scope') || 'global';
    const target = body?.target || query.get('target') || '';
    const key = `${scope}:${target}`;
    const overrides = scope === 'global' ? global : (scoped[key] ??= {});
    if (body) {
      writes.push(body);
      Object.assign(overrides, body.values);
      for (const clear of body.clear || []) delete overrides[clear];
    }
    await route.fulfill({ json: { code: 0, data: {
      values: { message_format: 'standard', ...global, ...overrides },
      overrides: scope === 'global' ? {} : overrides,
    } } });
  });
  await page.goto('/#/settings?focus=settings-qq-sn');
  const card = page.locator('[data-setting-anchor="settings-qq-sn"]');
  await expect(card).toBeVisible();
  // Edit only after the page's scope requests settle: the card is re-keyed (and reloads its
  // values) when the page resolves its scope, and its fieldset stays disabled until loaded.
  const loaded = async () => {
    await page.waitForLoadState('networkidle');
    await expect(card.locator('fieldset').first()).toBeEnabled();
  };
  await loaded();
  const choose = async label => {
    await card.getByRole('combobox').click();
    await page.getByRole('option', { name: label, exact: true }).click();
  };
  await expect(card.getByRole('combobox')).toContainText('彩色文字');
  const picker = card.getByTestId('sn-color-picker');
  await picker.getByRole('button', { name: '#0090FF' }).click();
  await expect(card.getByTestId('sn-banner-preview').locator('p').first()).toHaveCSS('color', 'rgb(0, 144, 255)');
  await picker.getByRole('textbox', { name: '颜色值（#RRGGBB）' }).fill('#30a46c');
  await expect(card.getByTestId('sn-banner-preview').locator('p').first()).toHaveCSS('color', 'rgb(48, 164, 108)');
  // Chromium exposes EyeDropper, but headless has no screen to sample; the stub returns what it would.
  await page.addInitScript(() => { window.EyeDropper = class { open() { return Promise.resolve({ sRGBHex: '#6e56cf' }); } }; });
  await page.reload();
  await loaded();
  await picker.getByRole('button', { name: '取色器' }).click();
  await expect(picker.getByRole('textbox', { name: '颜色值（#RRGGBB）' })).toHaveValue('#6E56CF');
  await picker.getByRole('textbox', { name: '颜色值（#RRGGBB）' }).fill('#30a46c');
  await choose('引用');
  await expect(card.getByTestId('sn-color-picker')).toHaveCount(0);
  await expect(card.locator('blockquote')).toContainText('SAN50');
  await choose('自定义格式');
  const input = card.getByRole('textbox');
  await input.fill('**{sn}**');
  await expect(card.getByTestId('sn-banner-preview').locator('strong')).toContainText('SAN50');
  await choose('普通文字');
  await choose('自定义格式');
  await expect(input).toHaveValue('**{sn}**');
  expect(writes).toHaveLength(0);
  await card.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].values.qq_sn_color).toBe('#30A46C');
  await page.reload();
  await loaded();
  await expect(input).toHaveValue('**{sn}**');
  await input.fill('没有变量');
  await expect(card.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
  await card.getByRole('button', { name: '插入公式示例' }).click();
  await expect(card.getByRole('math')).toBeVisible();
  const scope = page.locator('[data-setting-anchor="settings-scope"]');
  await scope.getByRole('button', { name: '分适配器', exact: true }).click();
  await scope.getByRole('combobox').click();
  await page.getByRole('option', { name: /QQ 官方/ }).click();
  await choose('关闭状态行');
  await card.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1]).toMatchObject({ scope: 'adapter', target: 'qq_official', values: { qq_sn_banner: 'off' } });
  await card.getByRole('button', { name: /恢复继承|恢复为继承|恢复上级/ }).click();
  await expect(card.getByRole('combobox')).toContainText('自定义格式');
  await expect(input).toHaveValue('**{sn}**');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('settings scope switches never duplicate reply or media cards', async ({ page }) => {
  const errors = [];
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  await page.goto('/#/settings?focus=settings-message-format');
  const scope = page.locator('[data-setting-anchor="settings-scope"]');
  const format = page.locator('[data-setting-anchor="settings-message-format"]');
  await expect(format).toBeVisible();
  for (let cycle = 0; cycle < 4; cycle++) {
    for (const name of ['分适配器', '分账号', '全局']) {
      await scope.getByRole('button', { name, exact: true }).click();
      await expect(scope.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(format).toHaveCount(1);
      await expect(page.locator('[data-setting-anchor="settings-bot-message"]')).toHaveCount(1);
    }
  }
  expect(errors.filter(text => /same key|Encountered two children/.test(text))).toEqual([]);
  await expect(format).toBeVisible();
});

test('server information loads visibly and keeps actual curve samples across navigation', async ({ page }) => {
  let release;
  const held = new Promise(done => { release = done; });
  let count = 0;
  const historyStart = Math.floor(Date.now() / 5000) * 5 - 3600;
  await page.route('**/api/system/sysinfo*', async route => {   // polls carry ?since=
    const response = await route.fetch();
    const body = await response.json();
    body.data.cpu_load = 20 + (++count);
    body.data.history = { interval: 5, window: 3600, samples: Array.from({ length: 720 }, (_, i) =>
      [historyStart + (i + count) * 5, (i % 30) * 3, 30 + i % 10]) };
    if (count === 1) await held;
    await route.fulfill({ json: body });
  });
  await page.goto('/#/');
  const server = page.locator('[data-tour="dashboard-server"]');
  await expect(server.getByRole('status')).toBeVisible();
  release();
  const curve = server.locator('svg[viewBox="0 0 100 20"] polyline').first();
  await expect.poll(async () => (await curve.getAttribute('points'))?.split(' ').length).toBe(120);
  await expect(server.locator('[title="最近 10 分钟的 CPU 与内存使用率，每 5 秒更新。"]')).toHaveCount(2);
  const oldPoints = await curve.getAttribute('points');
  await page.evaluate(() => { location.hash = '/settings'; });
  await expect(page.locator('[data-setting-anchor="settings-scope"]')).toBeVisible();
  await page.evaluate(() => { location.hash = '/'; });
  await expect(curve).toBeVisible();
  expect((await curve.getAttribute('points')).split(' ').length).toBeGreaterThanOrEqual(oldPoints.split(' ').length);
  await expect(server.getByRole('status')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('random source selection saves explicitly and survives a page reload', async ({ page }) => {
  let source = 'system', saves = 0;
  await page.route('**/api/system/random-source', async route => {
    if (route.request().method() === 'PUT') { source = route.request().postDataJSON().source; saves++; }
    await route.fulfill({ json: { code: 0, data: { source, active: source, fallbacks: 0, hardware_available: false } } });
  });
  // The retired /dice-rules URL redirects to the card's new home in basic settings.
  await page.goto('/#/dice-rules?focus=dice-random-source');
  await expect(page).toHaveURL(/#\/settings\?focus=dice-random-source/);
  const card = page.locator('[data-setting-anchor="dice-random-source"]');
  await expect(card.getByRole('combobox')).toContainText('操作系统安全随机');
  await card.getByRole('combobox').click();
  await page.getByRole('option', { name: 'OpenSSL 安全随机', exact: true }).click();
  expect(saves).toBe(0);
  await card.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => saves).toBe(1);
  await page.reload();
  await expect(card.getByRole('combobox')).toContainText('OpenSSL');
  await card.getByRole('combobox').click();
  await expect(page.getByRole('option', { name: /CPU 硬件熵源/ })).toBeDisabled();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('mobile top bar keeps theme, languages and page tour in the more menu', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/#/');
  await page.getByTestId('header-more').click();
  const wasDark = await page.locator('html').evaluate(el => el.classList.contains('dark'));
  await page.getByRole('menuitem', { name: '切换主题' }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  expect(await page.locator('html').evaluate(el => el.classList.contains('dark'))).toBe(!wasDark);
  await page.getByTestId('header-more').click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('dice-lang'))).toBe('en');
  await page.getByTestId('header-more').click();
  await expect(page.getByRole('menuitemradio', { name: 'English', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('menuitem', { name: 'Replay this page tour' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('wordmark matches V1 at 18px with only a purple exclamation mark', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/');
  await page.locator('aside').getByRole('button', { name: '展开或收起导航菜单' }).click();
  const brand = page.locator('aside .v2-wordmark');
  await expect(brand).toBeVisible();
  await expect(brand).toHaveRole('img');
  await expect(brand).toHaveAccessibleName('Dice!Next');
  await expect(brand).toHaveText('Dice!Next');
  expect(await brand.evaluate(async el => {
    const faces = await document.fonts.load('700 18px Inter', 'Dice!Next');
    const style = getComputedStyle(el);
    return { loaded: faces.length > 0, family: style.fontFamily.split(',')[0].replaceAll('"', '').trim(), size: style.fontSize, weight: style.fontWeight, style: style.fontStyle, spacing: style.letterSpacing, lineHeight: style.lineHeight };
  })).toEqual({ loaded: true, family: 'Inter', size: '18px', weight: '700', style: 'normal', spacing: '-0.45px', lineHeight: '28px' });
  expect(await brand.evaluate(el => {
    const style = getComputedStyle(el), punctuation = getComputedStyle(el.querySelector('span'));
    return { foreground: style.color === getComputedStyle(document.body).color, accented: punctuation.color !== style.color };
  })).toEqual({ foreground: true, accented: true });
  // The sidebar expands with a width transition; validate its settled layout.
  await expect.poll(() => brand.evaluate(el => {
    const box = el.getBoundingClientRect(), parent = el.parentElement.getBoundingClientRect();
    return getComputedStyle(el).transform === 'none' && box.left >= parent.left && box.right <= parent.right;
  })).toBe(true);
});

test('adapter cards flow into multiple columns while preserving details and edit actions', async ({ page }) => {
  for (const [width, columns] of [[1600, 3], [1100, 2], [390, 1]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/adapters');
    const cards = page.getByTestId('adapter-card');
    await expect(cards).toHaveCount(3);
    expect(await cards.evaluateAll(els => {
      const boxes = els.map(el => el.getBoundingClientRect());
      return boxes.filter(box => Math.abs(box.top - boxes[0].top) < 1).length;
    })).toBe(columns);
    expect(await cards.evaluateAll(els => els.every(el => {
      const card = el.getBoundingClientRect();
      return [...el.querySelectorAll('button')].every(button => {
        const box = button.getBoundingClientRect();
        return box.left >= card.left && box.right <= card.right && box.bottom <= card.bottom;
      });
    }))).toBe(true);
    await cards.first().getByRole('button', { name: '详情', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('preview');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await cards.first().getByRole('button', { name: '更多操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '编辑', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('first mobile visit never opens navigation over onboarding or persists mobile state', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.addInitScript(() => localStorage.setItem('dice-lang', 'zh-Hans'));
    await page.goto('http://127.0.0.1:43197/#/notice-settings');
    await page.getByRole('button', { name: /我用过 DiceNext/ }).click();
    await expect(page.locator('.v2-mobile-menu')).toHaveCount(0);
    await page.locator('#mobile-navigation-trigger').click();
    await expect(page.locator('.v2-mobile-menu')).toBeVisible();
    await page.reload();
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('.v2-mobile-menu')).toHaveCount(0);
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect(page.locator('aside')).toContainText('Dice!Next');
  } finally { await context.close(); }
});

test('settings pages use the full modern workspace width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of ['/settings', '/cloud-services', '/notice-settings', '/webui-settings', '/schedules', '/backup', '/about']) {
    await page.goto('/#' + route);
    await expect(page.locator('main h1')).toBeVisible();
    expect(await page.locator('.v2-workspace').evaluate(el =>
      Math.abs(el.getBoundingClientRect().width - el.firstElementChild.getBoundingClientRect().width))).toBeLessThan(2);
  }
});

test('dashboard keeps separate metrics and server/actions left of internally scrolling logs', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/#/');
  await page.evaluate(() => localStorage.setItem('dice-next:dashboard-shortcuts', JSON.stringify(['/playground', '/replies', '/settings', '/help', '/decks', '/groups'])));
  await page.reload();
  await expect(page.locator('[data-tour="dashboard-server"] img')).toBeVisible();
  await expect(page.locator('[data-tour="dashboard-summary"] .v2-metric')).toHaveCount(6);
  await expect(page.getByTestId('dashboard-shortcuts').getByRole('button')).toHaveCount(6);
  expect(await page.locator('main').evaluate(main => {
    const server = main.querySelector('[data-tour="dashboard-server"]').getBoundingClientRect();
    const actions = main.querySelector('[data-setting-anchor="dashboard-shortcuts"]').getBoundingClientRect();
    const logs = main.querySelector('[data-tour="dashboard-logs"]').getBoundingClientRect();
    return server.right < logs.left && actions.top > server.bottom && main.scrollHeight <= main.clientHeight + 2;
  })).toBe(true);
});

test('mobile menu is full-width, two-column and keyboard accessible with enter/exit animation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/settings');
  const trigger = page.locator('#mobile-navigation-trigger');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger.locator('svg.lucide-chevron-down')).toBeVisible();
  await page.locator('#mobile-navigation-trigger').click();
  const menu = page.getByRole('dialog');
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(await menu.evaluate(el => ({ width: el.getBoundingClientRect().width, animation: getComputedStyle(el).animationName })))
    .toEqual({ width: 390, animation: 'v2-menu-enter' });
  await expect(menu.getByRole('button', { name: '基础设置', exact: true })).toHaveAttribute('aria-current', 'page');
  expect(await menu.locator('section').first().locator('button').evaluateAll(buttons => {
    const a = buttons[0].getBoundingClientRect(), b = buttons[1].getBoundingClientRect();
    return a.top === b.top && a.right < b.left;
  })).toBe(true);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#mobile-navigation-trigger')).toBeFocused();
  await page.locator('#mobile-navigation-trigger').click();
  await menu.getByRole('button', { name: '通知设置', exact: true }).click();
  await expect(page).toHaveURL(/#\/notice-settings$/);
  await expect(menu).toHaveCount(0);
});

test('dialog enters from above without moving horizontally; reduced motion is honored', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('button', { name: '自定义常用操作', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el => {
    const animation = el.getAnimations().find(value => value.effect instanceof KeyframeEffect);
    return { name: getComputedStyle(el).animationName,
      horizontalShift: animation?.effect.getKeyframes().some(frame => /translateX|translate\(/.test(frame.transform || '')) ?? false };
  })).toEqual({ name: 'v2-dialog-enter', horizontalShift: false });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '自定义常用操作', exact: true }).click();
  expect(await page.getByRole('dialog').evaluate(el => parseFloat(getComputedStyle(el).animationDuration))).toBeLessThan(0.001);
});

test('cleanup settings separate retention from platform actions and persist group inactivity', async ({ page }) => {
  let settings = { days: 0, groupDays: 0, userRecordDays: 0, groupRecordDays: 0, groupLimit: 20, maxGroupSize: 0 }, saves = 0;
  await page.route('**/api/system/friend-clean', async route => {
    if (route.request().method() === 'PUT') { settings = route.request().postDataJSON(); saves++; }
    await route.fulfill({ json: { code: 0, data: settings } });
  });
  await page.goto('/#/settings?tab=advanced&focus=settings-friend-clean');
  const card = page.locator('[data-setting-anchor="settings-friend-clean"]');
  await expect(card.getByText('本地记录保留', { exact: true })).toBeVisible();
  await expect(card.getByText('平台清理操作', { exact: true })).toBeVisible();
  await card.locator('#cleanup-groupDays').fill('45');
  await card.locator('#cleanup-userRecordDays').fill('180');
  await card.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => saves).toBe(1);
  await page.reload();
  await expect(card.locator('#cleanup-groupDays')).toHaveValue('45');
  await expect(card.locator('#cleanup-userRecordDays')).toHaveValue('180');
  await expect(card.locator('#cleanup-days')).toHaveValue('0');
});

test('dialog and editable inputs use a white light surface and retain a dark surface', async ({ page }, info) => {
  await page.goto('/#/replies');
  await page.getByRole('button', { name: '添加回复', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const input = dialog.locator('textarea').first();
  await expect(input).toBeEditable();
  const surfaces = await dialog.evaluate(el => [getComputedStyle(el).backgroundColor,
    getComputedStyle(el.querySelector('textarea')).backgroundColor]);
  if (info.project.name === 'dark') {
    expect(surfaces[0]).not.toBe('rgb(255, 255, 255)');
    expect(surfaces[1]).toBe(surfaces[0]);
  } else expect(surfaces).toEqual(['rgb(255, 255, 255)', 'rgb(255, 255, 255)']);
});
test.beforeEach(async ({ page }, info) => {
  await page.addInitScript((theme) => {
    localStorage.setItem('dice-lang', 'zh-Hans');
    localStorage.setItem('dice-next:tour-mode', 'veteran');
    localStorage.setItem('dice-app-store', JSON.stringify({ state: { sidebarCollapsed: true, theme }, version: 0 }));
  }, info.project.name === 'dark' ? 'dark' : 'light');
});
for (const route of manifest.filter((entry) => entry.path !== '/banlist')) {
  test(`page ${route.path} remains usable`, async ({ page }, info) => {
    const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/#' + route.path);
    if (route.path === '/playground') await expect(page.locator('[data-tour="playground-composer"]')).toBeVisible();
    else {
      await expect(page.locator('main h1').first()).toBeVisible();
      await expect(page.locator('main h1').first()).not.toHaveText('');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await expect(page.locator('header [aria-label="V2 预览版"]')).toHaveCount(0);
    if (route.path === '/') {
      await expect(page.locator('[data-tour="dashboard-server"]')).not.toBeEmpty();
      await expect(page.locator('main').getByRole('button', { name: '平台连接', exact: true })).toHaveCount(0);
    }
    if (['/', '/statistics', '/notice-settings', '/replies'].includes(route.path))
      await page.screenshot({ path: `test-results/v2/${info.project.name}-${route.file}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}
test('statistics preserves all dates, online history and both active rankings', async ({ page, request }) => {
  const payload = await (await request.get('/api/statistics/overview?days=7&granularity=1h')).json();
  await page.goto('/#/statistics');
  const chart = page.getByTestId('v2-daily-trend');
  await expect(chart.locator('.recharts-xAxis .recharts-cartesian-axis-tick-value')).toHaveCount(payload.data.daily_usage.length);
  expect(await chart.locator('.recharts-cartesian-axis-tick-value').evaluateAll((labels) => labels.every((label) => {
    const bounds = label.getBoundingClientRect(), svg = label.closest('svg').getBoundingClientRect();
    return bounds.left >= svg.left && bounds.right <= svg.right;
  }))).toBe(true);
  await expect(page.locator('[data-setting-anchor="statistics-online"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: /最常使用的玩家|活跃用户/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /活跃群组/ })).toBeVisible();
});

test('compact header keeps navigation, search and account controls separate', async ({ page }) => {
  for (const width of [320, 360, 640, 768]) {
    await page.setViewportSize({ width, height: 760 });
    await page.goto('/#/');
    const header = page.locator('header');
    await expect(page.locator('aside')).toBeHidden();
    await expect(header.locator('[aria-label="V2 预览版"]')).toHaveCount(0);
    const logo = header.getByTestId('header-logo');
    await expect(logo).toBeVisible();
    const trigger = header.locator('#mobile-navigation-trigger');
    await expect(trigger.locator('svg.lucide-chevron-down')).toBeVisible();
    expect(await trigger.evaluate(el => {
      const logo = document.querySelector('[data-testid="header-logo"]').getBoundingClientRect();
      return el.getBoundingClientRect().left >= logo.right;
    })).toBe(true);
    expect(await logo.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
    expect(await header.evaluate((element) => {
      const buttons = [...element.querySelectorAll('button')].filter(button => button.getClientRects().length).map(button => button.getBoundingClientRect());
      const center = buttons[0].top + buttons[0].height / 2;
      return element.getBoundingClientRect().height <= 64 && buttons.every((a, i) =>
        Math.abs(a.top + a.height / 2 - center) < 2 && a.left >= 0 && a.right <= innerWidth &&
        buttons.slice(i + 1).every(b => a.right <= b.left + 1 || b.right <= a.left + 1));
    })).toBe(true);
    const version = header.locator('[data-testid="header-version"]:visible span').first();
    await expect(version).toHaveText('beta-3.0.0(123)');
    expect(await version.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});
test('hash search links keep literal query values and Back works', async ({ page }) => {
  await page.goto('/#/settings?tab=cloud&focus=cloud-cards');
  await expect(page).toHaveURL(/#\/cloud-services/);
  await page.goto('/#/webui-settings?focus=webui-api-key');
  await expect(page.locator('[data-setting-anchor="webui-api-key"]')).toBeVisible();
  await page.goBack(); await expect(page).toHaveURL(/#\/cloud-services/);
});
test('browser Back does not discard a draft until its async guard approves', async ({ page }) => {
  await page.goto('/#/help');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(async () => { const { navigatePanel } = await import('/src/lib/panel-navigation.ts'); navigatePanel('/decks'); });
  await expect(page).toHaveURL(/#\/decks$/);
  await expect(page.locator('main h1')).toContainText('牌堆');
  await page.evaluate(async () => {
    const { registerNavigationGuard } = await import('/src/lib/navigation-guard.ts');
    window.removeTestGuard = registerNavigationGuard(() => new Promise((resolve) => { window.resolveTestGuard = resolve; }));
  });
  await page.evaluate(() => history.back());
  await expect.poll(() => page.evaluate(() => typeof window.resolveTestGuard)).toBe('function');
  await expect(page.locator('main h1')).toContainText('牌堆');
  await page.evaluate(() => window.resolveTestGuard(false));
  await expect(page).toHaveURL(/#\/decks$/);
  await page.evaluate(() => { window.resolveTestGuard = undefined; history.back(); });
  await expect.poll(() => page.evaluate(() => typeof window.resolveTestGuard)).toBe('function');
  await page.evaluate(() => window.resolveTestGuard(true));
  await expect(page).toHaveURL(/#\/help$/);
  await expect(page.locator('main h1')).not.toContainText('牌堆');
});

test('expanded navigation uses color without an inset rail and exposes the active settings group', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/settings');
  await page.locator('aside').getByRole('button', { name: '展开或收起导航菜单' }).click();
  const active = page.locator('aside [aria-current="page"]');
  await expect(active).toHaveText('基础设置');
  await expect(active).toBeVisible();
  expect(await active.evaluate((element) => ({ shadow: getComputedStyle(element).boxShadow, border: getComputedStyle(element).borderLeftWidth })))
    .toEqual({ shadow: 'none', border: '0px' });
});

test('standalone panels and filter controls retain top padding across the tablet breakpoint', async ({ page }) => {
  for (const width of [390, 720, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/#/adapters');
    const content = page.locator('[data-tour="adapters-list"] .v2-card-content').first();
    await expect(content).toBeVisible();
    expect(await content.evaluate((element) => parseFloat(getComputedStyle(element).paddingTop))).toBeGreaterThanOrEqual(16);
    await page.goto('/#/statistics');
    const filters = page.locator('[data-tour="statistics-filters"]');
    await expect(filters).toBeVisible();
    expect(await filters.evaluate((element) => {
      const frame = element.getBoundingClientRect();
      return [...element.querySelectorAll('button')].every((button) => {
        const box = button.getBoundingClientRect();
        return box.top >= frame.top + 16 && box.left >= frame.left && box.right <= frame.right;
      });
    })).toBe(true);
  }
});

test('help library selection and editing work inside the new reading workspace', async ({ page }) => {
  await page.goto('/#/help');
  const catalog = page.getByRole('region', { name: '文档目录' });
  await expect(catalog).toBeVisible();
  await catalog.getByRole('button', { name: /跑团入门/ }).click();
  await expect(page.locator('article h2')).toHaveText('跑团入门');
  await page.locator('article').getByRole('button', { name: '编辑', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').locator('textarea')).not.toHaveValue('');
  await page.getByRole('dialog').getByRole('button', { name: '放弃', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('command categories and secondary actions remain reachable after the workspace redesign', async ({ page }) => {
  await page.goto('/#/commands');
  await expect(page.locator('main h1')).toContainText('指令');
  const tabs = page.locator('[data-tour="commands-filters"]');
  if (await tabs.getByRole('combobox').isVisible()) {
    await tabs.getByRole('combobox').click();
    await page.getByRole('option', { name: 'COC', exact: true }).click();
  } else await tabs.getByRole('tab', { name: 'COC', exact: true }).click();
  await expect(page.locator('[data-tour="commands-list"]')).toContainText('.ra');
  await page.locator('[data-tour="commands-toolbar"]').getByRole('button', { name: '更多操作' }).click();
  await page.getByRole('menuitem', { name: '人格管理' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
