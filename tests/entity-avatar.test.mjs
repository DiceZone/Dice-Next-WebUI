import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
function load(path, modules) {
  const module = { exports: {} };
  const code = ts.transpileModule(source(path), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: id => {
    assert.ok(id in modules, id); return modules[id];
  } });
  return module.exports;
}
function harness() {
  let failedSource;
  const platform = load('components/platform-icon.tsx', { '@/lib/utils': {}, 'react/jsx-runtime': {} });
  return load('components/entity-avatar.tsx', {
    react: { useState: () => [failedSource, value => { failedSource = value; }] },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'lucide-react': { UserRound: 'user-fallback', Users2: 'group-fallback' },
    '@/components/platform-icon': platform,
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
  });
}
test('QQ user and group avatars support all OneBot aliases and Milky consistently', () => {
  const { entityAvatarSource } = harness();
  for (const platform of ['onebot_v11', 'qq', 'onebot', 'onebot11', 'onebot-v11', ' QQ ', 'milky']) {
    assert.equal(entityAvatarSource({ kind: 'user', id: '123456', platform }), 'https://q1.qlogo.cn/g?b=qq&nk=123456&s=100');
    assert.equal(entityAvatarSource({ kind: 'group', id: '987654', platform }), 'https://p.qlogo.cn/gh/987654/987654/100');
  }
});
test('avatars never guess a QQ number from virtual identities, OpenIDs or unrelated platforms', () => {
  const { entityAvatarSource, EntityAvatar } = harness();
  for (const props of [
    { id: '123456', platform: 'onebot_v11', virtualId: true },
    { id: '123456', platform: 'qq_official' }, { id: '123456', platform: 'discord' },
    { id: 'demo-user', platform: 'onebot_v11' }, { id: '0', platform: 'onebot_v11' },
    { id: '123?query', platform: 'milky' },
  ]) {
    assert.equal(entityAvatarSource({ kind: 'user', ...props }), undefined);
    assert.equal(EntityAvatar({ kind: 'user', ...props }).props.children.type, 'user-fallback');
  }
});
test('network failures show a visible fallback and do not hide a later entity avatar', () => {
  const { EntityAvatar } = harness();
  const props = { kind: 'group', id: '123456', platform: 'onebot_v11' };
  let node = EntityAvatar(props);
  assert.equal(node.props.children.type, 'img');
  assert.equal(node.props.children.props.loading, 'lazy');
  assert.equal(node.props.children.props.referrerPolicy, 'no-referrer');
  node.props.children.props.onError();
  assert.equal(EntityAvatar(props).props.children.type, 'group-fallback');
  node = EntityAvatar({ ...props, id: '987654' });
  assert.equal(node.props.children.type, 'img');
  assert.match(node.props.children.props.src, /987654\/987654/);
});
test('user lists and details share the same avatar; every group view uses the shared wrapper', () => {
  const players = source('pages/players-page.tsx'), groups = source('pages/groups-page.tsx');
  assert.equal((players.match(/<EntityAvatar kind="user"/g) || []).length, 3);
  assert.equal((groups.match(/<GroupAvatar /g) || []).length, 4);
  assert.match(groups, /<EntityAvatar kind="group"/);
  assert.equal(players.includes("style.display = 'none'"), false);
  const tableAvatar = groups.slice(groups.indexOf('<td data-label={t(\'groups.col_avatar\')}'), groups.indexOf('<td data-label={t(\'groups.col_group\')}'));
  assert.match(tableAvatar, /<GroupAvatar /);
  assert.equal(tableAvatar.includes('<img'), false);
});
