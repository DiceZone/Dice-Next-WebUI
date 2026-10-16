import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/pages/ai-page.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('ai-page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function readFunction(name, context) {
  let found;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) found = node.initializer;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  };
  visit(tree); assert.ok(found, name);
  const expression = ts.isFunctionDeclaration(found) ? '(' + found.getText(tree) + ')' : '(' + found.getText(tree) + ')';
  return vm.runInContext(ts.transpileModule(expression, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
}

function fixture(direct) {
  const writes = [], notices = [], state = {};
  const context = vm.createContext({ enabled: false, models: [], params: {}, polish: {}, trans: {}, chat: {},
    memory: {}, tools: {}, npc: {}, wl: {}, vision: { enabled: true, pass_url: direct, max_images: 2 },
    t: (key) => key, toast: (value) => notices.push(value) });
  for (const name of ['Enabled', 'Models', 'Params', 'Polish', 'Trans', 'Chat', 'Memory', 'Tools', 'Vision', 'Npc', 'Wl', 'Defaults', 'Saving']) {
    context['set' + name] = (value) => { state[name] = value; };
  }
  for (const name of ['emptyCov', 'emptyParams', 'emptyModel', 'emptyPolish', 'emptyTranslate', 'emptyChat', 'emptyMemory', 'emptyTools', 'emptyVision', 'emptyNpc']) {
    context[name] = readFunction(name, context);
  }
  context.fetch = async (path, options) => {
    const body = JSON.parse(options.body); writes.push({ path, body });
    return { json: async () => ({ code: 0, data: body }) };
  };
  context.jput = readFunction('jput', context);
  context.applyData = readFunction('applyData', context);
  return { context, state, writes, notices, save: readFunction('save', context) };
}

test('AI page sends explicit false and retains it when applying the saved response', async () => {
  for (const direct of [false, true]) {
    const f = fixture(direct);
    await f.save();
    assert.equal(f.writes[0].path, '/api/system/ai');
    assert.equal(f.writes[0].body.vision.pass_url, direct);
    assert.equal(f.state.Vision.pass_url, direct);
    assert.equal(f.state.Saving, false);
    assert.equal(f.notices[0].title, 'common.save_success');
  }
});

test('loading an old vision schema defaults to direct URLs without overriding explicit false', () => {
  const f = fixture(false);
  f.context.applyData({ vision: { enabled: true } });
  assert.equal(f.state.Vision.pass_url, true);
  f.context.applyData({ vision: { enabled: true, pass_url: false } });
  assert.equal(f.state.Vision.pass_url, false);
});

test('AI save failures preserve the unsaved switch and never display a success notice', async () => {
  const f = fixture(false);
  f.context.fetch = async () => { throw new Error('save failed'); };
  await f.save();
  assert.equal(f.state.Vision, undefined);
  assert.equal(f.context.vision.pass_url, false);
  assert.equal(f.state.Saving, false);
  assert.equal(f.notices[0].variant, 'destructive');
});
