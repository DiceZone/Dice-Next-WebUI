import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import ts from 'typescript';
import { timezoneLabel } from '../.test-dist/lib/schedule-time.js';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const languages = ['zh-Hans', 'zh-Hant', 'en', 'ja'];
const messages = Object.fromEntries(languages.map((language) => [language, JSON.parse(read(`src/i18n/locales/${language}.json`))]));
const lookup = (locale, key) => key.split('.').reduce((value, part) => value?.[part], locale);
const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' })[character]);
const routeSource = read('src/routes/index.tsx');
const pageImports = [...routeSource.matchAll(/import\s+\{\s*(\w+Page)\s*\}\s+from\s+'@\/pages\/([^']+)'/g)]
  .map(([, component, file]) => ({ component, file }));
const routes = [...routeSource.slice(routeSource.indexOf('const ROUTES:'), routeSource.indexOf('const DEFAULT_ROUTE'))
  .matchAll(/'([^']+)': (\w+Page)/g)].map(([, path, component]) => ({ path, component }));

// Exercise the actual React pages, Radix triggers and translations in memory.
// Effects do not run during server rendering, so this never calls a bot API.
const compiled = await build({
  stdin: {
    contents: [
      "import React from 'react';",
      "import { renderToStaticMarkup } from 'react-dom/server';",
      "import { I18nextProvider } from 'react-i18next';",
      "import { createInstance } from 'i18next';",
      "import { TourDataContext } from './src/components/onboarding/tour-data';",
      "import { uiRefresh } from './src/i18n/ui-refresh';",
      "import { uiAudit } from './src/i18n/ui-audit';",
      "import { weightedTemplates } from './src/i18n/weighted-templates';",
      "import { pageHelp } from './src/i18n/page-help';",
      "import { featureHelpCopy } from './src/i18n/feature-help';",
      "import { availabilityCopy } from './src/i18n/availability';",
      "import { HelpLabel } from './src/components/ui/help-label';",
      "export { uiRefresh, uiAudit, weightedTemplates, pageHelp, featureHelpCopy, availabilityCopy };",
      ...pageImports.map(({ component, file }) => `import { ${component} } from './src/pages/${file}';`),
      ...languages.map((language, index) => `import locale${index} from './src/i18n/locales/${language}.json';`),
      `const resources = { ${languages.map((language, index) => `'${language}': { translation: { ...locale${index}, ui_refresh: uiRefresh['${language}'], ui_audit: uiAudit['${language}'], weighted: weightedTemplates['${language}'], page_help: pageHelp['${language}'], feature_help: featureHelpCopy['${language}'], availability: availabilityCopy['${language}'] } }`).join(', ')} };`,
      "const i18n = createInstance(); i18n.init({ lng: 'zh-Hans', initImmediate: false, resources, interpolation: { escapeValue: false } });",
      `const pages = { ${pageImports.map(({ component }) => component).join(', ')}, settings: SettingsPage, webui: WebuiSettingsPage, cloud: CloudSettingsPage, notice: NoticeSettingsPage, schedules: SchedulesPage, ai: AiPage };`,
      "export const render = (page, language, tour = false) => {",
      "  i18n.changeLanguage(language);",
      "  return renderToStaticMarkup(React.createElement(I18nextProvider, { i18n }, React.createElement(TourDataContext.Provider, { value: tour }, React.createElement(pages[page]))));",
      "};",
      "export const renderLabel = (props, language) => { i18n.changeLanguage(language); return renderToStaticMarkup(React.createElement(I18nextProvider, { i18n }, React.createElement(HelpLabel, props))); };",
    ].join('\n'),
    resolveDir: fileURLToPath(new URL('../', import.meta.url)),
  },
  alias: { '@': fileURLToPath(new URL('../src/', import.meta.url)) },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
});
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
for (const language of languages) {
  messages[language].ui_audit = module.exports.uiAudit[language];
  messages[language].weighted = module.exports.weightedTemplates[language];
  messages[language].page_help = module.exports.pageHelp[language];
  messages[language].ui_refresh = module.exports.uiRefresh[language];
  messages[language].feature_help = module.exports.featureHelpCopy[language];
  messages[language].availability = module.exports.availabilityCopy[language];
}

