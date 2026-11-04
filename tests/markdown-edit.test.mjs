import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyMarkdown, shortcutAction, MARKDOWN_ACTIONS } from '../.test-dist/lib/markdown-edit.js';

const at = (source, action, from, to = from, placeholder = '文字') => applyMarkdown(source, from, to, action, placeholder);
const selected = edit => edit.text.slice(edit.start, edit.end);

test('inline styles wrap the selection and a second click removes them', () => {
  const bold = at('结果 {level}', 'bold', 3, 10);
  assert.equal(bold.text, '结果 **{level}**');
  assert.equal(selected(bold), '{level}');
  const plain = at(bold.text, 'bold', bold.start, bold.end);
  assert.equal(plain.text, '结果 {level}');
  assert.equal(selected(plain), '{level}');
  for (const [action, mark] of [['italic', '*'], ['strike', '~~'], ['code', '`']]) {
    const edit = at('a b c', action, 2, 3);
    assert.equal(edit.text, `a ${mark}b${mark} c`);
    assert.equal(at(edit.text, action, edit.start, edit.end).text, 'a b c');
  }
});

test('italic is not mistaken for bold, and selecting the markers also toggles', () => {
  const both = at('**粗体**', 'italic', 2, 4);
  assert.equal(both.text, '***粗体***');
  assert.equal(at(both.text, 'italic', both.start, both.end).text, '**粗体**');
  assert.equal(at('前 **粗体** 后', 'bold', 2, 8).text, '前 粗体 后');
});

test('spaces stay outside markers and multi-line selections are styled per line', () => {
  assert.equal(at('a  word  b', 'bold', 1, 9).text, 'a  **word**  b');
  const lines = at('第一行\n\n第二行', 'bold', 0, 8);
  assert.equal(lines.text, '**第一行**\n\n**第二行**');
  assert.equal(at(lines.text, 'bold', lines.start, lines.end).text, '第一行\n\n第二行');
});

test('an empty selection inserts a selected placeholder', () => {
  const edit = at('结果：', 'bold', 3);
  assert.equal(edit.text, '结果：**文字**');
  assert.equal(selected(edit), '文字');
  const link = at('看 规则', 'link', 2, 4);
  assert.equal(link.text, '看 [规则](https://)');
  assert.equal(selected(link), 'https://');
});

test('line actions prefix every selected line and toggle back', () => {
  const quote = at('一\n二', 'quote', 0, 3);
  assert.equal(quote.text, '> 一\n> 二');
  assert.equal(at(quote.text, 'quote', quote.start, quote.end).text, '一\n二');
  assert.equal(at('标题', 'heading', 1).text, '## 标题');
  assert.equal(at('## 标题', 'heading', 4).text, '标题');
  const numbered = at('甲\n乙\n丙', 'number', 0, 5);
  assert.equal(numbered.text, '1. 甲\n2. 乙\n3. 丙');
  assert.equal(at(numbered.text, 'number', numbered.start, numbered.end).text, '甲\n乙\n丙');
  // Switching list kinds replaces the old marker instead of stacking it.
  assert.equal(at(numbered.text, 'bullet', numbered.start, numbered.end).text, '- 甲\n- 乙\n- 丙');
});

test('lists after ordinary text get the blank line QQ requires', () => {
  const gear = '**{nick}** 的装备\n剑\n盾';
  assert.equal(at(gear, 'bullet', gear.indexOf('剑'), gear.length).text, '**{nick}** 的装备\n\n- 剑\n- 盾');
  assert.equal(at('## 装备\n剑', 'bullet', 6).text, '## 装备\n- 剑');
  assert.equal(at('- 剑\n盾', 'bullet', 4).text, '- 剑\n- 盾');
});

test('divider sits on its own line and template syntax is never rewritten', () => {
  assert.equal(at('上下', 'divider', 1).text, '上\n***\n下');
  assert.equal(at('上\n', 'divider', 2).text, '上\n***');
  const source = '[[action:再掷|.r {nick}]] {sample:a|b}';
  assert.equal(at(source, 'bold', 0, source.length).text, `**${source}**`);
  assert.ok(MARKDOWN_ACTIONS.includes('divider'));
});

test('Ctrl/⌘+B and Ctrl/⌘+I are the only shortcuts', () => {
  const key = (key, extra = {}) => shortcutAction({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...extra });
  assert.equal(key('b', { ctrlKey: true }), 'bold');
  assert.equal(key('I', { metaKey: true }), 'italic');
  assert.equal(key('b'), null);
  assert.equal(key('b', { ctrlKey: true, shiftKey: true }), null);
  assert.equal(key('k', { ctrlKey: true }), null);
});

test('the reply editor uses the toolbar, defaults to Markdown and has no per-variable style menu', () => {
  const editor = readFileSync(new URL('../src/pages/commands-page.tsx', import.meta.url), 'utf8');
  assert.match(editor, /<MarkdownToolbar textareaRef=\{taRef\}/);
  assert.match(editor, /useState<ReplyFormat>\(reply.override == null \? 'markdown' : reply.format\)/);
  assert.match(editor, /\/api\/templates\/markdown-source/);
  assert.match(editor, /visual_editor.load/);
  assert.doesNotMatch(editor, /variable_style|restyleVariable|visual_editor.preset'/);
  // One "Load preset" menu replaces the separate preset picker and restore button.
  assert.equal([...editor.matchAll(/t\('visual_editor.load'\)/g)].length, 2);
});
