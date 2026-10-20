import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes)
  : node?.props ? [node, ...nodes(node.props.children)] : [];
const jsx = (type, props) => ({ type, props });
const tags = (names) => Object.fromEntries(names.map((name) => [name, name]));

function load(path) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports, require: (name) => {
    if (name === 'react') return { forwardRef: (render) => render };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@radix-ui/react-dialog') return tags(['Root', 'Trigger', 'Portal', 'Close', 'Overlay', 'Content', 'Title', 'Description']);
    if (name === 'lucide-react') return { X: 'X' };
    if (name === '@/lib/utils') return { cn: (...values) => twMerge(clsx(values)) };
    throw new Error('Unexpected dependency: ' + name);
  } });
  return exports;
}

const dialog = load('src/components/ui/dialog.tsx');
const content = (props = {}) => nodes(dialog.DialogContent(props)).find((node) => node.type === 'Content');
const { AsyncPreview } = load('src/components/ui/async-preview.tsx');

test('editor dialogs use a viewport-bounded, content-independent height, without leaking layout to Radix', () => {
  const editor = content({ layout: 'editor', className: 'max-w-2xl' });
  assert.match(editor.props.className, /h-\[min\(90dvh,56rem\)\]/);
  assert.match(editor.props.className, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(editor.props.className, /flex-col/);
  assert.match(editor.props.className, /overflow-hidden/);
  assert.doesNotMatch(editor.props.className, /overflow-y-auto/);
  assert.equal(editor.props.layout, undefined);
  // duration-200 also sets transition-duration; do not implicitly transition
  // every dimension when the viewport changes (e.g. a mobile keyboard opens).
  assert.match(editor.props.className, /transition-none/);
  assert.match(editor.props.className, /data-\[state=open\]:animate-in/);
  // The search workspace can use a smaller bounded height via the same API.
  const search = content({ layout: 'editor', className: 'h-[min(80dvh,40rem)]' });
  assert.match(search.props.className, /h-\[min\(80dvh,40rem\)\]/);
  assert.doesNotMatch(search.props.className, /h-\[min\(90dvh,56rem\)\]/);
});

test('ordinary prompts and confirmations remain compact, with a safe viewport limit', () => {
  const normal = content();
  assert.doesNotMatch(normal.props.className, /(?:^| )h-/);
  assert.match(normal.props.className, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(normal.props.className, /overflow-y-auto/);
  assert.match(normal.props.className, /\[scrollbar-gutter:stable\]/);
});

test('only dialog bodies scroll, keep a stable gutter and allow flex/grid children to shrink', () => {
  const ref = {};
  const body = dialog.DialogBody({ className: 'grid gap-5', 'data-reply-scroll': true }, ref);
  assert.equal(body.props.ref, ref);
  assert.equal(body.props['data-reply-scroll'], true);
  for (const token of ['min-h-0', 'min-w-0', 'flex-1', 'overflow-y-auto', 'overscroll-contain', '[scrollbar-gutter:stable]', 'grid'])
    assert.ok(body.props.className.split(' ').includes(token), token);
  for (const name of ['DialogHeader', 'DialogFooter'])
    assert.match(dialog[name]({}).props.className, /shrink-0/);
});

test('loading/ready/error states reserve a status slot, with preview content always mounted', () => {
  const previous = jsx('div', { 'data-preview-message': 1, children: 'previous preview\nsecond line' });
  for (const props of [
    { loading: true }, { loading: false }, { loading: false, error: 'Preview unavailable' },
  ]) {
    const tree = AsyncPreview({ ...props, loadingLabel: 'Loading', children: previous });
    const children = nodes(tree);
    const body = children.find((node) => 'aria-busy' in node.props);
    const status = children.find((node) => node.props['aria-live'] === 'polite');
    assert.equal(body.props['aria-busy'], props.loading);
    assert.equal(body.props.children, previous);
    assert.match(body.props.className, /min-h-24/);
    assert.match(status.props.className, /min-h-4/);
    assert.equal(children.filter((node) => node.props.role === 'status').length, props.loading ? 1 : 0);
    assert.equal(children.filter((node) => node.props.role === 'alert').length, props.error ? 1 : 0);
  }
  // An initial request and an error without a last valid preview retain space too.
  for (const loading of [true, false]) {
    const tree = AsyncPreview({ loading, loadingLabel: 'Loading', error: 'Failed', children: null });
    assert.equal(nodes(tree).find((node) => 'aria-busy' in node.props).props.children, null);
  }
});

test('dynamic editor/search call sites opt in, while normal input dialogs do not', () => {
  for (const path of [
    'src/pages/commands-page.tsx', 'src/pages/help-docs-page.tsx',
    'src/components/reply/reply-form.tsx', 'src/components/persona/persona-editor.tsx',
    'src/components/deck-editor.tsx', 'src/components/layout/global-settings-search.tsx',
  ]) assert.match(read(path), /<DialogContent layout="editor"/, path);
  for (const path of ['src/hooks/use-dialogs.tsx', 'src/components/ui/feature-help.tsx'])
    assert.doesNotMatch(read(path), /layout="editor"/, path);
  const search = read('src/components/layout/global-settings-search.tsx');
  assert.match(search, /id="global-settings-search-results" className="min-h-0 flex-1/);
  assert.doesNotMatch(search, /max-h-\[min\(55vh/);
});

test('template refresh does not replace its content and long previews stay internally scrollable', () => {
  const editor = read('src/pages/commands-page.tsx');
  assert.match(editor, /<AsyncPreview loading=\{previewLoading\}/);
  assert.doesNotMatch(editor, /\{previewLoading\s*\?/);
  assert.match(editor, /<TabsContent value="display" className="[^"]*max-h-64 overflow-y-auto/);
  // Existing stale-request cancellation remains intact.
  assert.match(editor, /if \(controller.signal.aborted\) return/);
  assert.match(editor, /window.clearTimeout\(timer\); controller.abort\(\)/);
});

test('native inputs and textareas can shrink inside narrow flex/grid layouts', () => {
  for (const path of ['src/components/ui/input.tsx', 'src/components/ui/textarea.tsx']) {
    const component = Object.values(load(path))[0];
    const input = component({});
    assert.match(input.props.className, /min-w-0/);
    assert.match(input.props.className, /w-full/);
  }
});

test('persona add/search controls scroll with the body, leaving room for the footer on short screens', () => {
  const tree = ts.createSourceFile('persona-editor.tsx', read('src/components/persona/persona-editor.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const elements = [];
  const visit = (node) => { if (ts.isJsxElement(node)) elements.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const tag = (node) => node.openingElement.tagName.getText(tree);
  const body = elements.find((node) => tag(node) === 'DialogBody');
  const footer = elements.find((node) => tag(node) === 'DialogFooter');
  assert.equal(body.parent, footer.parent);
  assert.match(body.getText(tree), /value=\{newKey\}/);
  assert.match(body.getText(tree), /value=\{newValue\}/);
  assert.match(body.getText(tree), /value=\{filter\}/);
  assert.match(body.getText(tree), /filtered\.map/);
  const deck = read('src/components/deck-editor.tsx');
  assert.match(deck, /mode === 'source' \? <div className="[^"]*min-h-0 flex-1[^"]*overflow-y-auto/);
});