function renderPage(page, hash, language = 'zh-Hans', tour = false) {
  const original = globalThis.window;
  globalThis.window = { location: { hash }, matchMedia: () => ({ matches: true }) };
  try { return module.exports.render(page, language, tour); }
  finally {
    if (original === undefined) delete globalThis.window;
    else globalThis.window = original;
  }
}

function assertHelp(html, locale, titleKey) {
  const label = locale.common.feature_help.replace('{{title}}', lookup(locale, titleKey));
  const button = [...html.matchAll(/<button\b[^>]*>/g)].map(([tag]) => tag).find((tag) => tag.includes(`aria-label="${escapeHtml(label)}"`));
  assert.ok(button, titleKey);
  assert.ok(button.includes('type="button"'), titleKey);
  assert.ok(button.includes('aria-haspopup="dialog"'), titleKey);
  assert.ok(button.includes('aria-disabled="false"'), titleKey);
  assert.ok(button.includes('pointer-events-auto'), titleKey);
  assert.ok(!button.includes(' disabled'), titleKey);
}

test('every navigation route has localized page help in both initial and loaded/sample states', () => {
  assert.ok(routes.length >= 29);
  for (const language of languages) {
    const locale = messages[language];
    for (const { path, component } of routes) {
      for (const tour of [false, true]) {
        const html = renderPage(component, '#' + path, language, tour);
        const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]*>/g, '')
          ?? (path === '/playground' ? escapeHtml(locale.nav.playground) : undefined);
        assert.ok(heading, `${language}: ${path}: heading`);
        const label = escapeHtml(locale.common.feature_help).replace('{{title}}', heading);
        assert.ok(html.includes(`aria-label="${label}"`), `${language}: ${path}: page help`);
        assert.ok(!html.includes('page_help.') && !html.includes('common.feature_help'), `${language}: ${path}: untranslated key`);
      }
    }
  }
});

test('command compatibility details are in page help, not the visible subtitle, in every language', () => {
  const file = 'src/pages/commands-page.tsx';
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let header;
  const visit = (node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'PageHeader') header = node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  const attribute = (name) => header.attributes.properties.find((property) => ts.isJsxAttribute(property) && property.name.getText(source) === name)?.initializer?.getText(source);
  assert.ok(attribute('help').includes("t('commands.compat_note')"));
  assert.ok(attribute('help').includes("t('page_help.commands')"));
  assert.equal(attribute('description'), "{t('commands.subtitle')}");
  for (const language of languages) {
    for (const tour of [false, true]) {
      const html = renderPage('CommandsPage', '#/commands', language, tour);
      assert.ok(html.includes(escapeHtml(messages[language].commands.subtitle)));
      assert.ok(!html.includes(escapeHtml(messages[language].commands.compat_note)));
      assertHelp(html, messages[language], 'commands.title');
    }
  }
});

