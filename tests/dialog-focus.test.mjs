import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/ui/dialog.tsx', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const nodes = (node) => {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node?.props) return [];
  return [node, ...nodes(node.props.children)];
};

// Exercise the shared component's actual autofocus callback with a small DOM
// fixture. Visibility, inherited hidden/disabled state and failed focus are
// modeled explicitly; these tests do not claim browser layout verification.
function harness() {
  const calls = [];
  const document = { activeElement: null, defaultView: { getComputedStyle: (element) => ({ visibility: element.visibility }) } };
  class Element {
    constructor({ name = 'element', tagName = 'BUTTON', tabIndex = 0, attributes = [], children = [], ...props } = {}) {
      Object.assign(this, { name, tagName, tabIndex, children, attributes: new Set(attributes), visibility: 'visible', rendered: true, disabled: false, hiddenInput: false, canFocus: true, ownerDocument: document }, props);
      for (const child of children) child.parentElement = this;
    }
    querySelectorAll(selector) {
      assert.equal(selector, '*');
      return this.children.flatMap((child) => [child, ...child.querySelectorAll('*')]);
    }
    querySelector(selector) {
      assert.equal(selector, '[data-dialog-autofocus-skip]');
      return this.querySelectorAll('*').find((child) => child.hasAttribute('data-dialog-autofocus-skip')) ?? null;
    }
    hasAttribute(attribute) { return this.attributes.has(attribute); }
    matches(selector) {
      assert.equal(selector, ':disabled, input[type="hidden"]');
      return this.disabled || this.hiddenInput;
    }
    closest(selector) {
      assert.equal(selector, '[hidden], [inert]');
      for (let ancestor = this; ancestor; ancestor = ancestor.parentElement) {
        if (ancestor.hasAttribute('hidden') || ancestor.hasAttribute('inert')) return ancestor;
      }
      return null;
    }
    getClientRects() {
      for (let ancestor = this; ancestor; ancestor = ancestor.parentElement) {
        if (!ancestor.rendered) return [];
      }
      return [{}];
    }
    focus(options) {
      assert.equal(options.preventScroll, true);
      calls.push(this.name);
      if (this.canFocus) document.activeElement = this;
    }
  }
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(js, { exports, HTMLElement: Element, require: (path) => {
    if (path === 'react') return { forwardRef: (render) => render };
    if (path === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (path === '@radix-ui/react-dialog') return Object.fromEntries(['Root', 'Trigger', 'Portal', 'Close', 'Overlay', 'Content', 'Title', 'Description'].map((name) => [name, name]));
    if (path === 'lucide-react') return { X: 'X' };
    if (path === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
    throw new Error('Unexpected dependency: ' + path);
  } });
  const content = (props = {}, ref = null) => nodes(exports.DialogContent(props, ref)).find((node) => node.type === 'Content');
  return {
    calls, document, content,
    element: (props) => new Element(props),
    help: (name = 'help') => new Element({ name, attributes: ['data-dialog-autofocus-skip'] }),
    container: (...children) => new Element({ name: 'content', tagName: 'DIV', tabIndex: -1, children }),
    open(container, props = {}) {
      const event = { currentTarget: container, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      content(props).props.onOpenAutoFocus(event);
      return event;
    },
  };
}

test('a leading help trigger is skipped on modal open, but stays keyboard-focusable', () => {
  const h = harness();
  const help = h.help();
  const input = h.element({ name: 'reply input', tagName: 'INPUT' });
  const container = h.container(help, input);
  assert.equal(h.open(container).defaultPrevented, true);
  assert.deepEqual(h.calls, ['reply input']);
  assert.equal(h.document.activeElement, input);
  assert.equal(help.tabIndex, 0);
  assert.equal(help.disabled, false);
  help.focus({ preventScroll: true }); // Manual Tab focus is not disabled by the fix.
  assert.equal(h.document.activeElement, help);
});

test('several leading help buttons are skipped in favor of a real frontend select or input', () => {
  const h = harness();
  const select = h.element({ name: 'scope select' });
  h.open(h.container(h.help('page help'), h.help('field help'), select));
  assert.deepEqual(h.calls, ['scope select']);
});

test('autofocus avoids disabled, hidden, inert, non-tabbable, hidden-input and CSS-hidden controls', () => {
  const h = harness();
  const input = h.element({ name: 'available input', tagName: 'INPUT' });
  const container = h.container(
    h.help(),
    h.element({ disabled: true }), // Includes controls disabled by a fieldset via :disabled.
    h.element({ tagName: 'INPUT', hiddenInput: true }),
    h.element({ tabIndex: -1 }),
    h.element({ tagName: 'A' }), // Radix also skips links on initial autofocus.
    h.element({ attributes: ['hidden'], children: [h.element()] }),
    h.element({ attributes: ['inert'], children: [h.element()] }),
    h.element({ rendered: false, children: [h.element()] }),
    h.element({ visibility: 'hidden' }),
    h.element({ visibility: 'collapse' }),
    input,
  );
  h.open(container);
  assert.deepEqual(h.calls, ['available input']);
});

test('focus failures try the next usable control without falling back to help', () => {
  const h = harness();
  const input = h.element({ name: 'next input', tagName: 'INPUT' });
  h.open(h.container(h.help(), h.element({ name: 'cannot focus', canFocus: false }), input));
  assert.deepEqual(h.calls, ['cannot focus', 'next input']);
  assert.equal(h.document.activeElement, input);
});

test('help-only dialogs focus the content rather than showing a tooltip', () => {
  const h = harness();
  const container = h.container(h.help(), h.help('other help'));
  h.open(container);
  assert.deepEqual(h.calls, ['content']);
  assert.equal(h.document.activeElement, container);
});

test('dialogs without help or with an ordinary first control keep Radix autofocus unchanged', () => {
  for (const withHelp of [false, true]) {
    const h = harness();
    const first = h.element({ name: 'ordinary first input', tagName: 'INPUT' });
    const container = h.container(first, ...(withHelp ? [h.help()] : []));
    assert.equal(h.open(container).defaultPrevented, false);
    assert.deepEqual(h.calls, []); // Default autofocus remains the library's job.
  }
});

test('custom autofocus cancellation is respected and uncancelled handlers still run once', () => {
  const h = harness();
  const container = h.container(h.help(), h.element({ name: 'input' }));
  let count = 0;
  const event = h.open(container, { onOpenAutoFocus: (event) => { count++; event.preventDefault(); } });
  assert.equal(event.defaultPrevented, true);
  assert.equal(count, 1);
  assert.deepEqual(h.calls, []);
  h.open(container, { onOpenAutoFocus: () => { count++; assert.deepEqual(h.calls, []); } });
  assert.equal(count, 2);
  assert.deepEqual(h.calls, ['input']);
});

test('shared dialog preserves forwarded refs, close behavior, role attributes and focus-trap props', () => {
  const h = harness();
  const ref = { current: null };
  const close = () => {};
  const escape = () => {};
  const content = h.content({ onCloseAutoFocus: close, onEscapeKeyDown: escape, 'aria-describedby': 'description', tabIndex: -1 }, ref);
  assert.equal(content.props.ref, ref);
  assert.equal(content.props.onCloseAutoFocus, close);
  assert.equal(content.props.onEscapeKeyDown, escape);
  assert.equal(content.props['aria-describedby'], 'description');
  assert.equal(content.props.tabIndex, -1);
  assert.equal(content.props.trapFocus, undefined); // Radix's modal focus trap is not turned off.
});
