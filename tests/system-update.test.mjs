import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { create } from 'zustand';
import { formatVersion, formatScheduledInstallAt, updateTimezoneLabel, isUpdateBusy } from '../.test-dist/lib/system-update.js';
import { apiClient, ApiError, ApiTimeoutError } from '../.test-dist/lib/api-client.js';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('scheduled updates display server time and use frontend time controls', () => {
  assert.equal(formatScheduledInstallAt(86400, 480), '1970-01-02 08:00 (UTC+08:00)');
  assert.equal(formatScheduledInstallAt(86400, -210), '1970-01-01 20:30 (UTC-03:30)');
  assert.equal(formatScheduledInstallAt(0, 480), '—');
  assert.equal(updateTimezoneLabel(345), 'UTC+05:45');
  assert.equal(isUpdateBusy('scheduled'), false);
  const page = read('src/pages/about-page.tsx');
  assert.ok(page.includes("updateDraft.installTime ?? '04:00'"));
  assert.ok(page.includes('!updateStatus?.scheduledInstallSupported'));
  assert.ok(page.includes('<TimePicker'));
  const restartPage = read('src/pages/webui-settings-page.tsx');
  assert.ok(restartPage.includes('result.code !== 0'));
  assert.ok(restartPage.includes('settings.restart_update_hint'));
  for (const locale of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
    const about = JSON.parse(read(`src/i18n/locales/${locale}.json`)).about;
    for (const key of ['phase_scheduled', 'update_scheduled_install', 'update_install_time', 'update_install_timezone', 'update_scheduled_pending', 'update_schedule_unsupported']) assert.ok(about[key]);
    assert.ok(JSON.parse(read(`src/i18n/locales/${locale}.json`)).settings.restart_update_hint);
  }
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('the scheduling panel stays muted but help remains usable and timezone stays beside the time picker', () => {
  const page = read('src/pages/about-page.tsx');
  const expression = page.match(/const scheduleDisabled = ([\s\S]*?);/)[1];
  const disabled = (updateDraft, updateStatus = { scheduledInstallSupported: true }, working = '') => (
    vm.runInNewContext(expression, { updateDraft, updateStatus, working })
  );
  assert.equal(disabled({ autoCheck: true, autoAction: 'install' }), false);
  for (const action of ['notify', 'download']) assert.equal(disabled({ autoCheck: true, autoAction: action }), true);
  assert.equal(disabled({ autoCheck: false, autoAction: 'install' }), true);
  assert.equal(disabled(null), true);
  assert.equal(disabled({ autoCheck: true, autoAction: 'install' }, {}), true);
  assert.equal(disabled({ autoCheck: true, autoAction: 'install' }, { scheduledInstallSupported: true }, 'save'), true);
  const panel = page.slice(page.indexOf('data-setting-anchor="about-update-schedule"'), page.indexOf("<Label>{t('about.update_source')}</Label>"));
  assert.ok(panel.includes('aria-disabled={scheduleDisabled}'));
  assert.ok(panel.includes("scheduleDisabled ? ' bg-muted/40 opacity-50'"));
  assert.equal(panel.match(/disabled=\{scheduleDisabled\}/g).length, 3); // Group, switch and time picker.
  const help = panel.match(/<FeatureHelp[\s\S]*?\/>/)[0];
  for (const key of ['update_scheduled_install_desc', 'update_schedule_unsupported']) {
    assert.ok(help.includes(key));
    assert.equal(panel.split(key).length - 1, 1);
  }
  assert.ok(!help.includes('update_install_timezone'));
  assert.ok(panel.indexOf('update_install_timezone') > panel.indexOf('<TimePicker'));
  assert.equal(panel.split('update_install_timezone').length - 1, 1);
  assert.ok(panel.includes('updateTimezoneLabel(updateStatus?.timezoneMinutes ?? 0)'));
  const component = read('src/components/ui/feature-help.tsx');
  assert.ok(component.includes('type="button" aria-disabled={false}'));
  assert.ok(component.includes('<TooltipPortal>')); // Help is not dimmed/clipped with its disabled parent.
  for (const locale of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
    const copy = JSON.parse(read(`src/i18n/locales/${locale}.json`));
    assert.ok(copy.about.update_scheduled_install_help);
    assert.ok(copy.common.feature_help.includes('{{title}}'));
    for (const key of ['update_action_notify_desc', 'update_action_download_desc', 'update_action_install_desc', 'update_source_desc']) {
      assert.ok(copy.about[key], `${locale}: ${key}`);
    }
  }
  assert.equal(page.split('<FeatureHelp ').length - 1, 4);
  assert.ok(page.includes("<p className=\"text-xs text-muted-foreground\">{t('about.custom_mirror_desc')}</p>"));
});

function featureHelpHarness() {
  const js = ts.transpileModule(read('src/components/ui/feature-help.tsx'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {}, state = [];
  let hookIndex = 0;
  const jsx = (type, props) => ({ type, props });
  const components = (names) => Object.fromEntries(names.map((name) => [name, name]));
  vm.runInNewContext(js, { exports, require: (path) => {
    if (path === 'react') return { useRef: (initial) => {
      const index = hookIndex++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    }, useState: (initial) => {
      const index = hookIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = value; }];
    } };
    if (path === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (path === 'react-i18next') return { useTranslation: () => ({ t: (key, args) => (
      key === 'common.feature_help' ? `Help for ${args.title}` : 'Close'
    ) }) };
    if (path === 'lucide-react') return { HelpCircle: 'HelpCircle' };
    if (path === '@radix-ui/react-tooltip') return { Portal: 'TooltipPortal' };
    if (path === '@/components/ui/button') return { Button: 'Button' };
    if (path === '@/components/ui/dialog') return components([
      'Dialog', 'DialogClose', 'DialogContent', 'DialogDescription', 'DialogFooter',
      'DialogHeader', 'DialogTitle', 'DialogTrigger',
    ]);
    if (path === '@/components/ui/tooltip') return components(['Tooltip', 'TooltipContent', 'TooltipProvider', 'TooltipTrigger']);
    throw new Error('Unexpected dependency: ' + path);
  } });
  return (props) => { hookIndex = 0; return exports.FeatureHelp(props); };
}

const featureHelpNodes = (node) => {
  if (Array.isArray(node)) return node.flatMap(featureHelpNodes);
  if (!node || typeof node !== 'object' || !node.props) return [];
  return [node, ...featureHelpNodes(node.props.children)];
};

test('feature help shares hover and dialog details without leaving a tooltip over the open dialog', () => {
  const render = featureHelpHarness();
  const description = { type: 'p', props: { children: 'Download first, install later.' } };
  const props = { title: 'Scheduled installation', description };
  const find = (tree, type) => featureHelpNodes(tree).find((node) => node.type === type);
  let tree = render(props);
  assert.equal(tree.type, 'Dialog');
  assert.equal(tree.props.open, false);
  assert.equal(find(tree, 'Tooltip').props.open, false);
  assert.equal(find(tree, 'DialogTitle').props.children[1].props.children, props.title);
  assert.equal(find(tree, 'TooltipContent').props.children, description);
  assert.equal(find(tree, 'DialogDescription').props.children.props.children, description);
  find(tree, 'Tooltip').props.onOpenChange(true);
  tree = render(props);
  assert.equal(find(tree, 'Tooltip').props.open, true);
  tree.props.onOpenChange(true);
  tree = render(props);
  assert.equal(tree.props.open, true);
  assert.equal(find(tree, 'Tooltip').props.open, false);
  find(tree, 'Tooltip').props.onOpenChange(true);
  tree = render(props);
  assert.equal(find(tree, 'Tooltip').props.open, false);
  find(tree, 'Tooltip').props.onOpenChange(false);
  tree.props.onOpenChange(false);
  tree = render(props);
  assert.equal(tree.props.open, false);
  assert.equal(find(tree, 'Tooltip').props.open, false);
});

test('feature help uses a native accessible button and frontend dialog controls, even for unavailable settings', () => {
  const render = featureHelpHarness();
  let nodes = featureHelpNodes(render({ title: 'Download source', description: 'Source details' }));
  const trigger = nodes.find((node) => node.type === 'DialogTrigger');
  const button = trigger.props.children;
  assert.equal(trigger.props.asChild, true);
  assert.equal(button.type, 'button'); // Native clicks, Enter, Space and touch all activate the dialog trigger.
  assert.equal(button.props.type, 'button'); // Reading help never submits a settings form.
  assert.equal(button.props['aria-label'], 'Help for Download source');
  assert.equal(button.props['aria-disabled'], false);
  assert.equal(button.props.disabled, undefined);
  assert.equal(button.props['data-dialog-autofocus-skip'], '');
  assert.equal(button.props.tabIndex, undefined); // Still reachable by Tab; only automatic modal focus skips it.
  assert.equal(button.props.title, undefined); // Do not use browser-native tooltips.
  let stopped = 0;
  button.props.onClick({ stopPropagation: () => ++stopped, preventDefault: () => assert.fail('must allow the Radix dialog trigger') });
  assert.equal(stopped, 1); // Help must not select a card, sort a table or toggle its enclosing control.
  assert.ok(button.props.className.includes('focus-visible:ring-2'));
  assert.ok(button.props.className.includes('pointer-events-auto')); // Help remains readable in CSS-disabled feature groups.
  assert.equal(nodes.find((node) => node.type === 'HelpCircle').props['aria-hidden'], 'true');
  assert.equal(nodes.find((node) => node.type === 'TooltipTrigger').props.asChild, true);
  assert.equal(nodes.find((node) => node.type === 'DialogDescription').props.asChild, true);
  assert.equal(nodes.find((node) => node.type === 'DialogClose').props.children.type, 'Button');
  assert.equal(nodes.find((node) => node.type === 'Button').props.children, 'Close');
  assert.ok(nodes.find((node) => node.type === 'DialogContent').props.className.includes('overflow-y-auto'));
  nodes = featureHelpNodes(render({ title: 'Schedule', description: 'Details', ariaLabel: 'Schedule help' }));
  assert.equal(nodes.find((node) => node.type === 'button').props['aria-label'], 'Schedule help');
});

test('closing feature help restores focus without reopening its tooltip, while intentional keyboard focus still works', () => {
  const render = featureHelpHarness();
  const props = { title: 'Reply variables', description: 'Details' };
  const find = (tree, type) => featureHelpNodes(tree).find((node) => node.type === type);
  let tree = render(props);
  const button = find(tree, 'DialogTrigger').props.children;
  let focused = 0;
  button.props.ref.current = { focus: (options) => {
    assert.equal(options.preventScroll, true);
    focused++;
    let prevented = false;
    button.props.onFocus({ preventDefault: () => { prevented = true; } });
    // Radix TooltipTrigger only opens on focus if the consumer did not cancel it.
    if (!prevented) find(tree, 'Tooltip').props.onOpenChange(true);
  } };
  button.props.onFocus({ preventDefault: () => assert.fail('intentional keyboard focus must remain available') });
  tree.props.onOpenChange(true);
  tree = render(props);
  tree.props.onOpenChange(false);
  tree = render(props);
  let closePrevented = false;
  find(tree, 'DialogContent').props.onCloseAutoFocus({ preventDefault: () => { closePrevented = true; } });
  assert.equal(closePrevented, true);
  assert.equal(focused, 1);
  tree = render(props);
  assert.equal(find(tree, 'Tooltip').props.open, false);
  // This guard applies only during restoration, not to subsequent Tab or hover.
  button.props.onFocus({ preventDefault: () => assert.fail('focus guard must not stay set') });
  find(tree, 'Tooltip').props.onOpenChange(true);
  tree = render(props);
  assert.equal(find(tree, 'Tooltip').props.open, true);
});

test('feature help dialog places a decorative non-clickable question icon before the title', () => {
  const render = featureHelpHarness();
  const nodes = featureHelpNodes(render({ title: 'Scheduled installation', description: 'Details' }));
  const title = nodes.find((node) => node.type === 'DialogTitle');
  const [icon, text] = title.props.children;
  assert.equal(icon.type, 'HelpCircle');
  assert.equal(icon.props['aria-hidden'], 'true');
  assert.equal(icon.props.focusable, 'false');
  assert.equal(icon.props.onClick, undefined);
  assert.equal(icon.props.tabIndex, undefined);
  assert.equal(text.props.children, 'Scheduled installation');
  assert.ok(title.props.className.includes('flex items-center gap-2'));
  assert.equal(featureHelpNodes(title).filter((node) => node.type === 'button' || node.type === 'DialogTrigger').length, 0);
});

function updateStore(apiClient) {
  const js = ts.transpileModule(read('src/store/system-update-store.ts'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: (path) => {
    if (path === 'zustand') return { create };
    if (path === '@/lib/api-client') return { apiClient };
    throw new Error('Unexpected dependency: ' + path);
  } });
  return exports.useSystemUpdateStore;
}

test('version labels use the actual binary channel and build number, including legacy servers', () => {
  assert.equal(formatVersion({ version: '3.0.0', build: 123, prerelease: true }), 'beta-3.0.0(123)');
  assert.equal(formatVersion({ version: '3.0.0', build: 123, prerelease: false }), 'v3.0.0(123)');
  assert.equal(formatVersion({ version: '3.0.0', buildNumber: '007' }), 'beta-3.0.0(7)');
  assert.equal(formatVersion({ version: '3.0.0', build: 0, prerelease: false }), 'v3.0.0(0)');
  assert.equal(formatVersion({ version: '3.1.0', build: 4, tag: 'v3.1.0' }), 'v3.1.0(4)');
  assert.equal(formatVersion({ version: '3.1.0', build: 4, tag: 'v3.1.0-beta.4' }), 'beta-3.1.0(4)');
  assert.equal(formatVersion({ version: '3.0.0' }), 'beta-3.0.0(?)');
  assert.equal(formatVersion(null), '—');
});

test('connecting, verification, preparation and cancellation stay busy until the backend has finished', () => {
  for (const phase of ['checking', 'connecting', 'downloading', 'verifying', 'preparing', 'cancelling', 'installing']) {
    assert.equal(isUpdateBusy(phase), true, phase);
  }
  for (const phase of ['idle', 'available', 'error', 'cancelled', 'downloaded', 'staged', 'up_to_date']) {
    assert.equal(isUpdateBusy(phase), false, phase);
  }
});

test('shared polling is deduplicated and a late GET cannot undo an explicit action', async () => {
  const reply = deferred();
  let requests = 0;
  const store = updateStore({ get: () => { requests++; return reply.promise; } });
  const first = store.getState().refresh();
  const second = store.getState().refresh();
  assert.equal(requests, 1);
  const active = { current: { version: '3.0.0', build: 123 }, phase: 'connecting' };
  store.getState().accept(active);
  reply.resolve({ data: { current: { version: '3.0.0', build: 123 }, phase: 'available' } });
  assert.equal(await first, active);
  assert.equal(await second, active);
  assert.equal(store.getState().status.phase, 'connecting');
});

test('failed polling permits retry; fallback version cannot overwrite updater metadata', async () => {
  const fallback = deferred();
  let requests = 0;
  const status = { current: { version: '3.0.0', build: 123, prerelease: false }, phase: 'idle' };
  const store = updateStore({ get: (path) => {
    if (path === '/system/status') return fallback.promise;
    return ++requests === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ data: status });
  } });
  const load = store.getState().loadVersion();
  await assert.rejects(store.getState().refresh(), /offline/);
  await store.getState().refresh();
  fallback.resolve({ data: { version: 'old', buildNumber: 1 } });
  await load;
  assert.equal(store.getState().version, status.current);
});

test('reconciliation starts a fresh GET and an obsolete request cannot unlock or clear it', async () => {
  const old = deferred(), fresh = deferred();
  let requests = 0;
  const store = updateStore({ get: () => ++requests === 1 ? old.promise : fresh.promise });
  const obsolete = store.getState().refresh();
  store.getState().invalidate();
  const current = store.getState().refresh();
  old.resolve({ data: { current: { version: 'old' }, phase: 'available' } });
  await obsolete;
  assert.equal(store.getState().status, null);
  const duplicate = store.getState().refresh();
  assert.equal(requests, 2);
  const status = { current: { version: '3.0.0' }, phase: 'downloading' };
  fresh.resolve({ data: status });
  assert.equal(await current, status);
  assert.equal(await duplicate, status);
});

const withFetch = async (fetch, run) => {
  const previousFetch = globalThis.fetch;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  globalThis.fetch = fetch;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'test-key' } });
  try { await run(); } finally {
    globalThis.fetch = previousFetch;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  }
};

