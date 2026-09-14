import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TourDataContext, useTourState, useTourValue } from '../.test-dist/components/onboarding/tour-data.js';
import { tourSamples as samples } from '../.test-dist/lib/tour-samples.js';

test('samples are an opt-in render projection, with live data as the default', () => {
  function Probe() {
    const [draft] = useTourState('unsaved real draft', 'sample draft');
    const rows = useTourValue([], samples.groups);
    return createElement('output', null, `${draft}:${rows.length}`);
  }
  assert.equal(renderToStaticMarkup(createElement(Probe)), '<output>unsaved real draft:0</output>');
  assert.equal(renderToStaticMarkup(createElement(TourDataContext.Provider, { value: true }, createElement(Probe))), '<output>sample draft:2</output>');
});

test('samples form one consistent fictional bot, group and player scenario', () => {
  const [adapter] = samples.adapters;
  const [group] = samples.groups;
  const [player] = samples.players;
  assert.equal(group.accounts[0].adapterId, adapter.id);
  assert.equal(samples.tasks[0].adapterId, adapter.id);
  assert.equal(samples.tasks[0].targetId, group.groupId);
  assert.equal(samples.noticeWindows[0].chat_id, group.groupId);
  assert.equal(samples.gameLogs[0].groupId, group.groupId);
  assert.equal(samples.gameLogs[0].gmId, player.userId);
  assert.equal(samples.gameLogs[0].gameCode, samples.sessions[0].code);
  assert.equal(samples.gameLogs[0].status, 0);
  assert.equal(String(samples.replyPreview.ruleId), samples.replies[0].id);
  assert.equal(samples.dashboard.total_rules, samples.replies.length);
  assert.equal(samples.dashboard.total_commands, samples.players.reduce((n, p) => n + p.cmdCount, 0));
  assert.equal(samples.statistics.daily_usage.reduce((n, d) => n + d.commands, 0), samples.statistics.summary.total_commands);
  assert.equal(samples.statistics.daily_usage.reduce((n, d) => n + d.rolls, 0), samples.statistics.summary.total_rolls);
  assert.equal(samples.statistics.usage_by_hour.reduce((n, d) => n + d.commands, 0), samples.statistics.summary.total_commands);
  assert.equal(samples.statistics.usage_by_hour.reduce((n, d) => n + d.rolls, 0), samples.statistics.summary.total_rolls);
});

test('tutorial samples contain no working credentials or real messaging IDs', () => {
  for (const model of samples.models) {
    assert.equal(model.api_key, '');
    assert.ok(new URL(model.base_url).hostname.endsWith('.invalid'));
  }
  for (const group of samples.groups) assert.ok(group.groupId.startsWith('demo-'));
  for (const player of samples.players) assert.ok(player.userId.startsWith('demo-'));
  for (const adapter of samples.adapters) assert.equal(adapter.accessToken, undefined);
});
