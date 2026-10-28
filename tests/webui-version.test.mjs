import assert from 'node:assert/strict';
import test from 'node:test';
import { panelRoot, validWebuiState, webuiTarget } from '../.test-dist/lib/webui-version.js';
import { panelBase } from '../.test-dist/lib/sso.js';
import { webuiVersionsCopy } from '../.test-dist/i18n/webui-versions.js';
test('UI switching retains hash, origin scope, query and reverse proxy prefix', () => {
  for (const pathname of ['/v1/', '/v2/index.html', '/']) {
    assert.equal(webuiTarget('v2', false, { pathname, search: '?sso=bound', hash: '#/webui-settings?focus=webui-version' }),
      '/v2/?sso=bound#/webui-settings?focus=webui-version');
  }
  assert.equal(panelRoot('/dice/my-bot/v1/index.html'), '/dice/my-bot');
  assert.equal(webuiTarget('v1', false, { pathname: '/dice/my-bot/v2/', search: '', hash: '#/groups' }), '/dice/my-bot/v1/#/groups');
  assert.equal(webuiTarget('v1', true, { pathname: '/index.html', search: '', hash: '#/settings' }), '/#/settings');
  assert.throws(() => webuiTarget('https://evil.test', false, { pathname: '/', search: '', hash: '' }));
});
test('SSO callbacks remain at the instance root in either UI', () => {
  for (const version of ['v1', 'v2'])
    assert.equal(panelBase({ origin: 'https://dice.test', pathname: `/dice/${version}/` }), 'https://dice.test/dice');
});
test('unknown backend schemas fail closed rather than crashing the settings page', () => {
  for (const value of [null, {}, [], { selected: 'v2' }, { selected: 'v2', effective: 'v2', legacy: false, available: { v1: 1, v2: true } }])
    assert.equal(validWebuiState(value), false);
  assert.equal(validWebuiState({ selected: 'v2', effective: 'v1', legacy: false, available: { v1: true, v2: false } }), true);
});
test('both versions and preview warning have translations in every language', () => {
  for (const copy of Object.values(webuiVersionsCopy)) {
    assert.deepEqual(Object.keys(copy), Object.keys(webuiVersionsCopy.en));
    for (const value of Object.values(copy)) assert.ok(value.trim());
    assert.ok(copy.v2.includes('V2'));
  }
});
