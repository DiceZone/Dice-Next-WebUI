import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveOutcomeText, resolveOutcomeInheritance, outcomePreviewArgs } from '../.test-dist/lib/outcome-replies.js';
import { outcomeReplies } from '../.test-dist/i18n/outcome-replies.js';
import { writeTemplateVariants } from '../.test-dist/lib/weighted-templates.js';
import { filterAndSortTexts } from '../.test-dist/lib/command-text-catalog.js';

const row = (key, value = '', extra = {}) => ({ key, default: value, override: null, format: 'plain', defaultFormat: 'plain', ...extra });
const standard = row('dice.outcome.standard.regular', '', { outcome: { family: 'standard', grade: 'regular' }, fallbackKeys: ['dice.check.result'] });
const bonus = row('dice.outcome.bonus.regular', '', { outcome: { family: 'bonus', grade: 'regular' }, fallbackKeys: [standard.key, 'dice.check.result'] });
const legacy = row('dice.check.result', '**{nick}** {roll}/{rate} {level}', { defaultFormat: 'markdown' });
const index = (...texts) => new Map(texts.map(text => [text.key, text]));

test('specific → standard → original, including formats and empty optional overrides', () => {
  const defaults = index(standard, legacy);
  assert.equal(resolveOutcomeText(bonus, defaults).key, legacy.key);
  assert.equal(resolveOutcomeText(bonus, defaults).format, 'markdown');
  const configured = { ...standard, override: 'standard', format: 'plain' };
  assert.equal(resolveOutcomeText(bonus, index(configured, legacy)).value, 'standard');
  assert.equal(resolveOutcomeText({ ...bonus, override: 'bonus' }, index(configured, legacy)).value, 'bonus');
  assert.equal(resolveOutcomeText({ ...bonus, override: '' }, index(configured, legacy)).value, 'standard');
  assert.equal(resolveOutcomeText({ ...bonus, override: '' }, index(standard, { ...legacy, override: '' })).value, '');
  const weightedEmpty = writeTemplateVariants([{ text: '', weight: 1 }, { text: 'never', weight: 0 }]);
  assert.equal(resolveOutcomeText({ ...bonus, override: weightedEmpty }, defaults).value, weightedEmpty);
});

test('reset restores inheritance in the edited layer without deleting a global base', () => {
  const globalBonus = { ...bonus, override: 'global bonus' };
  const defaults = index({ ...standard, override: 'standard' }, legacy);
  const persona = { [bonus.key]: { value: 'persona bonus', format: 'markdown' }, [standard.key]: { value: 'persona standard', format: 'plain' } };
  assert.equal(resolveOutcomeText(globalBonus, defaults, persona).value, 'persona bonus');
  assert.equal(resolveOutcomeInheritance(globalBonus, defaults, persona).value, 'global bonus');
  assert.equal(resolveOutcomeInheritance(globalBonus, defaults).value, 'standard');
  assert.equal(resolveOutcomeText(bonus, defaults, persona).value, 'persona bonus');
  assert.equal(resolveOutcomeInheritance(bonus, defaults, persona).value, 'persona standard');
  assert.equal(resolveOutcomeText(globalBonus, defaults, { [bonus.key]: { value: '', format: 'plain' } }).value, 'global bonus');
});

test('unconfigured standard slots must not mask the command-specific SAN/growth fallback', () => {
  const san = row('dice.outcome.sanity.regular', '', { outcome: { family: 'sanity', grade: 'regular' }, fallbackKeys: [standard.key, 'card.sc.result'] });
  const sanLegacy = row('card.sc.result', '{loss} -> {final}');
  assert.equal(resolveOutcomeText(san, index(standard, legacy, sanLegacy)).key, sanLegacy.key);
  assert.equal(resolveOutcomeText(san, index(standard, legacy)), undefined);
  assert.equal(resolveOutcomeText(legacy, index(legacy)), undefined);
});

test('all grades preview the selected outcome rather than always showing success', () => {
  const labels = outcomeReplies['zh-Hans'].grades;
  const base = { nick: '测试', roll: '42', rate: '60', level: '成功', group: '100000' };
  for (const grade of Object.keys(labels)) {
    const args = outcomePreviewArgs(base, { family: 'standard', grade }, labels);
    assert.equal(args.level, labels[grade]); assert.equal(args.outcome, labels[grade]);
    assert.match(args.result, /^\d+$/);
  }
  assert.equal(outcomePreviewArgs(base, { family: 'growth', grade: 'regular' }, labels).result, '70');
  assert.equal(outcomePreviewArgs(base, { family: 'death_save', grade: 'critical' }, labels).roll, '20');
  assert.equal(outcomePreviewArgs(base, { family: 'death_save', grade: 'fumble' }, labels).f, '2');
  assert.equal(outcomePreviewArgs(base, { family: 'dnd_check', grade: 'failure' }, labels).threshold, '15');
  assert.equal(outcomePreviewArgs(base, { family: 'sanity', grade: 'failure' }, labels).res, '80');
  assert.equal(outcomePreviewArgs(base, undefined, labels), base);
});

test('inherited text participates in search/sorting without mutating authored defaults', () => {
  const inherited = { ...bonus, group: 'dice', description: '奖励骰 · 成功', example: '.rb 60', categories: ['COC'], effective: { value: '继承的珍稀文案' } };
  const result = filterAndSortTexts([inherited], '珍稀', 'COC', { field: 'text', direction: 'asc' });
  assert.equal(result.length, 1); assert.equal(result[0].override, null); assert.equal(result[0].default, '');
});

test('localized grades/families stay complete and editor preserves server-side weighted/sample preview', () => {
  const leaves = value => Object.entries(value).flatMap(([key, item]) => typeof item === 'string' ? [key] : leaves(item).map(name => `${key}.${name}`)).sort();
  for (const locale of ['zh-Hans', 'zh-Hant', 'en', 'ja']) assert.deepEqual(leaves(outcomeReplies[locale]), leaves(outcomeReplies.en));
  const editor = readFileSync(new URL('../src/pages/commands-page.tsx', import.meta.url), 'utf8');
  assert.match(editor, /resolveOutcomeInheritance/);
  assert.match(editor, /variants: previewVariants, args: previewArgs, format: previewFormat/);
  assert.match(editor, /outcomePreviewArgs\(PREVIEW_VALUES, reply.outcome/);
  assert.match(editor, /reply.outcome && \(useInherited \|\| storedValue === ''\)/);
  assert.match(editor, /outcome.reset/);
  assert.match(editor, /!useInherited && <>/);
});
