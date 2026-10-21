import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { previewSimulation, readTemplateSimulation } from '../.test-dist/lib/template-simulation.js';

test('preview requests retain the original branch when inheriting and contain no invented numerical arguments', () => {
  const outcome = { family: 'sanity', grade: 'fumble' };
  const request = previewSimulation('dice.outcome.sanity.fumble', 'dice.outcome.standard.fumble', 0xffffffff, outcome);
  assert.deepEqual(request, { version: 1, key: 'dice.outcome.sanity.fumble', sourceKey: 'dice.outcome.standard.fumble', seed: 0xffffffff, outcome });
  assert.equal(previewSimulation('card.sc.result', 'card.sc.result', 0x100000000).seed, 0);
  assert.equal('args' in request, false);
  assert.deepEqual(outcome, { family: 'sanity', grade: 'fumble' });
});

test('old/malformed preview responses cannot silently appear as command-aware previews', () => {
  const simulation = { version: 1, seed: 17, command: '.sc 1/1d6 60', family: 'sanity', grade: 'failure',
    args: { loss: '3', final: '57' }, unresolved: [], issues: [] };
  assert.equal(readTemplateSimulation({ simulation }), simulation);
  for (const invalid of [undefined, {}, { templateVersion: 1 }, { simulation: { ...simulation, version: 0 } },
    { simulation: { ...simulation, seed: -1 } }, { simulation: { ...simulation, seed: 0x100000000 } },
    { simulation: { ...simulation, args: { loss: 3 } } }, { simulation: { ...simulation, unresolved: 'missing' } },
    { simulation: { ...simulation, issues: [1] } }]) assert.equal(readTemplateSimulation(invalid), null);
});

test('editor guards stale responses and shows example context and unresolved-variable warnings', () => {
  const source = readFileSync(new URL('../src/pages/commands-page.tsx', import.meta.url), 'utf8');
  assert.match(source, /AbortController/);
  assert.match(source, /controller.signal.aborted/);
  assert.match(source, /readTemplateSimulation\(j.data\)/);
  assert.match(source, /simulation.unresolved/);
  assert.match(source, /simulation.command/);
  assert.match(source, /simulation.issues/);
  assert.match(source, /preview_backend_required/);
  assert.doesNotMatch(source, /PREVIEW_VALUES|outcomePreviewArgs|legacyTemplatePreviewArgs/);
  for (const locale of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
    const { commands } = JSON.parse(readFileSync(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8'));
    for (const key of ['preview_scenario', 'preview_unresolved', 'preview_syntax', 'preview_backend_required']) assert.ok(commands[key]);
  }
});

const renderer = process.env.DICENEXT_TEST_RENDERER;
function render(key, extra = {}) {
  const simulation = previewSimulation(key, key, 17);
  const result = spawnSync(renderer, [], { input: JSON.stringify({ text: '{loss}/{san}/{final} {change} {s}/{f} {result}/{rate}',
    simulation, locale: 'zh-Hans', format: 'plain', ...extra }), encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.code, 0);
  assert.ok(readTemplateSimulation(output.data));
  return output.data;
}

test('real renderer fills original SAN/growth/death-save variables and obeys arithmetic', { skip: !renderer }, () => {
  for (const key of ['card.sc.result', 'card.sc.result_noloss', 'card.en.success', 'card.en.fail', 'card.en.fail_grow', 'dnd.ds.result']) {
    const data = render(key);
    assert.deepEqual(data.simulation.unresolved, [], key);
    assert.doesNotMatch(data.onebot, /\{(?:loss|san|final|change|s|f|result|rate)\}/);
    const a = data.simulation.args;
    if (key.startsWith('card.sc.')) assert.equal(Number(a.final), Number(a.san) - Number(a.loss));
    if (key === 'card.sc.result_noloss') assert.equal(a.loss, '0');
    if (key === 'card.en.success') assert.ok(Number(a.final) > Number(a.rate));
    if (key === 'card.en.fail') assert.equal(a.final, a.rate);
    if (key === 'card.en.fail_grow') assert.ok(Number(a.final) < Number(a.rate));
  }
});

test('real renderer preserves inherited family, grade, nested samples and platform-stable random choices', { skip: !renderer }, () => {
  const key = 'dice.outcome.sanity.fumble';
  const request = { variants: [{ text: 'NEVER', weight: 0 }, { text: '{sample:甲|{sample:乙|丙}} {loss} {final}', weight: 3 }],
    simulation: previewSimulation(key, 'dice.outcome.standard.fumble', 9, { family: 'sanity', grade: 'fumble' }) };
  const qq = render(key, request), plain = render(key, { ...request, platform: 'plain' });
  assert.equal(qq.simulation.family, 'sanity');
  assert.equal(qq.simulation.grade, 'fumble');
  assert.equal(qq.simulation.args.loss, '6');
  assert.equal(qq.simulation.args.final, '54');
  assert.equal(qq.onebot, plain.onebot);
  assert.deepEqual(qq.simulation.unresolved, []);
  assert.match(qq.onebot, /^[甲乙丙] 6 54$/);
  const unknown = render('card.sc.result', { text: '{loss} {not_a_variable}' });
  assert.deepEqual(unknown.simulation.unresolved, ['not_a_variable']);
  assert.ok(unknown.onebot.includes('{not_a_variable}'));
});
