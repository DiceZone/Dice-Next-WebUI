// Toolbar edits for reply templates. The textarea keeps the exact Markdown
// source (variables, [[components]], escapes), so every action is a small,
// reversible text change around the selection instead of a rich-text model.

export type MarkdownAction = 'bold' | 'italic' | 'strike' | 'code' | 'heading' | 'quote' | 'bullet' | 'number' | 'divider' | 'link';
export const MARKDOWN_ACTIONS: MarkdownAction[] = ['bold', 'italic', 'strike', 'code', 'heading', 'quote', 'bullet', 'number', 'divider', 'link'];
export interface MarkdownEdit { text: string; start: number; end: number }

const INLINE: Partial<Record<MarkdownAction, string>> = { bold: '**', italic: '*', strike: '~~', code: '`' };
const PREFIX: Partial<Record<MarkdownAction, string>> = { heading: '## ', quote: '> ', bullet: '- ' };
const LIST_LINE = /^\s*(?:[-+*]|\d+[.)])\s+/;

const run = (text: string, from: number, step: -1 | 1, char: string) => {
  let count = 0;
  for (let i = step < 0 ? from - 1 : from; i >= 0 && i < text.length && text[i] === char; i += step) count++;
  return count;
};

// Does the marker already surround [start, end)? "*" must not be read out of "**".
function surrounded(text: string, start: number, end: number, mark: string) {
  if (mark === '*') {
    const before = run(text, start, -1, '*'), after = run(text, end, 1, '*');
    return before % 2 === 1 && after % 2 === 1;
  }
  return text.slice(start - mark.length, start) === mark && text.slice(end, end + mark.length) === mark;
}

function toggleInline(text: string, start: number, end: number, mark: string, placeholder: string): MarkdownEdit {
  if (start === end) {
    if (surrounded(text, start, end, mark))
      return { text: text.slice(0, start - mark.length) + text.slice(end + mark.length), start: start - mark.length, end: start - mark.length };
    const insert = mark + placeholder + mark;
    return { text: text.slice(0, start) + insert + text.slice(end), start: start + mark.length, end: start + mark.length + placeholder.length };
  }
  const selected = text.slice(start, end);
  // Markers cannot span lines on QQ/Discord/KOOK: style each line on its own.
  if (selected.includes('\n')) {
    const lines = selected.split('\n');
    const wrapped = lines.every(line => !line.trim() || (line.trim().startsWith(mark) && line.trim().endsWith(mark) && line.trim().length > 2 * mark.length));
    const next = lines.map(line => {
      if (!line.trim()) return line;
      const lead = line.match(/^\s*/)?.[0] ?? '', tail = line.match(/\s*$/)?.[0] ?? '';
      const core = line.trim();
      return lead + (wrapped ? core.slice(mark.length, core.length - mark.length) : mark + core + mark) + tail;
    }).join('\n');
    return { text: text.slice(0, start) + next + text.slice(end), start, end: start + next.length };
  }
  // Emphasis may not start or end with a space: keep the spaces outside it.
  const lead = selected.length - selected.trimStart().length, tail = selected.length - selected.trimEnd().length;
  const innerStart = start + lead, innerEnd = end - tail;
  if (innerStart >= innerEnd) return { text, start, end };
  if (surrounded(text, innerStart, innerEnd, mark))
    return { text: text.slice(0, innerStart - mark.length) + text.slice(innerStart, innerEnd) + text.slice(innerEnd + mark.length),
      start: innerStart - mark.length, end: innerEnd - mark.length };
  const core = text.slice(innerStart, innerEnd);
  if (core.length > 2 * mark.length && core.startsWith(mark) && core.endsWith(mark) && (mark !== '*' || !core.startsWith('**')))
    return { text: text.slice(0, innerStart) + core.slice(mark.length, -mark.length) + text.slice(innerEnd),
      start: innerStart, end: innerEnd - 2 * mark.length };
  return { text: text.slice(0, innerStart) + mark + core + mark + text.slice(innerEnd),
    start: innerStart + mark.length, end: innerEnd + mark.length };
}

function toggleLines(text: string, start: number, end: number, action: MarkdownAction): MarkdownEdit {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const endAt = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const nextBreak = text.indexOf('\n', endAt);
  const lineEnd = nextBreak < 0 ? text.length : nextBreak;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const filled = lines.filter(line => line.trim());
  const has = (line: string) => action === 'number' ? /^\d+\.\s/.test(line)
    : action === 'heading' ? /^#{1,6}\s/.test(line) : line.startsWith(PREFIX[action] ?? '');
  const remove = filled.length > 0 && filled.every(has);
  let n = 0;
  const next = lines.map(line => {
    if (!line.trim()) return line;
    if (remove) return action === 'number' ? line.replace(/^\d+\.\s/, '')
      : action === 'heading' ? line.replace(/^#{1,6}\s/, '') : line.slice((PREFIX[action] ?? '').length);
    const body = action === 'heading' ? line.replace(/^#{1,6}\s/, '') : line.replace(LIST_LINE, '');
    return action === 'number' ? `${++n}. ${body}` : `${PREFIX[action]}${body}`;
  }).join('\n');
  // QQ only recognizes a list after a blank line when ordinary text precedes it.
  const previous = text.slice(0, Math.max(0, lineStart - 1)).split('\n').pop() ?? '';
  const needsGap = !remove && (action === 'bullet' || action === 'number') && lineStart > 0
    && previous.trim() !== '' && !LIST_LINE.test(previous) && !/^#{1,6}\s/.test(previous);
  const gap = needsGap ? '\n' : '';
  return { text: text.slice(0, lineStart) + gap + next + text.slice(lineEnd),
    start: lineStart + gap.length, end: lineStart + gap.length + next.length };
}

export function applyMarkdown(text: string, start: number, end: number, action: MarkdownAction, placeholder = 'text'): MarkdownEdit {
  const from = Math.max(0, Math.min(start, end, text.length)), to = Math.min(text.length, Math.max(start, end));
  const mark = INLINE[action];
  if (mark) return toggleInline(text, from, to, mark, placeholder);
  if (action === 'divider') {
    const before = from > 0 && text[from - 1] !== '\n' ? '\n' : '';
    const after = to < text.length && text[to] !== '\n' ? '\n' : '';
    const insert = `${before}***${after}`;
    const caret = from + before.length + 3 + after.length;
    return { text: text.slice(0, from) + insert + text.slice(to), start: caret, end: caret };
  }
  if (action === 'link') {
    const label = text.slice(from, to) || placeholder;
    const insert = `[${label}](https://)`;
    const url = from + label.length + 3;
    return { text: text.slice(0, from) + insert + text.slice(to), start: url, end: url + 'https://'.length };
  }
  return toggleLines(text, from, to, action);
}

/** Ctrl/⌘+B and Ctrl/⌘+I, matching common editors. */
export function shortcutAction(event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }): MarkdownAction | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return null;
  const key = event.key.toLowerCase();
  return key === 'b' ? 'bold' : key === 'i' ? 'italic' : null;
}
