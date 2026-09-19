import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { replyResults, resultProbabilities, validResultWeights } from '../.test-dist/lib/reply-results.js';
import { pokeReplyRule, POKE_KEYS } from '../.test-dist/lib/poke-reply.js';

test('old numeric markers become editable structured weights', () => {
  assert.deepEqual(replyResults({ results: ['::3::甲', '乙'], replyContent: '' }), { texts: ['甲', '乙'], weights: [3, 1] });
  assert.deepEqual(resultProbabilities(['甲', '乙'], [3, 1]), [75, 25]);
});

test('formal weights preserve text that resembles a legacy marker', () => {
  assert.deepEqual(replyResults({ results: ['::5::文字'], resultWeights: [1], replyContent: '' }), { texts: ['::5::文字'], weights: [1] });
});

test('blank and disabled answers do not participate in displayed probabilities', () => {
  assert.deepEqual(resultProbabilities(['甲', ' ', '乙'], [3, 100, 1]), [75, 0, 25]);
  assert.deepEqual(resultProbabilities(['甲', '乙'], [0, 1]), [0, 100]);
  assert.deepEqual(resultProbabilities(['甲'], [0]), [0]);
  assert.equal(validResultWeights([0, 999999]), true);
  for (const value of [-1, 0.5, 1000000, NaN]) assert.equal(validResultWeights([value]), false);
});

test('legacy poke text, command and disabled state are preserved', () => {
  const rule = pokeReplyRule({ poke: '旧文本', poke_command: '.jrrp', poke_enabled: false });
  assert.deepEqual(rule.results, ['旧文本']);
  assert.deepEqual(rule.resultWeights, [1]);
  assert.equal(rule.command, '.jrrp');
  assert.equal(rule.enabled, false);
  assert.deepEqual(rule.conditions, []);
});

test('saved poke rules retain normal advanced-reply limits and weights', () => {
  const rule = pokeReplyRule({ poke_reply: { results: ['甲', '乙'], resultWeights: [3, 1], prob: 25, cooldownSec: 10, scopeMode: 'allow', scopeIds: '2000' } });
  assert.deepEqual(rule.resultWeights, [3, 1]);
  assert.equal(rule.prob, 25);
  assert.equal(rule.cooldownSec, 10);
  assert.equal(rule.scopeIds, '2000');
  assert.equal(POKE_KEYS.includes('poke_reply'), true);
});

test('reference migration report labels and reason codes exist in every UI language', async () => {
  for (const language of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
    const { backup } = JSON.parse(await readFile(new URL(`../src/i18n/locales/${language}.json`, import.meta.url), 'utf8'));
    for (const name of ['summary', 'warning', 'download', 'details', 'converted', 'ambiguous', 'unresolved',
      'reason_variable_name_collision', 'reason_multiple_reference_types', 'reason_reference_not_found', 'reason_dice_expression_requires_review']) {
      assert.equal(typeof backup['reply_reference_' + name], 'string', `${language}: ${name}`);
    }
  }
});

test('reply filtering, sorting and deduplication labels exist in every UI language', async () => {
  for (const language of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
    const { replies } = JSON.parse(await readFile(new URL(`../src/i18n/locales/${language}.json`, import.meta.url), 'utf8'));
    for (const name of ['filter_match_type', 'filter_type_all', 'filter_status', 'filter_status_all',
      'filter_enabled', 'filter_disabled', 'sort_hint', 'duplicate_skipped', 'duplicates_merged']) {
      assert.equal(typeof replies[name], 'string', `${language}: ${name}`);
    }
  }
});
