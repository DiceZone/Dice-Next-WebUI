import test from 'node:test';
import assert from 'node:assert/strict';
import { restyleVariable, variableStyleOf, VARIABLE_STYLES } from '../.test-dist/lib/template-variable-style.js';
import { readReplyPreview, PREVIEW_PLATFORMS } from '../.test-dist/lib/reply-preview.js';
import { readFile } from 'node:fs/promises';

test('platform preview requires server serialization instead of guessing output', () => {
  assert.equal(readReplyPreview({ markdown: '**example**', onebot: 'example' }), null);
  assert.equal(readReplyPreview({ preview: { text: 'x', plain: 'x', markdown: true, payload: {}, actions: [{ label: {} }] } }), null);
  const preview = { text: '**x**', plain: 'x', markdown: true, payload: { msg_type: 2 }, actions: [{ label: 'roll', text: '.r' }] };
  assert.deepEqual(readReplyPreview({ preview }), preview);
  assert.ok(PREVIEW_PLATFORMS.includes('qq_channel'));
});
test('independent frontend CI stays read-only and does not compile the backend', async () => {
  const workflow = await readFile(new URL('../.github/workflows/checks.yml', import.meta.url), 'utf8');
  for (const command of ['npm ci', 'npm test', 'npm run lint', 'npm run build', 'PWA_TEST_DIST']) assert.ok(workflow.includes(command));
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /ubuntu-24\.04/);
  assert.doesNotMatch(workflow, /pull_request_target|cmake|vcpkg|git push|deploy|secrets\./);
});

test('nested variable wrappers are replaced, not stacked', () => {
  for (const wrapped of ['***{nick}***', '**`{nick}`**', '~~__{nick}__~~', '``{nick}``', '*~~`{nick}`~~*']) {
    assert.equal(restyleVariable(wrapped, 'nick', 'plain'), '{nick}');
    assert.equal(restyleVariable(wrapped, 'nick', 'code'), '`{nick}`');
  }
});
test('all style transitions round trip without residual delimiters', () => {
  for (const first of VARIABLE_STYLES) for (const next of VARIABLE_STYLES) {
    const value = restyleVariable(restyleVariable('结果：{nick}', 'nick', first), 'nick', next);
    assert.equal(variableStyleOf(value, 'nick'), next);
    assert.equal(restyleVariable(value, 'nick', 'plain'), '结果：{nick}');
  }
});
test('preserves surrounding prose styles, unrelated tokens and escaped literals', () => {
  assert.equal(restyleVariable('**角色 {nick}** {other} 2*{nick}*3 \\{nick}', 'nick', 'plain'), '**角色 {nick}** {other} 2*{nick}*3 \\{nick}');
  assert.equal(restyleVariable('**{a.b|x}** 和 ~~{a.b|x}~~', 'a.b|x', 'italic'), '*{a.b|x}* 和 *{a.b|x}*');
  assert.equal(restyleVariable('**{nick}**/**{nick}**', 'nick', 'plain'), '{nick}/{nick}');
});
