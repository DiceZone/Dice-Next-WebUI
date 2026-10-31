import test from 'node:test';
import assert from 'node:assert/strict';
import { COC7R_OPTIONS, jsonToForm, formToJson } from '../.test-dist/lib/rule-pack-form.js';

test('native profile, help and future metadata survive editing', () => {
  const source = { name: 'coc7r', mechanics: 'keeper-companion-2026', options: { bases: false, specialties: false, take5: false, future: 3 },
    set: { keys: ['coc7r'], diceSides: 100, future: 'keep' },
    help: { coc7r: 'Usage' }, source: { pages: [22,94] }, custom: { nested: true },
    commands: { add: { helpme: { output: 'text', help: 'help' } }, future: true } };
  const form = jsonToForm(source);
  form.fullName = 'Test';
  form.options.take5 = true;
  const saved = formToJson(form);
  assert.equal(saved.mechanics, source.mechanics);
  assert.deepEqual(saved.help, source.help);
  assert.deepEqual(saved.source, source.source);
  assert.deepEqual(saved.custom, source.custom);
  assert.deepEqual(saved.options, { bases: false, specialties: false, take5: true, future: 3 });
  assert.equal(saved.set.future, 'keep');
  assert.equal(saved.commands.future, true);
  assert.deepEqual(saved.commands.add.helpme, { output: 'text', help: 'help' });
  assert.equal(source.options.take5, false);
});
test('deleting editable fields remains possible without deleting unknown metadata', () => {
  const form = jsonToForm({ name: 'old', alias: { x: ['y'] }, defaults: { x: 12 }, commands: { disable: ['ra'], future: 1 }, help: { x: 'help' } });
  form.alias = []; form.defaults = []; form.disableCmds = '';
  const saved = formToJson(form);
  assert.equal(saved.alias, undefined);
  assert.equal(saved.defaults, undefined);
  assert.deepEqual(saved.commands, { future: 1 });
  assert.deepEqual(saved.help, { x: 'help' });
});
test('every Keeper Companion module is a separate switch with the server defaults', () => {
  assert.deepEqual(Object.fromEntries(COC7R_OPTIONS), {
    creation: true, skills: true, movement: true, sanity: true, bases: false, specialties: false, take5: false });
  const form = jsonToForm({ name: 'coc7r', mechanics: 'keeper-companion-2026', options: { take5: true } });
  form.options.sanity = false;
  assert.deepEqual(formToJson(form).options, { take5: true, sanity: false });
});
