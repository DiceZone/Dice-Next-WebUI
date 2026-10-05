import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readTemplateVariants, writeTemplateVariants, templateSummary, splitLegacySample, probabilities, validWeights, WEIGHTED_TEMPLATE_PREFIX } from '../.test-dist/lib/weighted-templates.js';
import { weightedTemplates } from '../.test-dist/i18n/weighted-templates.js';
import { filterAndSortTexts } from '../.test-dist/lib/command-text-catalog.js';

test('single templates retain legacy syntax and native variants round trip nested sample and unicode', () => {
  const single = '**{nick}** 掷骰：`{expr}` {sample:效果拔群|干得漂亮}';
  assert.deepEqual(readTemplateVariants(single), [{ text: single, weight: 1 }]);
  assert.equal(writeTemplateVariants(readTemplateVariants(single)), single);
  const items = [{ text: '{sample:甲|{sample:乙|丙}} {nick}', weight: 1 }, { text: '😀\n乙', weight: 3 }, { text: '', weight: 0 }];
  assert.deepEqual(readTemplateVariants(writeTemplateVariants(items)), items);
  assert.equal(templateSummary(writeTemplateVariants(items)), items.map(item => item.text).join('\n'));
  assert.deepEqual(probabilities(items), [25, 75, 0]);
  assert.deepEqual(readTemplateVariants('["literal JSON"]'), [{ text: '["literal JSON"]', weight: 1 }]);
});

test('legacy outer sample conversion preserves nested macros, placeholders and empty options', () => {
  assert.deepEqual(splitLegacySample('{sample:**{nick}** 掷骰：`{expr}`|{sample:好|更好}{res}|}'),
    ['**{nick}** 掷骰：`{expr}`', '{sample:好|更好}{res}', '']);
  for (const text of ['前{sample:甲|乙}', '{sample:甲|乙}后', '{sample:甲|{nick}', '\\{sample:甲|乙}'])
    assert.equal(splitLegacySample(text), null);
  assert.deepEqual(splitLegacySample('{sample:甲|乙}'), ['甲', '乙']);
});

test('invalid single-weight drafts stay invalid and zero variants remain editable', () => {
  for (const weight of [0, -1, 0.5, 1000000]) {
    const draft = [{ text: 'x', weight }];
    assert.equal(validWeights(draft), false);
    assert.deepEqual(readTemplateVariants(writeTemplateVariants(draft)), draft);
  }
  assert.deepEqual(readTemplateVariants(writeTemplateVariants([{ text: 'x', weight: 3 }])), [{ text: 'x', weight: 3 }]);
  assert.equal(validWeights([]), false);
  assert.equal(validWeights([{ weight: NaN }]), false);
  assert.equal(validWeights([{ weight: 999999 }, { weight: 0 }]), true);
  assert.equal(validWeights(Array.from({ length: 257 }, () => ({ weight: 1 }))), false);
});

test('search and text sorting use actual variants rather than internal storage metadata', () => {
  const row = { key: 'dice.roll', group: 'dice', default: '', override: writeTemplateVariants([{ text: '珍稀回复', weight: 2 }, { text: '普通回复', weight: 3 }]), categories: ['掷骰'], description: '', example: '.r' };
  assert.equal(filterAndSortTexts([row], '珍稀', '', { field: 'text', direction: 'asc' }).length, 1);
  assert.equal(filterAndSortTexts([row], WEIGHTED_TEMPLATE_PREFIX, '', { field: 'text', direction: 'asc' }).length, 0);
});

test('editor sends authored variants and arguments separately to the server, with resampling', () => {
  const editor = readFileSync(new URL('../src/pages/commands-page.tsx', import.meta.url), 'utf8');
  assert.match(editor, /JSON.stringify\(\{ variants, args: PREVIEW_VALUES, format/);
  assert.doesNotMatch(editor, /sampleReply|raw.split\('\|'\)/);
  assert.match(editor, /weighted.resample/);
  assert.match(editor, /WeightedTemplateEditor items=\{variants\}/);
  assert.match(editor, /validWeights\(variants\)/);
  assert.match(editor, /j.data\?\.templateVersion !== 1/);
  assert.match(editor, /if \(!supportsWeighted\)/);
  const persona = readFileSync(new URL('../src/components/persona/persona-manager.tsx', import.meta.url), 'utf8');
  assert.match(persona, /apiClient.put\('\/personas\/pool', \{ pool: next \}\)/);
  assert.match(persona, /activeRes.data.pool/);
  assert.match(persona, /setPool\(\[\]\); setRandomMode\(false\)/);
  for (const locale of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
    assert.deepEqual(Object.keys(weightedTemplates[locale]).sort(), Object.keys(weightedTemplates.en).sort());
    for (const value of Object.values(weightedTemplates[locale])) assert.ok(value.length);
  }
});
