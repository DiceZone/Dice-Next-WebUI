import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequestGate } from '../.test-dist/lib/request-gate.js';
import { readServerListPage, serverListUrl } from '../.test-dist/lib/server-list-page.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { resolve, reject, promise }; };
const flush = async () => { for (let i=0; i<12; i++) await Promise.resolve(); };
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value?.props ? [value, ...nodes(value.props.children)] : [];
const page = (number=1, total=2507, size=20) => ({ page: number, total, size, items: Array.from({ length: Math.max(0, Math.min(size, total-(number-1)*size)) }, (_, i) => ({
  code: `session-${(number-1)*size+i}`, name: `团务 ${(number-1)*size+i}`, groups: ['10001'], gms: ['gm'], players: ['player'], createdAt: '',
  logCount: 0, activeLogs: 0, pausedLogs: 0, endedLogs: 0, active: true,
})) });

// Execute the real hook and page with deterministic React slots and deferred API
// responses. No browser, live database, adapter or outbound bot message is used.
function harness() {
  const slots=[], effects=[], requests=[], timers=new Map();
  let cursor=0, clock=0, tree=[], touring=false, writes=0;
  const same = (a,b) => a?.length === b.length && b.every((value,i) => Object.is(a[i],value));
  const memo = (fn,deps) => { const i=cursor++; if (!same(slots[i]?.deps,deps)) slots[i]={ value:fn(),deps }; return slots[i].value; };
  const react = {
    useState(initial) {
      const i=cursor++;
      if (!slots[i]) { const slot={ value:typeof initial==='function' ? initial() : initial }; slot.set=next => { writes++; slot.value=typeof next==='function' ? next(slot.value) : next; }; slots[i]=slot; }
      return [slots[i].value,slots[i].set];
    },
    useRef(initial) { const i=cursor++; return slots[i] ??= { current:initial }; },
    useCallback:(fn,deps) => memo(() => fn,deps),
    useEffect(fn,deps) { const i=cursor++; if (!same(slots[i]?.deps,deps)) { const previous=slots[i]; const slot={ deps }; slots[i]=slot; effects.push(() => { previous?.cleanup?.(); slot.cleanup=fn(); }); } },
  };
  const jsx=(type,props) => ({ type,props });
  const modules = {
    react, 'react/jsx-runtime':{ jsx,jsxs:jsx },
    '@/lib/request-gate':{ createRequestGate }, '@/lib/server-list-page':{ readServerListPage,serverListUrl },
    '@/lib/api-client':{ apiClient:{ get:url => { const request=deferred(); requests.push({ url,...request }); return request.promise; } } },
    '@/components/onboarding/tour-data':{ useTourActive:() => touring, useTourValue:(live,sample) => touring ? sample : live, useTourState:(initial,sample) => { const [live,set]=react.useState(initial); return [touring ? sample : live,set]; } },
    '@/lib/tour-samples':{ tourSamples:{ gameLogs:[],sessions:page(1,2).items } },
    'react-i18next':{ useTranslation:() => ({ t:key => key }) },
    '@/hooks/use-toast':{ useToast:() => () => {} },
    '@/hooks/use-dialogs':{ useDialogs:() => ({ confirm:async () => true,node:null }) },
    'lucide-react':Object.fromEntries(['ArrowDown','ArrowUp','ArrowUpDown','CircleStop','Loader2','RefreshCw','Scroll','Search','ScrollText','UsersRound'].map(name => [name,name])),
  };
  const stubs={ button:['Button'],tabs:['Tabs','TabsContent','TabsList','TabsTrigger'],state:['LoadingState'],
    'log-action-buttons':['LogActionButtons'],'page-header':['PageHeader'],'feature-help':['FeatureHelp'],
    'pagination-bar':['PaginationBar'],select:['Select','SelectTrigger','SelectValue','SelectContent','SelectItem'] };
  const load = name => {
    const module={ exports:{} };
    const code=ts.transpileModule(readFileSync(new URL(`../src/${name}`,import.meta.url),'utf8'), { compilerOptions:{ target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext(code, { module,exports:module.exports,URLSearchParams,window:{
      setTimeout(fn,ms) { assert.equal(ms,300); const id=++clock; timers.set(id,fn); return id; },clearTimeout:id => timers.delete(id),
    },require:name => {
      if (modules[name]) return modules[name];
      const names=stubs[name.split('/').at(-1)];
      if (names) return Object.fromEntries(names.map(name => [name,name]));
      throw new Error(`Unexpected import ${name}`);
    } });
    return module.exports;
  };
  modules['@/hooks/use-server-list-page']=load('hooks/use-server-list-page.ts');
  const component=load('pages/logs-page.tsx');
  return {
    requests,timers,
    renderHook(url) { cursor=0; const view=modules['@/hooks/use-server-list-page'].useServerListPage(url); effects.splice(0).forEach(run => run()); return view; },
    render() { cursor=0; tree=nodes(component.LogsPage()); effects.splice(0).forEach(run => run()); return tree; },
    section(value) { return nodes(tree.find(node => node.type==='TabsContent' && node.props.value===value)); },
    pager(value) { return this.section(value).find(node => node.type==='PaginationBar'); },
    search(value) { tree.find(node => node.type==='input').props.onChange({ target:{ value } }); this.render(); },
    debounce() { const callbacks=[...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); this.render(); },
    tour(value) { touring=value; },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
    get writes() { return writes; },
  };
}

test('list URLs always ask for a bounded page and encode literal global search and sorting', () => {
  const url=new URL(serverListUrl('/game-sessions',64,20," 调查_%'\\ ",'name','asc'),'https://fixture.invalid');
  assert.equal(url.pathname,'/game-sessions');
  assert.deepEqual(Object.fromEntries(url.searchParams),{ page:'64',size:'20',sort:'name',dir:'asc',q:"调查_%'\\" });
  assert.equal(new URL(serverListUrl('/logs',1,20,'  ','lastAt','desc'),'https://fixture.invalid').searchParams.has('q'),false);
});

test('malformed and old unpaginated results are errors, never silently fetch-all', () => {
  assert.deepEqual(readServerListPage(page()),page());
  for (const value of [null,[],{},{ ...page(),total:-1 },{ ...page(),page:0 },{ ...page(),size:101 },{ ...page(),size:2 },{ ...page(),total:2 },{ ...page(),total:NaN }])
    assert.throws(() => readServerListPage(value));
});

test('a late page cannot overwrite a newer request or clear its loading state', async () => {
  const h=harness(); h.renderHook('/game-sessions?page=1');
  const changing=h.renderHook('/game-sessions?page=2'); assert.equal(changing.loading,true);
  h.requests[0].resolve({ data:page(1) }); await flush();
  let view=h.renderHook('/game-sessions?page=2'); assert.equal(view.loading,true); assert.equal(view.data,null);
  h.requests[1].resolve({ data:page(2) }); await flush();
  view=h.renderHook('/game-sessions?page=2'); assert.equal(view.data.page,2); assert.equal(view.loading,false);
  h.unmount();
});

test('duplicate refreshes only accept the newest response; unmount discards pending writes', async () => {
  const h=harness(); let view=h.renderHook('/game-sessions?page=1');
  const refresh=view.load(); h.requests[1].resolve({ data:page(1,7) }); await refresh;
  h.requests[0].reject(new Error('old request')); await flush();
  view=h.renderHook('/game-sessions?page=1'); assert.equal(view.error,false); assert.equal(view.data.total,7);
  const pending=view.load(); h.unmount(); const writes=h.writes;
  h.requests[2].resolve({ data:page() }); await pending;
  assert.equal(h.writes,writes);
});

test('a malformed response offers retry without an automatic request loop', async () => {
  const h=harness(); h.renderHook('/game-sessions?page=1'); h.requests[0].resolve({ data:[] }); await flush();
  let view=h.renderHook('/game-sessions?page=1'); assert.equal(view.error,true); assert.equal(view.loading,false); assert.equal(h.requests.length,1);
  const retry=view.load(); h.requests[1].resolve({ data:page() }); await retry;
  view=h.renderHook('/game-sessions?page=1'); assert.equal(view.error,false); assert.equal(view.data.items.length,20); h.unmount();
});

test('an old operation callback cannot reload a previous selection or restart loading after unmount', async () => {
  const h=harness(); const old=h.renderHook('/game-sessions?page=1');
  h.renderHook('/game-sessions?page=2');
  await old.load(); assert.equal(h.requests.length,2);
  h.requests[1].resolve({ data:page(2) }); await flush();
  const current=h.renderHook('/game-sessions?page=2'); assert.equal(current.data.page,2);
  h.unmount(); const writes=h.writes;
  await current.load(); assert.equal(h.requests.length,2); assert.equal(h.writes,writes);
});

test('the real page renders only 20 of 2,507 sessions and preserves separate tab pagination', async () => {
  const h=harness(); h.render();
  assert.equal(h.requests.length,2);
  assert.match(h.requests[1].url,/^\/game-sessions\?page=1&size=20&sort=status&dir=desc$/);
  h.requests[0].resolve({ data:{ items:[],total:0,page:1,size:20 } });
  h.requests[1].resolve({ data:page() }); await flush(); h.render();
  assert.equal(h.section('sessions').filter(node => node.type==='article').length,20);
  assert.equal(h.pager('sessions').props.total,2507);
  h.pager('sessions').props.onPageChange(64); h.render();
  assert.equal(h.requests.length,3); assert.match(h.requests[2].url,/page=64/);
  assert.equal(h.pager('sessions').props.disabled,true);
  assert.equal(h.pager('logs'),undefined); // No fake log pages are generated from the session total.
  h.requests[2].resolve({ data:page(64) }); await flush(); h.render();
  assert.equal(h.pager('sessions').props.page,64);
  assert.equal(h.section('sessions').filter(node => node.type==='article').length,20); h.unmount();
});

test('debounced search and sorting go to the server and reset the session page', async () => {
  const h=harness(); h.render();
  h.requests[0].resolve({ data:{ items:[],total:0,page:1,size:20 } }); h.requests[1].resolve({ data:page() }); await flush(); h.render();
  h.pager('sessions').props.onPageChange(64); h.render();
  h.requests[2].resolve({ data:page(64) }); await flush(); h.render();
  h.search('秘密基地'); assert.equal(h.requests.length,3);
  h.debounce(); assert.equal(h.requests.length,5);
  const url=new URL(h.requests[4].url,'https://fixture.invalid'); assert.equal(url.searchParams.get('q'),'秘密基地'); assert.equal(url.searchParams.get('page'),'1');
  h.requests[3].resolve({ data:{ items:[],total:0,page:1,size:20 } }); h.requests[4].resolve({ data:page(1,1) }); await flush(); h.render();
  h.section('sessions').find(node => node.type==='Select').props.onValueChange('name'); h.render();
  assert.equal(h.requests.length,6); assert.match(h.requests[5].url,/sort=name/); h.unmount();
});

test('a clamped page after deleting the last record moves back and does not bounce to the old page', async () => {
  const h=harness(); h.render();
  h.requests[0].resolve({ data:{ items:[],total:0,page:1,size:20 } }); h.requests[1].resolve({ data:page(1,21) }); await flush(); h.render();
  h.pager('sessions').props.onPageChange(2); h.render();
  assert.equal(h.requests.length,3); // Old page-1 data must not reset page 2 before its request completes.
  h.requests[2].resolve({ data:page(1,20) }); await flush(); h.render(); h.render();
  assert.equal(h.pager('sessions').props.page,1); assert.match(h.requests[3].url,/page=1/);
  h.requests[3].resolve({ data:page(1,20) }); await flush(); h.render(); assert.equal(h.requests.length,4); h.unmount();
});

test('failure has an explicit retry state and is not misrepresented as no sessions', async () => {
  const h=harness(); h.render(); h.requests[0].resolve({ data:{ items:[],total:0,page:1,size:20 } }); h.requests[1].reject(new Error('offline')); await flush(); h.render();
  assert.ok(h.section('sessions').find(node => node.props.role==='alert'));
  const retry=h.section('sessions').find(node => node.type==='Button' && node.props.children==='common.retry');
  retry.props.onClick(); assert.equal(h.requests.length,3); h.unmount();
});

test('session controls use shared frontend pagination/select and all four locales have complete labels', () => {
  const source=readFileSync(new URL('../src/pages/logs-page.tsx',import.meta.url),'utf8');
  assert.ok(!source.includes('sessions.filter(')); assert.ok(!source.includes('getJson<GameSession[]>'));
  assert.ok(!/<select\b/.test(source)); assert.match(source,/<PaginationBar total=\{sessionTotal\}/);
  for (const language of ['zh-Hans','zh-Hant','en','ja']) {
    const copy=JSON.parse(readFileSync(new URL(`../src/i18n/locales/${language}.json`,import.meta.url),'utf8')).logs;
    for (const key of ['session_search_ph','session_name','sort_asc','sort_desc','no_matching_sessions']) assert.ok(copy[key]?.trim(),`${language}.${key}`);
  }
});
