import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as runtimeLogs from '../.test-dist/lib/runtime-logs.js';

const nodes = value => Array.isArray(value) ? value.flatMap(nodes)
  : value?.props ? [value, ...nodes(value.props.children)] : [];
const row = (id, level = 'info') => ({ id, level, timestamp: '2026-10-13 12:00:00.000', module: '消息', message: `日志 ${id}` });
const source = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');

// Run the actual hook and component callbacks against explicit scroll metrics.
// This fixture models React's render/commit/effect lifecycle, not browser layout.
function harness({ resizeObserver = true } = {}) {
  const slots = [];
  let cursor = 0;
  let pending = [];
  let tree = [];
  let currentLogs = [];
  let top = 0;
  const writes = [];
  const observers = [];
  const viewport = {
    scrollHeight: 1000, clientHeight: 300,
    get scrollTop() { return top; },
    set scrollTop(value) { top = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight)); writes.push(top); },
  };
  const content = {};
  const same = (left, right) => left?.length === right.length && right.every((value, index) => Object.is(value, left[index]));
  const memo = (create, deps) => {
    const index = cursor++;
    if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { value: create(), deps };
    return slots[index].value;
  };
  const react = {
    useRef: initial => { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useState: initial => {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }];
    },
    useMemo: memo,
    useCallback: (callback, deps) => memo(() => callback, deps),
    useLayoutEffect: (create, deps) => {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) {
        const previous = slots[index];
        const effect = { create, deps };
        slots[index] = effect;
        pending.push(() => { previous?.cleanup?.(); effect.cleanup = create(); });
      }
    },
    forwardRef: render => render,
  };
  const jsx = (type, props) => ({ type, props });
  class Observer {
    constructor(callback) { this.callback = callback; this.targets = []; this.disconnected = false; observers.push(this); }
    observe(target) { this.targets.push(target); }
    disconnect() { this.disconnected = true; }
  }
  let hook;
  const require = path => {
    if (path === 'react') return react;
    if (path === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (path === 'react-i18next') return { useTranslation: () => ({ t: key => key }) };
    if (path === 'lucide-react') return { ArrowDown: 'ArrowDown', ChevronDown: 'ChevronDown', Link2: 'Link2' };
    if (path === '@/hooks/use-log-follow') return hook;
    if (path === '@/lib/runtime-logs') return runtimeLogs;
    if (path === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
    const groups = {
      card: ['Card', 'CardHeader', 'CardTitle', 'CardContent'], badge: ['Badge'], button: ['Button'], input: ['Input'],
      'feature-help': ['FeatureHelp'], select: ['Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue'],
      dialog: ['Dialog', 'DialogContent', 'DialogHeader', 'DialogTitle', 'DialogDescription'], 'scroll-area': ['ScrollArea'],
    };
    const names = groups[path.split('/').at(-1)];
    if (names) return Object.fromEntries(names.map(name => [name, name]));
    throw new Error(`Unexpected dependency: ${path}`);
  };
  const load = name => {
    const exports = {};
    const code = ts.transpileModule(source(name), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    vm.runInNewContext(code, { exports, require, ResizeObserver: resizeObserver ? Observer : undefined,
      localStorage: { getItem: () => null, setItem: () => {} } });
    return exports;
  };
  hook = load('hooks/use-log-follow.ts');
  const component = load('components/dashboard/recent-logs.tsx');
  const render = (logs = currentLogs) => {
    currentLogs = logs;
    cursor = 0;
    pending = [];
    tree = nodes(component.RecentLogs({ logs }));
    const scroll = tree.find(node => node.type === 'ScrollArea');
    scroll.props.ref.current = viewport;
    scroll.props.children.props.ref.current = content;
    pending.forEach(effect => effect());
    return tree;
  };
  return {
    viewport, content, writes, observers, render,
    button: () => tree.find(node => node.type === 'Button' && node.props.children?.[1] === 'runtime_logs.back_to_latest'),
    scroll: () => tree.find(node => node.type === 'ScrollArea'),
    userScroll(value) {
      top = Math.max(0, Math.min(value, viewport.scrollHeight - viewport.clientHeight));
      this.scroll().props.onScroll();
      render();
    },
    resize() { observers.filter(observer => !observer.disconnected).forEach(observer => observer.callback()); },
    query(value) { tree.find(node => node.type === 'Input').props.onChange({ target: { value } }); render(); },
    minimum(value) { tree.find(node => node.type === 'Select').props.onValueChange(value); render(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
    scrollArea: load('components/ui/scroll-area.tsx').ScrollArea,
  };
}

test('the real ScrollArea forwards its ref and scroll callback to the outer scrolling div', () => {
  const h = harness();
  const ref = { current: null };
  const onScroll = () => {};
  const actual = h.scrollArea({ className: 'h-[400px]', onScroll, children: 'logs' }, ref);
  assert.equal(actual.type, 'div');
  assert.equal(actual.props.ref, ref);
  assert.equal(actual.props.onScroll, onScroll);
  assert.ok(actual.props.className.includes('overflow-auto'));
  assert.equal(actual.props.children, 'logs');
  h.render([row('1')]);
  assert.equal(h.viewport.scrollTop, 700);
});

test('entering with cached logs positions the list at the newest record before paint', () => {
  const h = harness();
  h.render([row('1'), row('2')]);
  assert.equal(h.viewport.scrollTop, 700);
  assert.equal(h.button(), undefined);
  assert.equal(h.scroll().props.tabIndex, 0);
  assert.ok(h.scroll().props.className.includes('overscroll-contain'));
});

test('the first async batch after an empty mount and each new batch follow the bottom', () => {
  const h = harness();
  h.viewport.scrollHeight = 0;
  h.render([]);
  assert.equal(h.viewport.scrollTop, 0);
  h.viewport.scrollHeight = 1000;
  h.render([row('1')]);
  assert.equal(h.viewport.scrollTop, 700);
  h.viewport.scrollHeight = 1250;
  h.render([row('1'), row('2')]);
  assert.equal(h.viewport.scrollTop, 950);
  h.scroll().props.onScroll(); // The browser's programmatic scroll event.
  h.render();
  assert.equal(h.button(), undefined);
});

test('upward scrolling pauses immediately, and arriving records do not drag the reader down', () => {
  const h = harness();
  h.render([row('1')]);
  h.userScroll(450);
  assert.ok(h.button());
  const before = h.writes.length;
  h.viewport.scrollHeight = 1200;
  h.render([row('1'), row('2')]);
  h.resize();
  assert.equal(h.viewport.scrollTop, 450);
  assert.equal(h.writes.length, before);
  assert.ok(h.button());
});

test('small upward scrolling also pauses, while fractional bottom rounding does not', () => {
  const h = harness();
  h.render([row('1')]);
  h.userScroll(698.5);
  assert.equal(h.button(), undefined);
  h.userScroll(696);
  assert.ok(h.button());
});

test('back to latest jumps to the actual bottom, hides the button and resumes following', () => {
  const h = harness();
  h.render([row('1')]);
  h.userScroll(100);
  h.viewport.scrollHeight = 1200;
  h.render([row('1'), row('2')]);
  h.button().props.onClick();
  h.render();
  assert.equal(h.viewport.scrollTop, 900);
  assert.equal(h.button(), undefined);
  h.viewport.scrollHeight = 1400;
  h.render([row('1'), row('2'), row('3')]);
  assert.equal(h.viewport.scrollTop, 1100);
});

test('manually scrolling back to the bottom also resumes automatic following', () => {
  const h = harness();
  h.render([row('1')]);
  h.userScroll(100);
  h.userScroll(700);
  assert.equal(h.button(), undefined);
  h.viewport.scrollHeight = 1300;
  h.render([row('1'), row('2')]);
  assert.equal(h.viewport.scrollTop, 1000);
});

test('text wrapping, viewport resizing and expanded details follow only while unpaused', () => {
  const h = harness();
  h.render([row('1')]);
  assert.deepEqual(h.observers[0].targets, [h.viewport, h.content]);
  h.viewport.clientHeight = 200;
  h.viewport.scrollHeight = 1500;
  h.resize();
  assert.equal(h.viewport.scrollTop, 1300);
  h.userScroll(500);
  h.viewport.scrollHeight = 2000;
  h.resize();
  assert.equal(h.viewport.scrollTop, 500);
});

test('level and keyword filters use the current visible rows without resetting paused follow state', () => {
  const h = harness();
  h.render([row('1'), row('2', 'error'), row('3', 'debug')]);
  h.minimum('error');
  let rows = nodes(h.scroll().props.children).filter(node => node.props.log);
  assert.deepEqual(rows.map(node => node.props.log.id), ['2']);
  h.userScroll(400);
  const before = h.writes.length;
  h.query('日志 2');
  h.render([row('1'), row('2', 'error'), row('4', 'error')]);
  rows = nodes(h.scroll().props.children).filter(node => node.props.log);
  assert.deepEqual(rows.map(node => node.props.log.id), ['2']);
  assert.equal(h.viewport.scrollTop, 400);
  assert.equal(h.writes.length, before);
  h.button().props.onClick();
  h.render();
  assert.equal(h.viewport.scrollTop, 700);
});

test('without ResizeObserver, async logs and the explicit resume button still work', () => {
  const h = harness({ resizeObserver: false });
  h.render([row('1')]);
  assert.equal(h.viewport.scrollTop, 700);
  h.userScroll(100);
  h.viewport.scrollHeight = 1400;
  h.render([row('1'), row('2')]);
  assert.equal(h.viewport.scrollTop, 100);
  h.button().props.onClick();
  assert.equal(h.viewport.scrollTop, 1100);
});

test('unmount disconnects resize observation and a fresh visit starts following again', () => {
  const h = harness();
  h.render([row('1')]);
  h.userScroll(100);
  h.unmount();
  assert.ok(h.observers.every(observer => observer.disconnected));
  const next = harness();
  next.render([row('2')]);
  assert.equal(next.viewport.scrollTop, 700);
  assert.equal(next.button(), undefined);
});

test('short logs and an empty list never request a negative scroll position', () => {
  const h = harness();
  h.viewport.scrollHeight = 150;
  h.render([row('1')]);
  assert.equal(h.viewport.scrollTop, 0);
  h.userScroll(0);
  assert.equal(h.button(), undefined);
  h.viewport.scrollHeight = 0;
  h.render([]);
  assert.equal(h.viewport.scrollTop, 0);
});
