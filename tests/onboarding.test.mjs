import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import {
  ONBOARDING_STORAGE_KEY,
  canonicalTourPath,
  completeTour,
  hasCompletedTour,
  readTourProgress,
  resetTourProgress,
} from '../.test-dist/lib/onboarding.js';
import { PAGE_TOURS, getPageTourProfile } from '../.test-dist/lib/page-tours.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

test('a page tour is shown once after completion', () => {
  const storage = memoryStorage();
  assert.equal(hasCompletedTour('/settings', 1, storage), false);
  assert.equal(completeTour('/settings', 1, storage, 1234), true);
  assert.equal(hasCompletedTour('/settings', 1, storage), true);
  assert.deepEqual(readTourProgress(storage)['/settings'], { version: 1, completedAt: 1234 });
});

test('a newer tour version may be introduced without losing old progress', () => {
  const storage = memoryStorage();
  completeTour('/settings', 1, storage, 1234);
  assert.equal(hasCompletedTour('/settings', 2, storage), false);
  assert.equal(hasCompletedTour('/settings', 1, storage), true);
});

test('legacy permission URL shares progress with the current URL', () => {
  const storage = memoryStorage();
  assert.equal(canonicalTourPath('/banlist'), '/permissions');
  completeTour('/banlist', 1, storage, 1234);
  assert.equal(hasCompletedTour('/permissions', 1, storage), true);
});

test('malformed storage is ignored and progress can be reset', () => {
  const storage = memoryStorage({ [ONBOARDING_STORAGE_KEY]: '{broken' });
  assert.deepEqual(readTourProgress(storage), {});
  completeTour('/', 1, storage, 1234);
  assert.equal(resetTourProgress(storage), true);
  assert.deepEqual(readTourProgress(storage), {});
});

test('every application route has a stable demo-page tour tied to real controls', () => {
  const routes = [
    '/', '/statistics', '/playground', '/adapters', '/dice-rules', '/replies', '/decks',
    '/groups', '/players', '/schedules', '/roadmap', '/commands', '/help', '/modules',
    '/rules', '/permissions', '/banlist', '/settings', '/ai', '/ai/chat', '/ai/npc',
    '/ai/polish', '/ai/translate', '/notice-settings', '/webui-settings', '/about',
    '/backup', '/logs',
  ];

  for (const route of routes) {
    const profile = getPageTourProfile(route);
    assert.ok(profile, `missing tour for ${route}`);
    assert.equal(profile.version, 3, `stale tour version for ${route}`);
    assert.ok(profile.steps.length >= 3, `tour for ${route} needs an actual workflow`);
    for (const step of profile.steps) {
      assert.ok(step.target, `tour step on ${route} needs a DOM target`);
      assert.ok(step.titleKey, `tour step on ${route} needs a title`);
      assert.ok(step.action, `tour step on ${route} needs an action`);
    }
  }
});

test('tour copy and referenced page labels exist in every locale', () => {
  const locales = ['zh-Hans', 'zh-Hant', 'en', 'ja'];
  const demoKeys = [
    'demo_mode', 'demo_badge', 'demo_scenario', 'demo_scenario_body', 'demo_instance',
    'demo_running', 'demo_connected', 'demo_ready', 'demo_status_normal', 'demo_active',
    'demo_group_chat', 'demo_platform', 'demo_language', 'demo_search', 'demo_create_hint',
    'demo_scope', 'demo_global', 'demo_name', 'demo_status', 'demo_actions', 'demo_record',
    'demo_other_tab', 'demo_result', 'demo_unsaved', 'demo_immediate_hint', 'demo_danger_hint',
  ];
  const lookup = (object, path) => path.split('.').reduce((value, part) => value?.[part], object);

  for (const locale of locales) {
    const messages = JSON.parse(readFileSync(`src/i18n/locales/${locale}.json`, 'utf8'));
    for (const key of demoKeys) {
      assert.equal(typeof lookup(messages, `onboarding.${key}`), 'string', `${locale}: demo copy ${key}`);
    }
    for (const [path, profile] of Object.entries(PAGE_TOURS)) {
      assert.equal(typeof lookup(messages, profile.titleKey), 'string', `${locale}: ${path} title ${profile.titleKey}`);
      for (const step of profile.steps) {
        assert.equal(typeof lookup(messages, step.titleKey), 'string', `${locale}: ${path} step ${step.titleKey}`);
        if (step.descriptionKey) {
          assert.equal(typeof lookup(messages, step.descriptionKey), 'string', `${locale}: ${path} detail ${step.descriptionKey}`);
        }
        assert.equal(typeof lookup(messages, `onboarding.action_labels.${step.action}`), 'string', `${locale}: action label ${step.action}`);
        assert.equal(typeof lookup(messages, `onboarding.actions.${step.action}`), 'string', `${locale}: action copy ${step.action}`);
      }
    }
  }
});

test('every tour target has a stable source anchor', () => {
  const sourceFiles = [
    ...readdirSync('src/pages').filter((name) => name.endsWith('.tsx')).map((name) => `src/pages/${name}`),
    'src/components/layout/layout.tsx',
  ];
  const source = sourceFiles.map((file) => readFileSync(file, 'utf8')).join('\n');

  for (const [path, profile] of Object.entries(PAGE_TOURS)) {
    for (const step of profile.steps) {
      const selectors = typeof step.target === 'string' ? [step.target] : step.target;
      for (const selector of selectors) {
        const anchor = selector.match(/\[data-(?:tour|setting-anchor)="([^"]+)"\]/)?.[1];
        assert.ok(anchor, `${path}: unsupported target selector ${selector}`);
        assert.ok(source.includes(anchor), `${path}: missing source anchor ${anchor}`);
      }
    }
  }
});
