import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { replyRegexError, replyMatchTestBody, MAX_REPLY_REGEX_BYTES } from '../.test-dist/lib/reply-preview.js';

test('regex coarse validation uses the backend UTF-8 byte limit, not JS string length', () => {
  assert.equal(MAX_REPLY_REGEX_BYTES, 400);
  assert.equal(replyRegexError('a'.repeat(400)), null);
  assert.match(replyRegexError('a'.repeat(401)), /400.*UTF-8/);
  assert.equal(replyRegexError('中'.repeat(133)), null);
  assert.match(replyRegexError('中'.repeat(134)), /400.*UTF-8/);
  assert.equal(replyRegexError('🙂'.repeat(100)), null);
  assert.match(replyRegexError('🙂'.repeat(101)), /400.*UTF-8/);
});

test('coarse validation checks syntax only and accepts alternations, lazy quantifiers and original Dice bounds', () => {
  for (const pattern of ['^白(丽|麗).{0,6}', '(a)|(ab)', '(a+?)(a*)', '[\\s\\S]*', '(?<name>ab)\\k<name>'])
    assert.equal(replyRegexError(pattern), null, pattern);
  for (const pattern of ['[', '(', '\\', 'a{2,1}', '(?i)a', 'a++'])
    assert.equal(typeof replyRegexError(pattern), 'string', pattern);
});

test('request data preserves message whitespace and only normalizes metadata', () => {
  const scope = { scope: 'account', target: 'bot:test', platform: 'onebot_v11' };
  for (const text of [' a ', '   ', '\ta\n', '🙂\n白丽']) {
    const body = JSON.parse(JSON.stringify(replyMatchTestBody(text, ' 100 ', scope)));
    assert.equal(body.text, text);
    assert.equal(body.groupId, '100');
    assert.equal(body.adapterId, 'bot:test');
  }
});

const componentSource = readFileSync(new URL('../src/components/reply/reply-match-preview.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(componentSource, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
} }).outputText;

// Run the real component's effect with fake hooks/timers/fetch, without a
// browser, network request or listening server.
async function previewRequest(text, touring = false) {
  const timers = [], effects = [], requests = [];
  let slot = 0;
  const react = {
    createElement: () => ({}), useRef: () => ({ current: null }), useEffect: fn => effects.push(fn),
  };
  const module = { exports: {} };
  const modules = {
    react,
    '@/components/onboarding/tour-data': {
      useTourActive: () => touring,
      useTourState: initial => [slot++ === 0 ? text : initial, () => {}],
    },
    '@/lib/tour-samples': { tourSamples: { replies: [{ matchContent: 'sample' }], groups: [{ groupId: 'sample' }], replyPreview: null } },
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    '@/lib/reply-preview': { replyMatchTestBody },
  };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, AbortController,
    require: name => modules[name] ?? new Proxy({}, { get: () => () => ({}) }),
    setTimeout: (fn, ms) => { assert.equal(ms, 350); timers.push(fn); return timers.length; },
    clearTimeout: () => {},
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return { json: async () => ({ code: 0, data: { candidates: [], matched: false } }) };
    },
  });
  module.exports.ReplyMatchPreview({ replies: [], scope: { scope: 'global', platform: '', target: '' } });
  const cleanups = effects.map(fn => fn());
  for (const run of timers) await run();
  for (const cleanup of cleanups) cleanup?.();
  return requests;
}

test('actual preview component sends untrimmed text, including whitespace-only messages', async () => {
  for (const text of [' a ', '   ', '\ta\n', 'a\nb']) {
    const requests = await previewRequest(text);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, '/api/replies/test');
    assert.equal(requests[0].body.text, text);
  }
  assert.deepEqual(await previewRequest(''), []);
});

test('onboarding preview still does not send sample text to the real API', async () => {
  assert.deepEqual(await previewRequest(' a ', true), []);
});

test('all four UI languages explain whole-message matching and literal group syntax', () => {
  for (const language of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
    const { replies, causal } = JSON.parse(readFileSync(new URL(`../src/i18n/locales/${language}.json`, import.meta.url), 'utf8'));
    assert.equal(typeof replies.regex_hint, 'string', language);
    for (const marker of ['ECMAScript', '400', '{$0}', '{$1}', '[\\s\\S]', 'abc.*'])
      assert.ok(replies.regex_hint.includes(marker), `${language}: ${marker}`);
    for (const marker of ['ECMAScript', '{$0}', '{$1}', '[\\s\\S]', 'abc.*'])
      assert.ok(causal.v2.hint_regex.includes(marker), `${language} causal: ${marker}`);
  }
});