test('every PageHeader branch includes help, and page guides have the same complete keys in all four languages', () => {
  for (const { file } of pageImports) {
    const source = ts.createSourceFile(file, read('src/pages/' + file + '.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let count = 0;
    const visit = (node) => {
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(source) === 'PageHeader') {
        ++count;
        assert.ok(node.attributes.properties.some((property) => ts.isJsxAttribute(property) && property.name.getText(source) === 'help'), file);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    assert.ok(count || file === 'playground-page', file);
  }
  const keys = Object.keys(module.exports.pageHelp.en).sort();
  assert.ok(keys.length >= 29);
  for (const language of languages) {
    assert.deepEqual(Object.keys(module.exports.pageHelp[language]).sort(), keys);
    for (const key of keys) assert.ok(module.exports.pageHelp[language][key].trim().includes('\n\n'), `${language}: ${key}`);
  }
});

test('other settings pages render named clickable help in all four languages, including disabled AI sections', () => {
  const cases = [
    ['settings', '#/settings', ['settings.expression_title', 'settings.message_format_title', 'settings.imgsend_title', 'settings.imghost_title', 'settings.respond_self', 'settings.quote_reply', 'settings.save_images']],
    ['webui', '#/webui-settings', ['workspace.width', 'settings.webpw_title', 'settings.server_title', 'settings.api_key_title', 'settings.theme_title', 'settings.log_title']],
    ['cloud', '#/cloud-services', ['cloud.keys_title', 'cloud.cards_title', 'settings.logsite_title', 'settings.heartbeat_title', 'settings.heartbeat_master_title']],
    ['notice', '#/notice-settings', ['noticeset.tab_windows']],
    ['notice', '#/notice-settings?tab=push', ['noticeset.push_smtp', 'noticeset.push_webhook']],
    ['schedules', '#/schedules', ['nav.schedules']],
    ['ai', '#/ai/polish', ['ai.polish']],
    ['ai', '#/ai/translate', ['ai.trans']],
    ['ai', '#/ai/chat', ['ai.chat', 'ai.mem', 'ai.mlong', 'ai.tools', 'ai.wl', 'ai.vision']],
    ['ai', '#/ai/npc', ['ai.npc']],
  ];
  for (const language of languages) {
    for (const [page, hash, titles] of cases) {
      const html = renderPage(page, hash, language);
      for (const title of titles) assertHelp(html, messages[language], title);
      assert.ok(!html.includes('common.feature_help'));
      if (page === 'ai') assert.ok(html.includes(escapeHtml(messages[language].ai.master_off_hint)));
    }
  }
});

test('password, restart, timezone, public sharing and notification requirements remain visible', () => {
  for (const language of languages) {
    const locale = messages[language];
    for (const [page, hash, keys] of [
      ['settings', '#/settings', ['settings.prefix_hint', 'settings.timezone_hint', 'settings.seg_enabled_desc', 'feature_help.segment_limits', 'feature_help.forward_scope', 'feature_help.auto_card_scope']],
      ['webui', '#/webui-settings', ['settings.webpw_desc', 'settings.webpw_hint', 'settings.server_hint', 'settings.restart_update_hint']],
      ['cloud', '#/cloud-services', ['cloud.keys_desc', 'cloud.key_warning', 'cloud.cards_privacy', 'settings.heartbeat_public_desc']],
      ['notice', '#/notice-settings?tab=push', ['noticeset.push_smtp_desc', 'noticeset.push_hint']],
      ['notice', '#/notice-settings?tab=audit', ['noticeset.audit_hint']],
    ]) {
      const html = renderPage(page, hash, language);
      for (const key of keys) assert.ok(html.includes(escapeHtml(lookup(locale, key))), `${language}: ${key}`);
    }
    const html = renderPage('schedules', '#/schedules', language, true);
    const timezoneText = locale.ui_audit.schedule_timezone.replace('{{timezone}}', timezoneLabel(480));
    assert.ok(html.includes(escapeHtml(timezoneText)));
    assert.ok(renderPage('ai', '#/ai', language, true).includes(escapeHtml(locale.ai.warn)));
    assert.ok(renderPage('ai', '#/ai/chat', language, true).includes(escapeHtml(locale.ai.chat_note)));
  }
});

const sourceFiles = (folder) => readdirSync(new URL('../' + folder, import.meta.url), { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory() ? sourceFiles(folder + '/' + entry.name) : entry.name.endsWith('.tsx') ? [folder + '/' + entry.name] : []);
const helpFiles = [...sourceFiles('src/pages'), ...sourceFiles('src/components')]
  .filter((file) => /<(?:FeatureHelp|HelpLabel)\b/.test(read(file)));

function findHelpKeys(source) {
  const keys = new Set();
  const collect = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't' && ts.isStringLiteral(node.arguments[0])) {
      keys.add(node.arguments[0].text);
    }
    ts.forEachChild(node, collect);
  };
  const visit = (node) => {
    if (ts.isJsxSelfClosingElement(node) && ['FeatureHelp', 'HelpLabel'].includes(node.tagName.getText(source))) collect(node);
    else ts.forEachChild(node, visit);
  };
  visit(source);
  return keys;
}

test('all static feature-help titles and details have translations in every supported language', () => {
  for (const file of helpFiles) {
    const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const keys = findHelpKeys(source);
    for (const key of keys) {
      for (const language of languages) assert.ok(lookup(messages[language], key)?.trim(), `${file}: ${language}: ${key}`);
    }
  }
});

function inlineParagraphKeys(file) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const keys = new Set();
  const visit = (node, inParagraph = false) => {
    if (ts.isJsxSelfClosingElement(node) && ['FeatureHelp', 'HelpLabel'].includes(node.tagName.getText(source))) return;
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'p') inParagraph = true;
    if (inParagraph && ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && node.expression.text === 't' && ts.isStringLiteral(node.arguments[0])) keys.add(node.arguments[0].text);
    ts.forEachChild(node, (child) => visit(child, inParagraph));
  };
  visit(source);
  return keys;
}

