import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { legacyTemplatePreviewArgs, readLegacyTextReport, legacyTextCounts, legacyTextIssue } from '../.test-dist/lib/legacy-templates.js';
import { legacyTemplates } from '../.test-dist/i18n/legacy-templates.js';
import { resolveOutcomeText } from '../.test-dist/lib/outcome-replies.js';

const row = (key, value = '', extra = {}) => ({ key, default: value, override: null, format: 'plain', defaultFormat: 'plain', ...extra });
const standard = row('dice.outcome.standard.regular', '', { outcome: { family: 'standard', grade: 'regular' }, fallbackKeys: ['dice.check.result'] });
const index = (...texts) => new Map(texts.map(text => [text.key, text]));
const labels = { critical: 'CRIT', extreme: 'EXTREME', hard: 'HARD', regular: 'PASS', failure: 'FAIL', fumble: 'FUMBLE' };

test('legacy preview keeps SAN rank/detail and growth labels separate from native arguments', () => {
  const base = { nick: 'A', result: '42', res: '42', reason: 'example' };
  assert.equal(legacyTemplatePreviewArgs(base, 'card.sc.result', labels), base);
  const san = legacyTemplatePreviewArgs(base, 'dice.compat.sanity.result', labels);
  assert.equal(san.rank, '2'); assert.equal(san.res, '1D100=50/60'); assert.equal(san.loss, '0');
  const fumble = legacyTemplatePreviewArgs(base, 'dice.compat.sanity.result', labels, { family: 'sanity', grade: 'fumble' });
  assert.equal(fumble.rank, '0'); assert.equal(fumble.loss, '6'); assert.equal(fumble.final, '54');
  assert.equal(fumble.change, 'Max{1d6}=6');
  const unchanged = legacyTemplatePreviewArgs(base, 'dice.compat.growth.unchanged', labels);
  assert.equal(unchanged.res, '1D100=42/60 FAIL'); assert.equal(unchanged.change, ''); assert.equal(unchanged.final, '60');
  const growth = legacyTemplatePreviewArgs(base, 'dice.compat.growth.success', labels);
  assert.equal(growth.res, '1D100=70/60 PASS'); assert.equal(growth.final, '65');
  assert.equal(legacyTemplatePreviewArgs(base, 'dice.compat.check.single.hard', labels).result, '25');
});

test('inherited check preview activates legacy slots only when configured, retaining full-template precedence', () => {
  const native = row('dice.check.result', 'NATIVE {roll} {level}');
  const prefix = row('dice.compat.check.prefix', 'DEFAULT');
  const single = row('dice.compat.check.single.regular', 'PASS');
  assert.equal(resolveOutcomeText(standard, index(native, prefix, single)).key, native.key);
  const configured = { ...prefix, override: 'OLD' };
  const inherited = resolveOutcomeText(standard, index(native, configured, { ...single, override: 'SINGLE' }));
  assert.equal(inherited.key, prefix.key);
  assert.equal(inherited.value, '{text:dice.compat.check.prefix}{roll}/{rate} {text:dice.compat.check.single.regular}');
  assert.equal(resolveOutcomeText(standard, index({ ...native, override: 'EXPLICIT' }, configured)).value, 'EXPLICIT');
  assert.equal(resolveOutcomeText({ ...standard, override: 'NEW' }, index(native, configured)).value, 'NEW');
  const persona = { [prefix.key]: { value: 'PERSONA', format: 'markdown' } };
  assert.equal(resolveOutcomeText(standard, index(native, configured), persona).layer, 'persona');
  assert.equal(resolveOutcomeText(standard, index(native, configured), persona).format, 'markdown');
});

test('SAN/growth inherit their enabled compatibility templates without borrowing the standard legacy format', () => {
  const san = row('dice.outcome.sanity.regular', '', { outcome: { family: 'sanity', grade: 'regular' }, fallbackKeys: [standard.key, 'card.sc.result'] });
  const sanNative = row('card.sc.result', 'native'), noLoss = row('card.sc.result_noloss', 'native zero');
  const sanCompat = row('dice.compat.sanity.result', 'default old', { override: 'OLD SAN' });
  assert.equal(resolveOutcomeText(san, index(standard, sanNative, noLoss, sanCompat)).value, 'OLD SAN');
  assert.equal(resolveOutcomeText(san, index(standard, sanNative, { ...noLoss, override: 'EXPLICIT' }, sanCompat)).value, 'EXPLICIT');
  assert.equal(resolveOutcomeText(san, index({ ...standard, override: 'STANDARD' }, sanNative, sanCompat)).value, 'STANDARD');
  const growth = row('dice.outcome.growth.failure', '', { outcome: { family: 'growth', grade: 'failure' }, fallbackKeys: [standard.key, 'card.en.fail'] });
  const growthNative = row('card.en.fail', 'native'), base = row('dice.compat.growth.base', 'base', { override: 'OLD' });
  const branch = row('dice.compat.growth.unchanged', '{strEnRoll}');
  assert.equal(resolveOutcomeText(growth, index(standard, growthNative, base, branch)).key, branch.key);
  assert.equal(resolveOutcomeText(growth, index(standard, { ...growthNative, override: '' }, base, branch)).value, '');
});

