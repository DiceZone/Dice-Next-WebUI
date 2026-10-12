import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { ApiError } from '../.test-dist/lib/api-client.js';
import { chooseLanAddress, fetchNetworkInfo, parseNetworkInfo, reverseWsAddress } from '../.test-dist/lib/network-info.js';
import { networkInfoCopy } from '../.test-dist/i18n/network-info.js';

const ready = (refreshing = false) => ({
  lan: { status: 'ready', addresses: ['192.168.1.8', '10.0.0.5'], stale: false, checked_at: 1234 },
  wan: { status: 'ready', addresses: ['203.0.113.8'], stale: false, checked_at: 1235 },
  refreshing, attempted_at: 1230,
});
const source = readFileSync(new URL('../src/hooks/use-server-network-info.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

// Execute the actual hook with deterministic hook slots, effects and timers.
// No DOM, server, WebRTC or real network is started by this fixture.
function harness() {
  const slots = [], effects = [], timers = new Map(), requests = [], pending = [];
  let index = 0, clock = 0, writes = 0, touring = false;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = index++;
      if (!slots[i]) { const slot = { value: initial }; slot.set = (value) => { writes++; slot.value = typeof value === 'function' ? value(slot.value) : value; }; slots[i] = slot; }
      return [slots[i].value, slots[i].set];
    },
    useRef(initial) { const i = index++; return slots[i] ??= { current: initial }; },
    useCallback(fn, deps) { const i = index++; if (!same(slots[i]?.deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) {
      const i = index++;
      if (!same(slots[i]?.deps, deps)) {
        const old = slots[i]; const slot = { deps }; slots[i] = slot;
        effects.push(() => { old?.cleanup?.(); slot.cleanup = fn(); });
      }
    },
  };
  const module = { exports: {} };
  const modules = {
    react,
    '@/components/onboarding/tour-data': { useTourActive: () => touring, useTourValue: (live, sample) => touring ? sample : live },
    '@/lib/api-client': { ApiError },
    '@/lib/network-info': { fetchNetworkInfo: (refresh = false) => { requests.push(refresh); const request = deferred(); pending.push(request); return request.promise; } },
  };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (name) => {
    assert.ok(modules[name], name); return modules[name];
  }, setTimeout: (fn, ms) => { assert.equal(ms, 1200); const id = ++clock; timers.set(id, fn); return id; }, clearTimeout: (id) => timers.delete(id) });
  return {
    requests, pending, timers,
    render() { index = 0; const view = module.exports.useServerNetworkInfo(); for (const effect of effects.splice(0)) effect(); return view; },
    poll() { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
    setTour(value) { touring = value; }, get writes() { return writes; },
  };
}
test('server LAN and WAN form separate valid URLs and invalid values cannot be copied as addresses', () => {
  const data = parseNetworkInfo(ready());
  assert.equal(reverseWsAddress(data.lan.addresses[0], '3002'), 'ws://192.168.1.8:3002');
  assert.equal(reverseWsAddress(data.wan.addresses[0], '3002'), 'ws://203.0.113.8:3002');
  assert.equal(reverseWsAddress('127.0.0.1', ' 03002 '), 'ws://127.0.0.1:3002');
  for (const port of ['0', '65536', '3002/path', '1e3', 'ws://x:3002']) assert.equal(reverseWsAddress('1.2.3.4', port), null);
  for (const ip of [undefined, '...', 'x.example', '0.0.0.0', '224.1.1.1', '255.255.255.255', '256.1.1.1', '1.2.3.04', '::1']) assert.equal(reverseWsAddress(ip, '3002'), null);
});
test('malformed metadata fails instead of yielding an indefinite spinner and stale addresses remain explicit', () => {
  for (const value of [null, '<html>old core</html>', {}, { ...ready(), refreshing: 'false' }, { ...ready(), wan: { status: 'unknown', addresses: [] } }])
    assert.throws(() => parseNetworkInfo(value));
  const value = ready(); value.wan.status = 'failed'; value.wan.stale = true;
  const data = parseNetworkInfo(value); assert.equal(data.wan.status, 'failed'); assert.equal(data.wan.stale, true);
  value.lan.addresses.push('192.168.1.8', '<script>', '1.2.3.4:88');
  assert.deepEqual(parseNetworkInfo(value).lan.addresses, ['192.168.1.8', '10.0.0.5']);
});
test('multi-interface selection survives cache refresh and falls back only when removed', () => {
  const data = ready(); assert.equal(chooseLanAddress(data, '10.0.0.5'), '10.0.0.5');
  assert.equal(chooseLanAddress(data, '10.9.9.9'), '192.168.1.8'); assert.equal(chooseLanAddress(null, '10.0.0.5'), '');
});
test('cache GET and manual refresh POST use only the authenticated server API', async () => {
  const oldFetch = globalThis.fetch, oldStorage = globalThis.localStorage, calls = [];
  globalThis.localStorage = { getItem: () => 'network-api-key-marker' };
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ code: 0, data: ready() }), { headers: { 'Content-Type': 'application/json' } }); };
  try {
    await fetchNetworkInfo(); await fetchNetworkInfo(true);
    assert.deepEqual(calls.map((c) => [c.url, c.options.method]), [['/api/system/network-info', 'GET'], ['/api/system/network-info/refresh', 'POST']]);
    for (const call of calls) { assert.equal(call.options.headers['X-API-Key'], 'network-api-key-marker'); assert.ok(call.options.signal); }
  } finally { globalThis.fetch = oldFetch; if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage; }
});
test('page prefetch caches ready results; repeated renders do not redetect', async () => {
  const h = harness(); h.render(); assert.deepEqual(h.requests, [false]);
  h.pending.shift().resolve(ready()); await flush();
  const view = h.render(); assert.equal(view.network.loading, false); assert.equal(view.network.data.wan.addresses[0], '203.0.113.8');
  h.render(); h.render(); assert.deepEqual(h.requests, [false]); assert.equal(h.timers.size, 0); h.unmount();
});
test('duplicate manual refreshes coalesce; polling reads cache and stops at completion', async () => {
  const h = harness(); h.render(); h.pending.shift().resolve(ready()); await flush();
  let view = h.render(); const a = view.refresh(), b = view.refresh();
  assert.deepEqual(h.requests, [false, true]); h.pending.shift().resolve(ready(true)); await Promise.all([a, b]); await flush();
  view = h.render(); assert.equal(view.network.data.refreshing, true); assert.equal(h.timers.size, 1);
  h.poll(); assert.deepEqual(h.requests, [false, true, false]);
  const updated = ready(); updated.wan.addresses[0] = '203.0.113.99'; h.pending.shift().resolve(updated); await flush();
  view = h.render(); assert.equal(view.network.data.wan.addresses[0], '203.0.113.99'); assert.equal(h.timers.size, 0); h.unmount();
});
test('failed cache polling clears loading and does not keep retrying forever', async () => {
  const h = harness(); h.render(); h.pending.shift().resolve(ready(true)); await flush(); h.render(); h.poll();
  h.pending.shift().reject(new ApiError(500, 'isolated failure')); await flush();
  const view = h.render(); assert.equal(view.network.loading, false); assert.equal(view.network.data, null);
  assert.equal(view.network.error, 'unavailable'); assert.equal(h.timers.size, 0); h.unmount();
});
test('old-core 404 is explicit and unmounted requests cannot update the view', async () => {
  const h = harness(); h.render(); h.pending.shift().reject(new ApiError(404, 'missing endpoint')); await flush();
  assert.equal(h.render().network.error, 'unsupported'); h.unmount();
  const ended = harness(); ended.render(); const before = ended.writes; ended.unmount(); ended.pending.shift().resolve(ready()); await flush();
  assert.equal(ended.writes, before);
});
test('onboarding projection never posts a real refresh or seeds live metadata', async () => {
  const h = harness(); h.render(); h.pending.shift().resolve(ready()); await flush(); h.setTour(true);
  const sample = h.render(); await sample.refresh(); assert.deepEqual(h.requests, [false]);
  assert.equal(sample.network.data.wan.addresses[0], '203.0.113.10'); h.setTour(false);
  assert.equal(h.render().network.data.wan.addresses[0], '203.0.113.8'); h.unmount();
});
test('all locales explain server cache, IPv4, NAT, refresh and failure without missing keys', () => {
  for (const copy of Object.values(networkInfoCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(networkInfoCopy.en).sort());
    for (const value of Object.values(copy)) assert.ok(value.trim());
    assert.ok(copy.help.includes('IPv4')); assert.ok(copy.help.includes('NAT')); assert.ok(copy.cached.includes('15'));
  }
});
test('dialog uses separate server values, styled controls and cannot copy placeholders', () => {
  const ui = readFileSync(new URL('../src/components/adapter/reverse-ws-info.tsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/pages/adapters-page.tsx', import.meta.url), 'utf8');
  assert.ok(!ui.includes('RTCPeerConnection')); assert.ok(!ui.includes('createOffer')); assert.ok(!ui.includes("setLanIp('...')"));
  assert.ok(ui.includes('network.data?.wan.addresses[0]')); assert.ok(ui.includes('chooseLanAddress(network.data, selectedLan)'));
  assert.ok(ui.includes('disabled={!addr}')); assert.ok(ui.includes('<Dialog open=')); assert.ok(ui.includes('<Select '));
  assert.ok(ui.includes('network_info.reading')); assert.ok(ui.includes('network_info.stale'));
  assert.ok(ui.includes('network_info.stale_label'));
  assert.ok(page.includes('void readNetworkCache()')); assert.ok(page.includes('15000'));
});