test('AI cost and permission notes, plugin-command restrictions and image-host requirements are not hidden in help', () => {
  const ai = inlineParagraphKeys('src/pages/ai-page.tsx');
  for (const key of ['warn', 'polish_note', 'trans_note', 'chat_note', 'mem_note', 'mlong_note', 'tools_note', 'wl_desc', 'wl_note', 'vision_note', 'npc_note']) {
    assert.ok(ai.has('ai.' + key), key);
  }
  assert.ok(inlineParagraphKeys('src/pages/schedules-page.tsx').has('schedules.plugin_command_hint'));
  const settings = inlineParagraphKeys('src/pages/settings-page.tsx');
  for (const key of ['settings.imghost_local_hint', 'settings.imgsend_host_hint', 'settings.censor_behavior']) assert.ok(settings.has(key), key);
  assert.ok(inlineParagraphKeys('src/pages/about-page.tsx').has('about.update_install_timezone'));
});

test('expression help stays outside the disabled fieldset while its settings controls remain gated', () => {
  const page = read('src/pages/settings-page.tsx');
  const card = page.slice(page.indexOf('<Card data-setting-anchor="settings-expression"'), page.indexOf('<SettingsPanel value="groups">'));
  assert.ok(card.indexOf('<FeatureHelp') < card.indexOf('<fieldset disabled={!scopedReady}'));
  assert.ok(card.indexOf('<Select value={expressionMode}') > card.indexOf('<fieldset disabled={!scopedReady}'));
  assert.ok(card.indexOf('onClick={saveExpression}') < card.indexOf('</fieldset>'));
});

test('help buttons do not nest inside labels, sort buttons or accordion toggle buttons', () => {
  for (const file of helpFiles.concat('src/components/ui/advanced-options.tsx')) {
    const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node, blocked = false) => {
      if (ts.isJsxSelfClosingElement(node) && ['FeatureHelp', 'HelpLabel'].includes(node.tagName.getText(source))) assert.equal(blocked, false, file);
      if (ts.isJsxElement(node)) blocked ||= ['button', 'Button', 'label', 'Label'].includes(node.openingElement.tagName.getText(source));
      ts.forEachChild(node, (child) => visit(child, blocked));
    };
    visit(source);
  }
  const reply = read('src/components/reply/reply-form.tsx');
  assert.ok(reply.indexOf('<FeatureHelp') < reply.indexOf('<fieldset disabled='));
  assert.ok(inlineParagraphKeys('src/components/reply/reply-form.tsx').has('replies.result_weight_hint'));
});

test('detailed settings, cloud and backup sections render their own localized help, not just page help', () => {
  const cases = [
    ['settings', '#/settings', ['settings.scope_title', 'settings.master_title', 'settings.master_inherit_title', 'settings.prefix_title', 'settings.timezone_title', 'settings.approval_title', 'settings.welcome_min_title', 'settings.forward_threshold', 'settings.seg_len', 'settings.nick_wrap', 'settings.js_fetch_title', 'settings.plugin_verify_title', 'settings.censor_title', 'settings.tray_title', 'identitymail.title', 'chatcfg.title', 'friendclean.title', 'usergroup.title']],
    ['webui', '#/webui-settings', ['settings.api_key_title', 'settings.theme_title', 'settings.log_title']],
    ['cloud', '#/cloud-services', ['banlist.cloudban_title', 'banlist.cloudban_share']],
    ['BackupPage', '#/backup', ['backup.legacy_title', 'backup.backup_restore_title', 'feature_help.backup_auto', 'feature_help.backup_archives']],
    ['ai', '#/ai/models', ['ai.master', 'ai.params']],
  ];
  for (const language of languages) {
    for (const [page, hash, titles] of cases) {
      const html = renderPage(page, hash, language, true);
      for (const key of titles) assertHelp(html, messages[language], key);
      assert.ok(!html.includes('feature_help.'), `${language}: ${page}: untranslated detail`);
    }
  }
});

