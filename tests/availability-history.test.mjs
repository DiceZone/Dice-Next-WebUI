import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { buildOnlineDays, selectedOnlineDay, onlineState, onlineClock, ONLINE_BUCKET_MINUTES } from '../.test-dist/lib/availability-history.js';
import { availabilityCopy } from '../.test-dist/i18n/availability.js';
import { tourSamples } from '../.test-dist/lib/tour-samples.js';
import { statisticsPreview } from './statistics-preview-data.mjs';

const sample = (time, online = 2, total = 2) => ({ sampled_at: time, online_count: online, total_count: total });
const date = '2026-09-01';
test('empty and missing buckets stay gray instead of being fabricated as online or offline', () => {
  const [day] = buildOnlineDays([sample(date + 'T01:00:00Z')], [date], '1h');
  assert.equal(day.slots.length, 24);
  assert.equal(day.slots[0].state, 'unknown');
  assert.equal(day.slots[1].state, 'online');
  assert.equal(day.slots[2].sample, undefined);
  assert.equal(day.knownCount, 1);
  assert.equal(onlineState(sample(date + 'T02:00:00Z', 0, 0)), 'unknown');
  assert.equal(buildOnlineDays([], [date], '5m')[0].state, 'unknown');
});
test('mixed days are yellow while detailed buckets retain outages and changing adapter counts', () => {
  const [day] = buildOnlineDays([sample(date + 'T01:00:00Z'), sample(date + 'T01:05:00Z', 0), sample(date + 'T02:00:00Z', 1)], [date], '1h');
  assert.equal(day.state, 'partial');
  assert.equal(day.slots[1].state, 'offline');
  assert.equal(day.slots[2].state, 'partial');
  const [changing] = buildOnlineDays([sample(date + 'T01:00:00Z', 1, 1), sample(date + 'T01:05:00Z', 2, 2)], [date], '1h');
  assert.equal(changing.slots[1].state, 'partial');
});
test('daily colors distinguish all-online, all-offline, mixed and partially-online observations', () => {
  for (const granularity of ['5m', '1h', '6h']) {
    const rows = Array.from({ length: 24 * 60 / ONLINE_BUCKET_MINUTES[granularity] }, (_, index) =>
      sample(new Date(Date.parse(date + 'T00:00:00Z') + index * ONLINE_BUCKET_MINUTES[granularity] * 60_000).toISOString()));
    const summarize = values => buildOnlineDays(values, [date], granularity)[0];
    assert.equal(summarize(rows).state, 'online');
    assert.equal(summarize(rows.map(row => ({ ...row, online_count: 0 }))).state, 'offline');
    const mixed = rows.map((row, index) => ({ ...row, online_count: index === 0 ? 0 : 2 }));
    assert.equal(summarize(mixed).state, 'partial');
    assert.equal(summarize([...mixed].reverse()).state, 'partial');
    assert.equal(summarize(rows.map(row => ({ ...row, online_count: 1 }))).state, 'partial');
    assert.equal(summarize(rows.map((row, index) => ({ ...row, online_count: index === 0 ? 1 : 0 }))).state, 'partial');
    // Missing observations must not be counted as online or offline.
    assert.equal(summarize([rows[0]]).state, 'online');
    assert.equal(summarize([{ ...rows[0], online_count: 0 }]).state, 'offline');
    assert.equal(summarize([{ ...rows[0], online_count: 0, total_count: 0 }]).state, 'unknown');
    assert.equal(summarize([]).state, 'unknown');
  }
});
test('server timezone boundaries include late UTC samples in the correct local day', () => {
  const [day] = buildOnlineDays([sample('2026-08-31T16:00:00Z'), sample('2026-09-01T15:55:00Z', 0), sample('2026-09-01T16:00:00Z', 1)], [date], '5m', 480);
  assert.equal(day.slots.length, 288);
  assert.equal(day.slots[0].state, 'online');
  assert.equal(day.slots.at(-1).state, 'offline');
  assert.equal(day.knownCount, 2);
  assert.equal(onlineClock(day.slots[0].start, 480), '00:00');
  assert.equal(onlineClock(day.slots.at(-1).end, 480), '00:00');
});
test('fractional-hour offsets and coarse UTC buckets are clipped, not shifted or invented', () => {
  const [day] = buildOnlineDays([sample('2026-08-31T18:00:00Z'), sample('2026-08-31T19:00:00Z', 0)], [date], '1h', 330);
  assert.equal(day.slots.length, 25);
  assert.equal(day.slots[0].end - day.slots[0].start, 30 * 60_000);
  assert.equal(onlineClock(day.slots[1].start, 330), '00:30');
  assert.equal(day.slots[1].state, 'offline');
  assert.equal(day.slots.reduce((sum, slot) => sum + slot.end - slot.start, 0), 86_400_000);
  assert.equal(buildOnlineDays([sample('2026-08-31T00:00:00Z')], [date], '1d', 480)[0].slots.length, 2);
});
test('invalid records and dates are ignored, dates are deduplicated and source arrays are not mutated', () => {
  const rows = [sample('invalid'), sample(date + 'T01:00:00Z', -1), sample(date + 'T02:00:00Z', 3), sample(date + 'T03:00:00', 1)];
  const original = structuredClone(rows);
  const days = buildOnlineDays(rows, [date, 'bad', '2026-02-30', date], '1h');
  assert.equal(days.length, 1);
  assert.equal(days[0].knownCount, 1);
  assert.equal(days[0].slots[3].state, 'partial');
  assert.deepEqual(rows, original);
});
test('current coarse buckets do not paint their future hours as already online', () => {
  const now = Date.parse(date + 'T12:30:00Z');
  const [day] = buildOnlineDays([sample(date + 'T00:00:00Z')], [date], '1d', 0, now);
  assert.equal(day.slots.length, 2);
  assert.equal(day.slots[0].state, 'online');
  assert.equal(day.slots[0].end, now);
  assert.equal(day.slots[1].start, now);
  assert.equal(day.slots[1].state, 'unknown');
  assert.equal(day.slots[1].sample, undefined);
  assert.equal(day.slots.reduce((sum, slot) => sum + slot.end - slot.start, 0), 86_400_000);
});
test('selection survives refreshes, falls back after scope changes, and works without any collected data', () => {
  const days = buildOnlineDays([sample(date + 'T01:00:00Z')], ['2026-08-31', date, '2026-09-02'], '1h');
  assert.equal(selectedOnlineDay(days, null).date, date);
  assert.equal(selectedOnlineDay(days, '2026-08-31').date, '2026-08-31');
  assert.equal(selectedOnlineDay(days, 'unavailable').date, date);
  assert.equal(selectedOnlineDay(buildOnlineDays([], [date], '1h'), null).date, date);
  assert.equal(selectedOnlineDay([], null), undefined);
});
test('preview examples cover all four colors and honor range, scope and actual granularity', () => {
  for (const days of [7, 30, 90]) {
    const preview = statisticsPreview(tourSamples.statistics, new URLSearchParams({ days, granularity: '5m' }));
    assert.equal(preview.daily_usage.length, days);
    assert.equal(preview.filters.granularity, days === 7 ? '5m' : '1h');
    const dayRows = buildOnlineDays(preview.online_history, preview.daily_usage.map(row => row.date), preview.filters.granularity, 480);
    assert.deepEqual(new Set(dayRows.at(-1).slots.map(slot => slot.state)), new Set(['online', 'partial', 'offline', 'unknown']));
    assert.ok(dayRows.at(-1).knownCount < dayRows.at(-1).slots.length);
    assert.equal(preview.summary.total_commands, preview.daily_usage.reduce((sum, row) => sum + row.commands, 0));
  }
  const scoped = statisticsPreview(tourSamples.statistics, new URLSearchParams({ days: 7, adapter: 'demo-adapter-kook', granularity: '5m' }));
  assert.equal(scoped.summary.adapter_total, 1);
  assert.ok(scoped.online_history.every(row => row.total_count === 1));
  assert.equal(ONLINE_BUCKET_MINUTES[scoped.filters.granularity], 5);
});