test('an update request timeout aborts HTTP waiting without pretending to cancel the server job', async () => {
  let aborted = false;
  await withFetch((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
  }), async () => {
    await assert.rejects(apiClient.post('/system/update/download', undefined, { timeoutMs: 20 }), ApiTimeoutError);
  });
  assert.equal(aborted, true);
});

test('HTTP timeout includes reading the response body', async () => {
  await withFetch(async (_url, options) => ({
    ok: true, headers: { get: () => 'application/json' },
    json: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('body aborted')));
    }),
  }), async () => {
    await assert.rejects(apiClient.get('/system/update', { timeoutMs: 20 }), ApiTimeoutError);
  });
});

test('normal API calls keep authentication and application errors without imposing a timeout', async () => {
  await withFetch(async (_url, options) => {
    assert.equal(options.headers['X-API-Key'], 'test-key');
    assert.equal(options.signal, undefined);
    return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ code: 7, message: 'denied' }) };
  }, async () => {
    await assert.rejects(apiClient.get('/replies'), (error) => error instanceof ApiError && error.code === 7);
  });
});

test('version entry replaces connection badge and sidebar placeholder, and uses the supplied safe New SVG', () => {
  const header = read('src/components/layout/header.tsx');
  assert.ok(!header.includes('apiOnline'));
  assert.ok(header.includes("onNavigate('/about?focus=about-update')"));
  assert.ok(header.includes('formatVersion(version)'));
  assert.ok(header.includes('updateStatus?.updateAvailable && <img src="/new.svg"'));
  const versionEntry = header.match(/<button\b[\s\S]*?<\/button>/)?.[0];
  assert.ok(versionEntry?.includes("onNavigate('/about?focus=about-update')"));
  assert.ok(versionEntry.includes('focus-visible:ring-2'));
  assert.ok(!/variant=|\bborder\b|\bbg-/.test(versionEntry));
  assert.ok(!read('src/components/layout/sidebar.tsx').includes('v3.0.0 — Dice!Next'));
  const svg = read('public/new.svg');
  assert.ok(svg.includes('fill="#EE502F"'));
  assert.ok(!/<script|href=|onload=|DOCTYPE/.test(svg));
});

test('update controls reconcile uncertain requests and never offer installation cancellation', () => {
  const about = read('src/pages/about-page.tsx');
  assert.ok(about.includes('setStatusUncertain(true);\n      invalidateStatus();\n      await loadUpdateStatus();'));
  assert.ok(about.includes('updateStatus?.cancelSupported && (updateStatus.canCancel'));
  assert.ok(about.includes("runAction('cancel')"));
  assert.ok(about.includes('isUpdateBusy(phase)'));
  for (const locale of ['en', 'ja', 'zh-Hans', 'zh-Hant']) {
    const copy = JSON.parse(read(`src/i18n/locales/${locale}.json`)).about;
    for (const key of ['version_open', 'version_new_available', 'update_cancel', 'update_request_timeout',
      'update_refresh_status', 'update_status_uncertain', 'phase_connecting', 'phase_verifying',
      'phase_preparing', 'phase_cancelling', 'phase_cancelled']) {
      assert.ok(copy[key], `${locale}: ${key}`);
    }
  }
});