test('editor and detail components keep contextual instructions in named help', () => {
  const cases = {
    'src/components/adapter/adapter-form.tsx': ['adapters.add_title', 'adapters.edit_title', 'feature_help.verify_image_desc', 'qq_rich.hint', 'adapters.heart_api_key_desc'],
    'src/components/causal/causal-rule-editor.tsx': ['causal.v2.tpl_desc', 'causal.v2.reply_hint', 'causal.v2.counter_hint', 'causal.v2.cooldown_hint'],
    'src/components/persona/persona-editor.tsx': ['persona.ed.title', 'feature_help.persona_editor_desc', 'weighted.reply_hint'],
    'src/components/persona/persona-manager.tsx': ['persona.global_scope_title', 'persona.group_scope_hint', 'persona.new_desc', 'persona.import_desc'],
    'src/components/persona/persona-access-dialog.tsx': ['commands.persona_access_desc', 'commands.persona_scope_hint'],
    'src/components/reply/reply-form.tsx': ['replies.form_desc', 'replies.poke_desc', 'replies.priority_hint', 'replies.limits_hint'],
    'src/components/reply/reply-match-preview.tsx': ['replies.preview_hint', 'replies.preview_group_hint'],
    'src/components/reply/broadcast-bar.tsx': ['broadcast.rules'],
    'src/pages/commands-page.tsx': ['commands.persona_manage_desc', 'commands.preview_hint', 'commands.variable_styles_desc', 'commands.global_vars_desc'],
    'src/pages/groups-page.tsx': ['groups.plugins_hint', 'groups.ai_memory_note', 'groups.bot_card_hint', 'groups.group_locale_hint', 'groups.welcome_settings_hint'],
    'src/pages/rule-editor.tsx': ['ruleed.test_hint', 'ruleed.custom_hint'],
    'src/pages/modules-page.tsx': ['modules.config_desc', 'luamod.cmd_hint', 'luamod.help_hint'],
    'src/pages/decks-page.tsx': ['ui_refresh.import_note', 'ui_refresh.export_hint'],
    'src/components/deck-editor.tsx': ['ui_refresh.edit_hint'],
  };
  for (const [file, expected] of Object.entries(cases)) {
    const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const keys = findHelpKeys(source);
    for (const key of expected) assert.ok(keys.has(key), `${file}: ${key}`);
  }
});

test('ordinary long instructions are no longer repeated under their fields', () => {
  const cases = {
    'src/pages/ai-page.tsx': ['ai.cov_desc', 'ai.params_desc', 'ai.polish_prompt_note', 'ai.trans_prompt_note', 'ai.chat_trigger_desc', 'ai.chat_filters_note', 'ai.vision_pass_url_desc'],
    'src/components/causal/causal-rule-editor.tsx': ['causal.v2.tpl_desc', 'causal.v2.reply_hint', 'causal.v2.counter_hint', 'causal.v2.cooldown_hint'],
    'src/components/reply/reply-form.tsx': ['replies.priority_hint', 'replies.limits_hint'],
    'src/pages/rule-editor.tsx': ['ruleed.test_hint', 'ruleed.custom_hint'],
    'src/pages/groups-page.tsx': ['groups.plugins_hint', 'groups.ai_memory_note', 'groups.bot_card_hint', 'groups.group_locale_hint', 'groups.welcome_settings_hint'],
    'src/components/identity-email-settings.tsx': ['identitymail.usage'],
  };
  for (const [file, hidden] of Object.entries(cases)) {
    const inline = inlineParagraphKeys(file);
    const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const help = findHelpKeys(source);
    for (const key of hidden) {
      assert.ok(help.has(key), `${file}: ${key}: instructions missing from help`);
      assert.ok(!inline.has(key), `${file}: ${key}: duplicate inline help`);
    }
  }
});

