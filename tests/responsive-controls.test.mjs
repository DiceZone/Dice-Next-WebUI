import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import ts from 'typescript';

const read = (file) => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const transpile = (file) => ts.transpileModule(read(file), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const nodes = (node) => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== 'object' || !node.props) return [];
  return [node, ...nodes(node.props.children)];
};
const find = (tree, type) => nodes(tree).find((node) => node.type === type);

function controlsHarness(file) {
  const exports = {}, state = new Map(), resize = new Map();
  let slot = '', hookIndex = 0, selection = null;
  const tags = (names) => Object.fromEntries(names.map((name) => [name, name]));
  const jsx = (type, props, key) => React.createElement(type, { ...props, key });
  const mockReact = { ...React, forwardRef: (render) => render,
    useContext: () => selection,
    useState: (initial) => {
      const key = slot + hookIndex++;
      if (!state.has(key)) state.set(key, initial);
      return [state.get(key), (value) => state.set(key, value)];
    },
  };
  vm.runInNewContext(transpile(file), { exports, require: (path) => {
    if (path === 'react') return mockReact;
    if (path === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: React.Fragment };
    if (path === '@radix-ui/react-tabs') return { Root: 'TabsRoot', List: 'TabsList', Trigger: 'TabsTrigger', Content: 'TabsContent' };
    if (path === 'react-i18next') return { useTranslation: () => ({ t: (key) => key }) };
    if (path === 'lucide-react') return { ChevronDown: 'ChevronDown' };
    if (path === '@/components/ui/button') return { Button: 'Button' };
    if (path === '@/components/ui/select') return tags(['Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue']);
    if (path === '@/components/ui/dropdown-menu') return tags(['DropdownMenu', 'DropdownMenuContent', 'DropdownMenuItem', 'DropdownMenuTrigger']);
    if (path === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
    if (path === '@/hooks/use-close-on-wide-screen') return { useCloseOnWideScreen: (close) => resize.set(slot, close) };
    throw new Error('Unexpected dependency: ' + path);
  } });
  return {
    exports,
    render(name, props) {
      slot = name; hookIndex = 0;
      const tree = exports[name](props, null);
      if (name === 'Tabs') selection = tree.props.value;
      return tree;
    },
    resize: (name) => resize.get(name)?.(),
  };
}

function options(harness) {
  const trigger = (value, label, disabled = false) => React.createElement(harness.exports.TabsTrigger, { value, disabled }, label);
  return [trigger('a', 'First'), React.createElement(React.Fragment, { key: 'extra' },
    trigger('b', [React.createElement('svg', { key: 'icon' }), 'Second (7)']), null, trigger('c', 'Disabled', true)),
    false, trigger('d', 'Fourth')];
}

test('dense tab lists use a frontend select with the exact visible labels, counts, icons and disabled states', () => {
  const harness = controlsHarness('src/components/ui/tabs.tsx');
  harness.render('Tabs', { value: 'b' });
  const tree = harness.render('TabsList', { children: options(harness), variant: 'page', 'aria-label': 'Game tabs', 'data-tour': 'dense-tabs', className: 'sticky top-0' });
  assert.equal(tree.props['data-tour'], 'dense-tabs'); // One visible tutorial anchor, not a hidden tab bar.
  assert.ok(tree.props.className.includes('sticky top-0'));
  assert.equal(find(tree, 'Select').props.value, 'b');
  assert.equal(find(tree, 'SelectTrigger').props['aria-label'], 'Game tabs');
  const items = nodes(tree).filter((node) => node.type === 'SelectItem');
  assert.deepEqual(items.map((node) => node.props.value), ['a', 'b', 'c', 'd']);
  assert.equal(items[2].props.disabled, true);
  assert.equal(items[1].props.children.props.children[1], 'Second (7)');
  assert.equal(items[1].props.children.props.children[0].type, 'svg');
  assert.ok(find(tree, 'TabsList').props.className.includes('hidden md:inline-flex'));
  assert.equal(find(tree, 'TabsList').props['data-tour'], undefined);
  assert.equal(nodes(tree).some((node) => node.type === 'select'), false); // No browser-native selects.
});

test('mobile selection preserves controlled ownership, calls the original handler once and rejects disabled or removed tabs', () => {
  const harness = controlsHarness('src/components/ui/tabs.tsx');
  const calls = [];
  harness.render('Tabs', { value: 'b', onValueChange: (value) => calls.push(value) });
  let tree = harness.render('TabsList', { children: options(harness) });
  const select = find(tree, 'Select').props.onValueChange;
  for (const value of ['b', 'c', 'removed']) select(value);
  assert.deepEqual(calls, []);
  select('d');
  assert.deepEqual(calls, ['d']);
  tree = harness.render('TabsList', { children: options(harness) });
  assert.equal(find(tree, 'Select').props.value, 'b'); // Only the controlled owner can change it.
  harness.render('Tabs', { value: 'd', onValueChange: (value) => calls.push(value) });
  tree = harness.render('TabsList', { children: options(harness) });
  assert.equal(find(tree, 'Select').props.value, 'd');
  find(tree, 'Select').props.onValueChange('d');
  assert.deepEqual(calls, ['d']);
});

test('uncontrolled tabs keep their selected value across default changes, toolbar resizing and dialog closure', () => {
  const harness = controlsHarness('src/components/ui/tabs.tsx');
  const calls = [];
  const props = { defaultValue: 'a', onValueChange: (value) => calls.push(value) };
  let root = harness.render('Tabs', props);
  find(root, 'TabsRoot').props.onValueChange('b');
  root = harness.render('Tabs', { ...props, defaultValue: 'd' });
  assert.equal(root.props.value.value, 'b');
  const listProps = { children: options(harness) };
  let list = harness.render('TabsList', listProps);
  find(list, 'Select').props.onOpenChange(true);
  list = harness.render('TabsList', listProps);
  assert.equal(find(list, 'Select').props.open, true);
  harness.resize('TabsList');
  list = harness.render('TabsList', listProps);
  assert.equal(find(list, 'Select').props.open, false);
  assert.equal(find(list, 'Select').props.value, 'b');
  assert.deepEqual(calls, ['b']);
});

test('short tab bars remain unchanged, with explicit overrides available for long labels', () => {
  const harness = controlsHarness('src/components/ui/tabs.tsx');
  harness.render('Tabs', { defaultValue: 'a' });
  const children = options(harness).slice(0, 1);
  const plain = harness.render('TabsList', { children, variant: 'page', 'data-tour': 'short-tabs' });
  assert.equal(plain.type, 'TabsList');
  assert.equal(plain.props['data-tour'], 'short-tabs');
  assert.ok(!find(plain, 'Select'));
  assert.ok(find(harness.render('TabsList', { children, responsive: true }), 'Select'));
  assert.ok(!find(harness.render('TabsList', { children: options(harness), responsive: false }), 'Select'));
});

test('secondary menu and desktop buttons share one action and never execute disabled or merely opened items', () => {
  const harness = controlsHarness('src/components/ui/responsive-actions.tsx');
  const calls = [];
  const props = { actions: [
    { id: 'import', label: 'Import', onAction: () => calls.push('import') },
    { id: 'delete', label: 'Delete', destructive: true, disabled: true, onAction: () => assert.fail('disabled delete') },
  ] };
  let tree = harness.render('ResponsiveActions', props);
  assert.deepEqual(calls, []);
  const trigger = find(tree, 'DropdownMenuTrigger').props.children;
  assert.equal(trigger.props.type, 'button');
  assert.equal(trigger.props.disabled, false);
  assert.equal(trigger.props['aria-label'], 'common.more_actions');
  find(tree, 'DropdownMenu').props.onOpenChange(true);
  tree = harness.render('ResponsiveActions', props);
  assert.equal(find(tree, 'DropdownMenu').props.open, true);
  assert.deepEqual(calls, []);
  const items = nodes(tree).filter((node) => node.type === 'DropdownMenuItem');
  assert.equal(items[1].props.disabled, true);
  assert.ok(items[1].props.className.includes('text-destructive'));
  items[1].props.onSelect();
  items[0].props.onSelect();
  assert.deepEqual(calls, ['import']);
  nodes(tree).find((node) => node.type === 'Button' && node.props.children[1] === 'Import').props.onClick();
  assert.deepEqual(calls, ['import', 'import']);
  harness.resize('ResponsiveActions');
  tree = harness.render('ResponsiveActions', props);
  assert.equal(find(tree, 'DropdownMenu').props.open, false);
  assert.deepEqual(calls, ['import', 'import']);
});

test('menus disappear for no actions, retain optional desktop controls and honor all-disabled action groups', () => {
  const harness = controlsHarness('src/components/ui/responsive-actions.tsx');
  assert.equal(harness.render('ResponsiveActions', { actions: [] }), null);
  const desktop = React.createElement('span', {}, 'Original desktop controls');
  const tree = harness.render('ResponsiveActions', { desktop, label: 'Import / export', actions: [
    { id: 'export', label: 'Export', disabled: true, onAction: () => assert.fail('disabled export') },
  ] });
  assert.equal(nodes(tree).find((node) => node.props['data-secondary-actions'] === 'desktop').props.children, desktop);
  assert.equal(find(tree, 'DropdownMenuTrigger').props.children.props.disabled, true);
  assert.equal(find(tree, 'DropdownMenuTrigger').props.children.props['aria-label'], 'Import / export');
});

test('wide-screen overlay cleanup uses the latest callback, ignores narrow resizes and unregisters on unmount', () => {
  const exports = {}, callbacks = new Map();
  let ref, effect, cleanup, count = 0;
  const media = { matches: false,
    addEventListener: (name, callback) => callbacks.set(name, callback),
    removeEventListener: (name, callback) => { assert.equal(callbacks.get(name), callback); callbacks.delete(name); },
  };
  vm.runInNewContext(transpile('src/hooks/use-close-on-wide-screen.ts'), { exports,
    window: { matchMedia: (query) => { assert.equal(query, '(min-width: 768px)'); return media; } },
    require: () => ({ useRef: (value) => ref ??= { current: value }, useEffect: (callback) => { effect ??= callback; } }),
  });
  exports.useCloseOnWideScreen(() => assert.fail('outdated callback'));
  cleanup = effect();
  callbacks.get('change')();
  exports.useCloseOnWideScreen(() => ++count);
  media.matches = true;
  callbacks.get('change')();
  assert.equal(count, 1);
  media.matches = false;
  callbacks.get('change')();
  assert.equal(count, 1);
  cleanup();
  assert.equal(callbacks.size, 0);
});

test('dense toolbars and card controls use the shared menus without removing critical controls or confirmations', () => {
  for (const file of ['commands-page', 'modules-page', 'rules-page', 'help-docs-page']) assert.ok(read(`src/pages/${file}.tsx`).includes('<ResponsiveActions'), file);
  assert.ok(read('src/components/persona/persona-manager.tsx').includes('<ResponsiveActions'));
  const modules = read('src/pages/modules-page.tsx');
  assert.ok(modules.includes('onCheckedChange={onToggle} disabled={busy}'));
  assert.ok(modules.includes('destructive: true, onAction: onDelete'));
  assert.ok(read('src/pages/replies-page.tsx').includes('grid grid-cols-2 items-center gap-2 md:flex md:flex-wrap'));
});
