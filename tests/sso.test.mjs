import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { panelBase, isHttpsPanel, ssoProviderLogo, ssoStartUrl, takeSsoResult } from '../.test-dist/lib/sso.js';

test('BDC login uses the bundled official icon without replacing custom OIDC logos', () => {
  for (const logo of ['', 'https://example.invalid/old-bdc.svg']) {
    assert.equal(ssoProviderLogo({ kind: 'bdc', logo }), './icons/dicezone-account.svg');
  }
  assert.equal(ssoProviderLogo({ kind: 'oidc', logo: '/api/provider-logo/1' }), '/api/provider-logo/1');
  assert.equal(ssoProviderLogo({ kind: 'oidc', logo: '' }), '');
});

test('the official BDC icon is available locally without executable or external SVG content', async () => {
  // Original artwork: https://account.dice.zone/favicon.svg
  const svg = await readFile(new URL('../public/icons/dicezone-account.svg', import.meta.url), 'utf8');
  assert.match(svg, /viewBox="0 0 163\.21 144\.61"/);
  assert.equal((svg.match(/<polygon\b/g) || []).length, 10);
  assert.doesNotMatch(svg, /<script\b|<foreignObject\b|\bon\w+\s*=|(?:href|url)\s*[=(]/i);
});

function withWindow(location, run) {
  const previous = globalThis.window;
  const replacements = [];
  globalThis.window = {
    location,
    history: { replaceState: (...args) => replacements.push(args[2]) },
  };
  try { return run(replacements); }
  finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
}

test('SSO panel bases retain reverse-proxy prefixes without index.html or trailing slashes', () => {
  assert.equal(panelBase({ origin: 'https://dice.example', pathname: '/' }), 'https://dice.example');
  assert.equal(panelBase({ origin: 'https://dice.example', pathname: '/bot/index.html' }), 'https://dice.example/bot');
  assert.equal(panelBase({ origin: 'https://dice.example', pathname: '/bot///' }), 'https://dice.example/bot');
  assert.equal(isHttpsPanel({ protocol: 'https:' }), true);
  assert.equal(isHttpsPanel({ protocol: 'http:' }), false);
  assert.equal(isHttpsPanel({}), false);
});

test('SSO login and binding encode provider names and the actual panel base independently', () => {
  withWindow({ origin: 'https://dice.example', pathname: '/bot/index.html' }, () => {
    for (const purpose of ['login', 'bind']) {
      const url = new URL(ssoStartUrl('example&purpose=bind', purpose), 'https://dice.example');
      assert.equal(url.pathname, purpose === 'bind' ? '/api/auth/sso/bind/start' : '/api/auth/sso/start');
      assert.equal(url.searchParams.get('provider'), 'example&purpose=bind');
      assert.equal(url.searchParams.get('base'), 'https://dice.example/bot');
      assert.equal(url.searchParams.has('purpose'), false);
      assert.equal([...url.searchParams].length, 2);
    }
  });
});

test('SSO callback errors are translated and removed without losing unrelated query or hash', () => {
  withWindow({ pathname: '/bot/', search: '?keep=1&sso_error=forbidden', hash: '#/webui-settings' }, replacements => {
    const result = takeSsoResult();
    assert.equal(result.error, 'sso.error_forbidden');
    assert.equal(result.done, undefined);
    assert.deepEqual(replacements, ['/bot/?keep=1#/webui-settings']);
  });
});

test('SSO callback success is consumed and arbitrary error text never becomes a translation key', () => {
  withWindow({ pathname: '/', search: '?sso=bound&sso_error=untrusted-text', hash: '' }, replacements => {
    const result = takeSsoResult();
    assert.equal(result.done, 'bound');
    assert.equal(result.error, 'sso.error_provider');
    assert.deepEqual(replacements, ['/']);
  });
});

test('SSO callback handling is inert without a browser or SSO query parameters', () => {
  assert.deepEqual(takeSsoResult(), {});
  withWindow({ pathname: '/', search: '?keep=1', hash: '#/files' }, replacements => {
    assert.deepEqual(takeSsoResult(), {});
    assert.deepEqual(replacements, []);
  });
});
