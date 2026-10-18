import test from 'node:test';
import assert from 'node:assert/strict';
import { restyleVariable, variableStyleOf, VARIABLE_STYLES } from '../.test-dist/lib/template-variable-style.js';
import { readReplyPreview, previewMessages, isFormFeedVariable, PREVIEW_PLATFORMS } from '../.test-dist/lib/reply-preview.js';
import { readFile } from 'node:fs/promises';

test('platform preview requires server serialization instead of guessing output', () => {
  assert.equal(readReplyPreview({ markdown: '**example**', onebot: 'example' }), null);
  assert.equal(readReplyPreview({ preview: { text: 'x', plain: 'x', markdown: true, payload: {}, actions: [{ label: {} }] } }), null);
  const preview = { text: '**x**', plain: 'x', markdown: true, payload: { msg_type: 2 }, actions: [{ label: 'roll', text: '.r' }] };
  assert.deepEqual(readReplyPreview({ preview }), preview);
  assert.ok(PREVIEW_PLATFORMS.includes('qq_channel'));
});

test('explicit message-break previews preserve separate payloads and reject malformed or nested messages', () => {
  const first = { text: '**甲**', plain: '甲', markdown: true, payload: { content: '甲' }, actions: [] };
  const second = { text: '乙', plain: '乙', markdown: false, payload: null, actions: [] };
  const multiple = { ...first, payload: null, messages: [first, second] };
  assert.deepEqual(previewMessages(readReplyPreview({ preview: multiple })), [first, second]);
  assert.deepEqual(previewMessages(readReplyPreview({ preview: first })), [first]);
  assert.deepEqual(previewMessages(readReplyPreview({ preview: { ...first, messages: [] } })), []);
  for (const messages of ['not-an-array', [{}], [{ ...first, messages: [second] }]]) {
    assert.equal(readReplyPreview({ preview: { ...first, messages } }), null);
  }
});

test('legacy FormFeed is accepted case-insensitively and is not a styleable display value', async () => {
  for (const name of ['FormFeed', 'formfeed', 'FORMFEED', 'fOrMfEeD']) assert.equal(isFormFeedVariable(name), true);
  for (const name of ['formFeed ', 'form feed', 'FormFeed:1', 'FormFeeds', 'nick']) assert.equal(isFormFeedVariable(name), false);
  const source = await readFile(new URL('../src/pages/commands-page.tsx', import.meta.url), 'utf8');
  assert.match(source, /const GLOBAL_VARS = .*'FormFeed'/);
  assert.match(source, /const unknown = .*!isFormFeedVariable\(u\)/);
  assert.match(source, /const styledVars = .*!isFormFeedVariable\(name\)/);
  assert.ok(source.includes('previewMessages(preview).map'));
  for (const language of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
    const locale = JSON.parse(await readFile(new URL(`../src/i18n/locales/${language}.json`, import.meta.url), 'utf8'));
    assert.ok(locale.commands.gvar_FormFeed);
  }
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
