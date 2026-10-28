import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync(new URL('../../src/routes/route-manifest.json', import.meta.url)));

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
  await expect(page.locator('[data-tour="dashboard-summary"] .v2-metric')).toHaveCount(3);
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
  await page.goto('/#/webui-settings?focus=webui-version');
  await expect(page.locator('[data-setting-anchor="webui-version"]')).toBeVisible();
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