test('reports safely distinguish all four statuses and retain locale/persona details', () => {
  assert.equal(readLegacyTextReport(undefined), null);
  assert.equal(readLegacyTextReport({ items: 'wrong' }), null);
  const report = readLegacyTextReport({ appliedAt: 'time', items: [
    ...['active', 'partial', 'preserved', 'conflict'].map(status => ({ source: 'old', target: 'new', status, issues: ['issue', 7], locale: 'zh-Hans', personaId: 42 })),
    { source: 'bad', target: 'bad', status: 'unknown' }, null,
  ] });
  assert.equal(report.items.length, 4); assert.equal(report.appliedAt, 'time');
  assert.deepEqual(legacyTextCounts(report.items), { active: 1, partial: 1, preserved: 1, conflict: 1 });
  assert.deepEqual(report.items[0].issues, ['issue']); assert.equal(report.items[0].personaId, 42);
  assert.deepEqual(readLegacyTextReport([]), { items: [] });
  assert.deepEqual(legacyTextIssue('unsupported macro: js'), { key: 'unsupported', detail: 'js' });
  assert.deepEqual(legacyTextIssue('unavailable condition field: rank'), { key: 'condition', detail: 'rank' });
  assert.equal(legacyTextIssue('unexpected issue').key, 'other');
});

test('localized copy and real editor/report wiring stay complete', () => {
  const leaves = value => Object.entries(value).flatMap(([key, item]) => typeof item === 'string' ? [key] : leaves(item).map(name => key + '.' + name)).sort();
  for (const language of ['zh-Hans', 'zh-Hant', 'en', 'ja']) assert.deepEqual(leaves(legacyTemplates[language]), leaves(legacyTemplates.en));
  const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const editor = read('src/pages/commands-page.tsx');
  assert.match(editor, /locale: lang, personaId/); assert.match(editor, /reply\.legacyReferences/);
  assert.match(editor, /reply\.legacyCompatibility \? \[\]/); assert.match(editor, /legacyTemplatePreviewArgs/);
  const backup = read('src/pages/backup-page.tsx');
  assert.match(backup, /readLegacyTextReport\(d.customTextDetails\)/);
  assert.match(backup, /legacy\/texts\/upgrade-report/); assert.match(backup, /controller.abort\(\)/);
  assert.match(read('src/components/persona/legacy-text-report.tsx'), /report.items.slice\(0, 100\)/);
});

test('actual report renders localized statuses, escapes original names and limits the visible list', async () => {
  const compiled = await build({
    stdin: { contents: [
      "import React from 'react';",
      "import { renderToStaticMarkup } from 'react-dom/server';",
      "import { I18nextProvider } from 'react-i18next';",
      "import { createInstance } from 'i18next';",
      "import { LegacyTextReport } from './src/components/persona/legacy-text-report';",
      "import { legacyTemplates } from './src/i18n/legacy-templates';",
      "export const render = (report, language) => {",
      " const i18n = createInstance();",
      " i18n.init({ lng: language, initImmediate: false, resources: { [language]: { translation: { legacy_text: legacyTemplates[language], common: { feature_help: '{{title}} help' } } } } });",
      " return renderToStaticMarkup(React.createElement(I18nextProvider, { i18n }, React.createElement(LegacyTextReport, { report, historical: true, onDownload: () => {} })));",
      "};",
    ].join('\n'), resolveDir: fileURLToPath(new URL('../', import.meta.url)) },
    alias: { '@': fileURLToPath(new URL('../src/', import.meta.url)) },
    bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const items = Array.from({ length: 101 }, (_, i) => ({ source: i === 100 ? 'HIDDEN' : '<script>x</script>',
    target: 'new', status: ['active', 'partial', 'preserved', 'conflict'][i % 4], issues: ['unsupported macro: js'], locale: 'zh-Hans', personaId: 42 }));
  for (const language of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
    const html = module.exports.render({ appliedAt: 'time', items }, language);
    assert.ok(html.includes(legacyTemplates[language].upgrade_title));
    for (const status of Object.values(legacyTemplates[language].statuses)) assert.ok(html.includes(status));
    assert.ok(!html.includes('legacy_text.'));
    assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('HIDDEN')); assert.ok(html.includes('aria-haspopup="dialog"'));
  }
});

test('production backend preview resolves nested legacy references after one weighted draw', { skip: !process.env.DICENEXT_TEST_RENDERER }, () => {
  const input = {
    variants: [{ text: 'NEVER', weight: 0 }, { text: '{sample:{grade:rank?2={strSuccess}&0=FAIL}|{strSuccess}} {nick}', weight: 1 }],
    locale: 'zh-Hant', args: { rank: '2', nick: '{case:loss?0=literal&else=no}' },
    referenceOverrides: { 'dice.level.regular': { value: 'PASS', format: 'plain' } }, format: 'plain',
  };
  const output = spawnSync(process.env.DICENEXT_TEST_RENDERER, [], { input: JSON.stringify(input), encoding: 'utf8', timeout: 5000 });
  assert.equal(output.status, 0, output.stderr);
  const result = JSON.parse(output.stdout);
  assert.equal(result.code, 0);
  assert.equal(result.data.onebot, 'PASS {case:loss?0=literal&else=no}');
  assert.equal(result.data.markdown, result.data.onebot);
});