test('help labels preserve label associations and render help as a sibling, not a label click target', () => {
  for (const language of languages) {
    const locale = messages[language];
    const title = locale.settings.master_inherit_title;
    const html = module.exports.renderLabel({ title, description: 'Detailed explanation', htmlFor: 'setting-toggle', labelClassName: 'font-normal' }, language);
    assert.match(html, /<label\b[^>]*for="setting-toggle"[^>]*>/);
    const label = html.match(/<label\b[^>]*>[\s\S]*?<\/label>/)?.[0];
    assert.ok(label?.includes(escapeHtml(title)));
    assert.ok(label.includes('font-normal'));
    assert.ok(!label.includes('<button'));
    assert.match(html, /<\/label>\s*<button\b/);
    assertHelp(html, locale, 'settings.master_inherit_title');
    assert.ok(!html.includes('Detailed explanation')); // Only appears when explicitly requested.
  }
});

test('all concise risk notices and newly added detail descriptions are complete in all four languages', () => {
  const keys = Object.keys(module.exports.featureHelpCopy.en).sort();
  assert.ok(keys.length >= 20);
  for (const language of languages) {
    assert.deepEqual(Object.keys(module.exports.featureHelpCopy[language]).sort(), keys);
    for (const key of keys) assert.ok(module.exports.featureHelpCopy[language][key].trim(), `${language}: ${key}`);
  }
});

test('restoration, deletion, privacy, TLS and scope warnings remain visible after help cleanup', () => {
  for (const language of languages) {
    for (const [page, hash, keys] of [
      ['BackupPage', '#/backup', ['backup.restore_warning', 'feature_help.backup_selection_note', 'feature_help.backup_retention_note']],
      ['settings', '#/settings', ['settings.scope_desc', 'settings.master_desc', 'identitymail.tls_hint', 'settings.js_fetch_desc', 'settings.plugin_verify_desc', 'feature_help.chat_retention_note']],
      ['webui', '#/webui-settings', ['feature_help.api_key_note']],
      ['cloud', '#/cloud-services', ['feature_help.cloudban_note', 'banlist.cloudban_share_desc']],
    ]) {
      const html = renderPage(page, hash, language, true);
      for (const key of keys) assert.ok(html.includes(escapeHtml(lookup(messages[language], key))), `${language}: ${key}`);
    }
  }
  assert.ok(inlineParagraphKeys('src/components/adapter/adapter-form.tsx').has('feature_help.verify_image_desc'));
  assert.ok(inlineParagraphKeys('src/components/persona/persona-manager.tsx').has('persona.global_scope_desc'));
});

test('statistics defaults to seven days in both live and tutorial views, so five-minute history is available', () => {
  const file = 'src/pages/statistics-page.tsx';
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let defaultDays;
  let fineDetailGuard;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === '[days, setDays]') defaultDays = node.initializer;
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'SelectItem') {
      const attributes = node.openingElement.attributes.properties;
      if (attributes.some((property) => ts.isJsxAttribute(property) && property.name.getText(source) === 'value' && property.initializer?.text === '5m')) {
        fineDetailGuard = attributes.find((property) => ts.isJsxAttribute(property) && property.name.getText(source) === 'disabled')?.initializer;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.equal(defaultDays?.expression.getText(source), 'useTourState');
  assert.deepEqual(defaultDays.arguments.map((argument) => argument.getText(source)), ['7', '7']);
  assert.equal(fineDetailGuard?.getText(source), '{days > 7}');
  for (const language of languages) {
    const html = renderPage('StatisticsPage', '#/statistics', language, true);
    const datePicker = html.split(`aria-label="${escapeHtml(messages[language].statistics.date_range)}"`)[1]?.split('</div>')[0];
    const selected = [...datePicker.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].filter(([, attributes]) => attributes.includes('bg-background text-foreground'));
    assert.equal(selected.length, 1, `${language}: one default date range`);
    assert.ok(selected[0][2].includes('7'), `${language}: seven-day range selected`);
  }
});
