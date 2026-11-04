import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { commandMatches } from '../.test-dist/lib/command-text-catalog.js';

const rows = [
  { cmd: '.r', title: '掷骰', category: '掷骰', example: '.r 3d6', desc: '通用掷骰', replies: [{ key: 'dice.roll', default: '{nick} 掷出了 {result}', override: null }] },
  { cmd: '.sc', title: '理智检定', category: 'COC', example: '.sc 1/1d6', desc: 'SAN check', replies: [{ key: 'dice.sanity', default: '理智减少', override: '理智值下降了' }] },
  { cmd: '.log on/.log off', title: '日志', category: '团务', example: '.log on', desc: '跑团日志', replies: [] },
];

test('global command search spans every category and matches name, example, description and reply text', () => {
  const found = (query, label = '') => rows.filter((row) => commandMatches(row, query, label)).map((row) => row.cmd);
  assert.deepEqual(found('sc'), ['.sc']);
  assert.deepEqual(found('.sc'), ['.sc']);
  assert.deepEqual(found('san'), ['.sc']);
  assert.deepEqual(found('下降'), ['.sc']);         // current override text
  assert.deepEqual(found('dice.roll'), ['.r']);     // reply key
  assert.deepEqual(found('log off'), ['.log on/.log off']);
  assert.deepEqual(found('跑团 日志'), ['.log on/.log off']);
  assert.deepEqual(found('   '), rows.map((row) => row.cmd));
  assert.deepEqual(found('不存在的指令'), []);
  assert.equal(commandMatches(rows[1], 'call of cthulhu', 'Call of Cthulhu', 'en'), true);
});

test('the search box sits above the category tabs instead of only inside the all-text tab', () => {
  const page = readFileSync(new URL('../src/pages/commands-page.tsx', import.meta.url), 'utf8');
  const search = page.indexOf('data-testid="commands-global-search"');
  const tabs = page.indexOf('<Tabs value={cat}');
  assert.ok(search > 0 && search < tabs);
  assert.ok(page.includes('const shown = searching ? matchedRows'));
});