const source = readFileSync(new URL('../src/components/statistics/availability-history.tsx', import.meta.url), 'utf8');
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object') return [];
  return [value, ...nodes(value.props?.children)];
}
function harness() {
  const exports = {};
  const states = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  const colors = JSON.parse(readFileSync(new URL('../src/i18n/locales/zh-Hans.json', import.meta.url), 'utf8')).statistics;
  const t = (key, variables = {}) => {
    let text = key.startsWith('availability.') ? availabilityCopy['zh-Hans'][key.slice(13)] : colors[key.slice(11)];
    text ??= key;
    return text.replace(/{{(\w+)}}/g, (_, name) => variables[name] ?? '');
  };
  const lib = { buildOnlineDays, selectedOnlineDay, onlineClock };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require: path => {
      if (path === 'react') return { useMemo: fn => fn(), useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], next => { states[index] = next; }]; } };
      if (path === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (path === 'react-i18next') return { useTranslation: () => ({ t }) };
      if (path === 'lucide-react') return { CalendarDays: 'CalendarDays', ChevronLeft: 'ChevronLeft', ChevronRight: 'ChevronRight' };
      if (path === '@radix-ui/react-tooltip') return { Portal: 'Portal' };
      if (path === '@/lib/availability-history') return lib;
      if (path === '@/lib/schedule-time') return { timezoneLabel: minutes => 'UTC+' + minutes / 60 };
      if (path === '@/lib/utils') return { cn: (...values) => values.filter(Boolean).join(' ') };
      if (path.endsWith('/button')) return { Button: 'Button' };
      if (path.endsWith('/select')) return Object.fromEntries(['Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue'].map(name => [name, name]));
      if (path.endsWith('/tooltip')) return Object.fromEntries(['Tooltip', 'TooltipContent', 'TooltipProvider', 'TooltipTrigger'].map(name => [name, name]));
      throw new Error('Unexpected dependency: ' + path);
    },
  });
  return props => { cursor = 0; return nodes(exports.AvailabilityHistory(props)); };
}
const defaultProps = { rows: [sample('2026-08-31T01:00:00Z'), sample(date + 'T01:00:00Z', 0)], dates: ['2026-08-31', date], granularity: '1h', timezoneMinutes: 0 };
test('day selection, frontend date picker and detail hover use current data and discard stale focus', () => {
  const render = harness();
  let tree = render(defaultProps);
  assert.equal(tree.find(node => node.props?.['aria-pressed']).props['data-online-day'], date);
  const hovered = tree.find(node => node.props?.['data-online-slot'] === Date.parse(date + 'T00:00:00Z'));
  hovered.props.onMouseEnter();
  tree = render(defaultProps);
  assert.equal(tree.find(node => node.props?.['data-online-slot'] !== undefined && node.props.tabIndex === 0).props['data-online-slot'], hovered.props['data-online-slot']);
  tree.find(node => node.type === 'Select').props.onValueChange('2026-08-31');
  tree = render(defaultProps);
  assert.equal(tree.find(node => node.props?.['aria-pressed']).props['data-online-day'], '2026-08-31');
  assert.equal(tree.find(node => node.type === 'Button' && node.props['aria-label'] === '前一天').props.disabled, true);
  tree.find(node => node.type === 'Button' && node.props['aria-label'] === '后一天').props.onClick();
  tree = render(defaultProps);
  assert.equal(tree.find(node => node.props?.['aria-pressed']).props['data-online-day'], date);
  const other = { ...defaultProps, dates: ['2026-09-02'], rows: [sample('2026-09-02T03:00:00Z')] };
  tree = render(other);
  assert.equal(tree.find(node => node.props?.['aria-pressed']).props['data-online-day'], '2026-09-02');
  assert.equal(tree.filter(node => node.props?.['data-online-slot'] !== undefined).length, 24);
});
test('arrow-key navigation moves only between timeline controls and keeps one tab stop per row', () => {
  const render = harness();
  let tree = render(defaultProps);
  const buttons = tree.filter(node => node.props?.['data-online-day']);
  let prevented = false;
  const focused = [];
  buttons[1].props.onKeyDown({ key: 'ArrowLeft', preventDefault() { prevented = true; }, currentTarget: { parentElement: {
    querySelectorAll: selector => { assert.equal(selector, '[data-online-day]'); return buttons.map((node, index) => ({ focus: () => { focused.push(index); node.props.onFocus(); }, scrollIntoView: () => {} })); },
  } } });
  tree = render(defaultProps);
  assert.equal(prevented, true);
  assert.deepEqual(focused, [0]);
  assert.equal(tree.find(node => node.props?.['aria-pressed']).props['data-online-day'], '2026-08-31');
  for (const attribute of ['data-online-day', 'data-online-slot']) assert.equal(tree.filter(node => node.props?.[attribute] !== undefined && node.props.tabIndex === 0).length, 1);
});
test('dense histories render a single overview row and only the selected day, with horizontal scrolling', () => {
  const preview = statisticsPreview(tourSamples.statistics, new URLSearchParams({ days: 7, granularity: '5m' }));
  const tree = harness()({ rows: preview.online_history, dates: preview.daily_usage.map(row => row.date), granularity: '5m', timezoneMinutes: 480 });
  assert.equal(tree.filter(node => node.props?.['data-online-day']).length, 7);
  assert.equal(tree.filter(node => node.props?.['data-online-slot'] !== undefined).length, 288);
  const groups = tree.filter(node => node.props?.role === 'group');
  assert.equal(groups.length, 2);
  assert.ok(groups.every(node => node.props.className.includes('flex-nowrap')));
  assert.ok(tree.find(node => node.props?.['data-online-detail-scroll'] !== undefined).props.className.includes('overflow-x-auto'));
  assert.ok(!source.includes('repeat(auto-fill'));
});
test('daily overview is yellow for a recovered outage but the outage detail remains red', () => {
  const rows = [sample(date + 'T01:00:00Z'), sample(date + 'T02:00:00Z', 0), sample(date + 'T03:00:00Z')];
  const tree = harness()({ ...defaultProps, dates: [date], rows });
  const overview = tree.find(node => node.props?.['data-online-day'] === date);
  assert.ok(overview.props.className.includes('bg-amber-400'));
  const outage = tree.find(node => node.props?.['data-online-slot'] === Date.parse(date + 'T02:00:00Z'));
  assert.ok(outage.props.className.includes('bg-rose-500'));
  const online = tree.find(node => node.props?.['data-online-slot'] === Date.parse(date + 'T03:00:00Z'));
  assert.ok(online.props.className.includes('bg-emerald-500'));
  for (const [onlineCount, color] of [[0, 'bg-rose-500'], [2, 'bg-emerald-500'], [1, 'bg-amber-400']]) {
    const allSame = rows.map(row => ({ ...row, online_count: onlineCount }));
    const sameTree = harness()({ ...defaultProps, dates: [date], rows: allSame });
    assert.ok(sameTree.find(node => node.props?.['data-online-day'] === date).props.className.includes(color));
  }
});
test('new timeline copy has complete keys and honest timezone/granularity notes in every language', () => {
  const keys = Object.keys(availabilityCopy.en).sort();
  for (const [language, copy] of Object.entries(availabilityCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), keys, language);
    for (const key of keys) assert.ok(copy[key].trim(), `${language}: ${key}`);
    assert.ok(copy.help.includes('UTC'));
  }
  const page = readFileSync(new URL('../src/pages/statistics-page.tsx', import.meta.url), 'utf8');
  assert.ok(page.includes('granularity={data.filters.granularity || granularity}'));
  assert.ok(page.includes("fetch('/api/system/timezone')"));
});
