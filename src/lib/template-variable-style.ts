export type VariableStyle = 'plain' | 'bold' | 'italic' | 'code' | 'strike';
export const VARIABLE_STYLES: VariableStyle[] = ['plain', 'bold', 'italic', 'code', 'strike'];

const escapedAt = (text: string, pos: number): boolean => {
  let slashes = 0;
  while (pos > 0 && text[--pos] === '\\') slashes++;
  return slashes % 2 === 1;
};

function variableRange(text: string, pos: number, token: string) {
  let start = pos, end = pos + token.length;
  let style: VariableStyle = 'plain';
  let changed = true;
  while (changed) {
    changed = false;
    const ticks = text.slice(0, start).match(/`+$/)?.[0];
    const wrappers: [string, VariableStyle][] = [
      ...(ticks ? [[ticks, 'code'] as [string, VariableStyle]] : []),
      ['***', 'bold'], ['___', 'bold'], ['**', 'bold'], ['__', 'bold'],
      ['~~', 'strike'], ['*', 'italic'], ['_', 'italic'],
    ];
    for (const [mark, nextStyle] of wrappers) {
      const left = start - mark.length;
      if (left < 0 || text.slice(left, start) !== mark || text.slice(end, end + mark.length) !== mark
        || escapedAt(text, left) || escapedAt(text, end)) continue;
      // Do not mistake multiplication or word-internal underscores for emphasis.
      if ((mark === '*' || mark.includes('_'))
        && /[\p{L}\p{N}]/u.test(text[left - 1] ?? '')
        && /[\p{L}\p{N}]/u.test(text[end + mark.length] ?? '')) continue;
      start = left; end += mark.length; style = nextStyle; changed = true;
      break;
    }
  }
  return { start, end, style };
}

export function wrapVariable(name: string, style: VariableStyle): string {
  const token = `{${name}}`;
  const mark = { plain: '', bold: '**', italic: '*', code: '`', strike: '~~' }[style];
  return mark + token + mark;
}

export function variableStyleOf(text: string, name: string): VariableStyle {
  const token = `{${name}}`;
  let pos = text.indexOf(token);
  while (pos !== -1) {
    if (!escapedAt(text, pos)) return variableRange(text, pos, token).style;
    pos = text.indexOf(token, pos + token.length);
  }
  return 'plain';
}

export function restyleVariable(text: string, name: string, style: VariableStyle): string {
  const token = `{${name}}`;
  let cursor = 0, output = '', pos = text.indexOf(token);
  while (pos !== -1) {
    if (escapedAt(text, pos)) { pos = text.indexOf(token, pos + token.length); continue; }
    const range = variableRange(text, pos, token);
    output += text.slice(cursor, range.start) + wrapVariable(name, style);
    cursor = range.end;
    pos = text.indexOf(token, cursor);
  }
  return output + text.slice(cursor);
}
