import React from 'react';
import { MathFormula } from './math-formula';

// Lightweight preview of the Markdown subset that rich platforms render.
// Backslash escapes (`\>`, `\*`) show the literal character, as on Discord/KOOK.
const unescapeMarkdown = (text: string): string => text.replace(/\\([!-/:-@[-`{-~])/g, '$1');

const inlineMarkdown = (text: string, prefix: string): React.ReactNode[] => {
  const pattern = /(\\[!-/:-@[-`{-~]|\$(?:\\.|[^$\\\n])+\$|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|\[[^\]\n]+\]\([^)\n]+\))/g;
  const out: React.ReactNode[] = [];
  let last = 0, index = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const token = match[0];
    const key = `${prefix}-${index++}`;
    if (token.startsWith('\\')) out.push(token.slice(1));
    else if (token.startsWith('$')) out.push(<MathFormula key={key} text={token.slice(1, -1)} />);
    else if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__')))
      out.push(<strong key={key}>{unescapeMarkdown(token.slice(2, -2))}</strong>);
    else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_')))
      out.push(<em key={key}>{unescapeMarkdown(token.slice(1, -1))}</em>);
    else if (token.startsWith('~~')) out.push(<del key={key}>{unescapeMarkdown(token.slice(2, -2))}</del>);
    else if (token.startsWith('`')) out.push(<code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{token.slice(1, -1)}</code>);
    else {
      const parsed = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      // Preview text may contain custom templates. Never turn javascript:/data:
      // or other executable protocols into clickable links.
      const safe = parsed && /^(?:https?:\/\/|#)/i.test(parsed[2].trim());
      out.push(parsed && safe ? <a key={key} href={parsed[2]} className="text-primary underline" target="_blank" rel="noreferrer">{unescapeMarkdown(parsed[1])}</a> : token);
    }
    last = start + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

// Preview pipe tables produced by the editor. Keep escaped pipes inside their cell.
function tableCells(line: string) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return [];
  const cells: string[] = [];
  let cell = '';
  for (let i = 1; i < trimmed.length - 1; i++) {
    const ch = trimmed[i];
    if (ch === '\\' && i + 1 < trimmed.length - 1) cell += ch + trimmed[++i];
    else if (ch === '|') { cells.push(cell.trim()); cell = ''; }
    else cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

export const MarkdownExample: React.FC<{ text: string; enabled: boolean }> = ({ text, enabled }) => {
  if (!enabled) return <div className="whitespace-pre-wrap break-words">{text}</div>;
  const lines = text.split(/\r?\n/);
  let nextLine = 0;
  return <div className="space-y-1 break-words">{lines.map((line, i) => {
    if (i < nextLine) return null;
    const header = tableCells(line), separator = tableCells(lines[i + 1] ?? '');
    if (header.length && header.length === separator.length && separator.every(cell => /^:?-{3,}:?$/.test(cell))) {
      const rows: string[][] = [];
      nextLine = i + 2;
      while (nextLine < lines.length) {
        const cells = tableCells(lines[nextLine]);
        if (!cells.length) break;
        rows.push(cells);
        nextLine++;
      }
      return <div key={i} className="max-w-full overflow-x-auto"><table className="border-collapse text-left text-sm">
        <thead><tr>{header.map((cell, c) => <th key={c} className="border px-2 py-1">{inlineMarkdown(cell, 'h' + c)}</th>)}</tr></thead>
        <tbody>{rows.map((row, r) => <tr key={r}>{header.map((_, c) => <td key={c} className="border px-2 py-1">{inlineMarkdown(row[c] ?? '', r + '-' + c)}</td>)}</tr>)}</tbody>
      </table></div>;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) return <div key={i} className="font-bold" style={{ fontSize: `${Math.max(1, 1.45 - heading[1].length * 0.08)}rem` }}>{inlineMarkdown(heading[2], `h${i}`)}</div>;
    if (/^>\s?/.test(line)) return <blockquote key={i} className="border-l-2 border-primary/40 pl-3 text-muted-foreground">{inlineMarkdown(line.replace(/^>\s?/, ''), `q${i}`)}</blockquote>;
    if (/^\s*(?:\*\s*){3,}$|^\s*(?:-\s*){3,}$|^\s*(?:_\s*){3,}$/.test(line)) return <hr key={i} className="my-2 border-border" />;
    if (/^[-+*]\s+/.test(line)) return <div key={i} className="flex gap-2"><span>•</span><span>{inlineMarkdown(line.replace(/^[-+*]\s+/, ''), `l${i}`)}</span></div>;
    const ordered = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (ordered) return <div key={i} className="flex gap-2"><span className="tabular-nums">{ordered[1]}.</span><span>{inlineMarkdown(ordered[2], `o${i}`)}</span></div>;
    if (!line) return <div key={i} className="h-2" />;
    return <div key={i}>{inlineMarkdown(line, `p${i}`)}</div>;
  })}</div>;
};
