/** Lint metadata only; the backend remains the sole template evaluator. */
export function templateLocalNames(text: string): string[] {
  const names = new Set<string>();
  let budget = 100000;
  const escaped = (pos: number) => {
    let count = 0; for (let i = pos - 1; i >= 0 && text[i] === '\\'; --i) count++;
    return count % 2 !== 0;
  };
  for (let start = text.indexOf('{var:'); start >= 0 && budget > 0; start = text.indexOf('{var:', start + 5)) {
    if (escaped(start)) continue;
    let depth = 0, segment = start + 5;
    const assignments: string[] = [];
    for (let pos = segment; pos < text.length && budget-- > 0; ++pos) {
      if (text[pos] === '\\') { pos++; continue; }
      if (text[pos] === '{') depth++;
      else if (text[pos] === '}') {
        if (depth === 0) { assignments.push(text.slice(segment, pos)); break; }
        depth--;
      } else if (text[pos] === '&' && depth === 0) {
        assignments.push(text.slice(segment, pos)); segment = pos + 1;
      }
    }
    for (const assignment of assignments) {
      const match = /^([^\s.{}:?&|=/\\\x00-\x1f\x7f]{1,128})[?=]/u.exec(assignment);
      if (match && new TextEncoder().encode(match[1]).length <= 128) names.add(match[1]);
    }
  }
  return [...names];
}

export type LegacyTextStatus = 'active' | 'partial' | 'preserved' | 'conflict';
export interface LegacyTextDetail {
  source: string; target: string; status: LegacyTextStatus; issues: string[];
  locale?: string; personaId?: number;
}
export interface LegacyTextReport { items: LegacyTextDetail[]; appliedAt?: string; }

/** Older backends may omit this report; malformed records never look successful. */
export function readLegacyTextReport(value: unknown): LegacyTextReport | null {
  const source = Array.isArray(value) ? { items: value } : value;
  if (!source || typeof source !== 'object' || !('items' in source) || !Array.isArray(source.items)) return null;
  const statuses = new Set(['active', 'partial', 'preserved', 'conflict']);
  const items: LegacyTextDetail[] = [];
  for (const row of source.items) {
    if (!row || typeof row !== 'object' || typeof row.source !== 'string' || typeof row.target !== 'string' || !statuses.has(row.status)) continue;
    items.push({ source: row.source, target: row.target, status: row.status,
      issues: Array.isArray(row.issues) ? row.issues.filter((issue: unknown): issue is string => typeof issue === 'string') : [],
      ...(typeof row.locale === 'string' ? { locale: row.locale } : {}),
      ...(Number.isSafeInteger(row.personaId) && row.personaId > 0 ? { personaId: row.personaId } : {}) });
  }
  return { items, ...('appliedAt' in source && typeof source.appliedAt === 'string' ? { appliedAt: source.appliedAt } : {}) };
}

export function legacyTextCounts(items: readonly LegacyTextDetail[]): Record<LegacyTextStatus, number> {
  const counts = { active: 0, partial: 0, preserved: 0, conflict: 0 };
  for (const item of items) ++counts[item.status];
  return counts;
}

export function legacyTextIssue(issue: string): { key: string; detail: string } {
  const prefixes: Record<string, string> = {
    'unavailable condition field: ': 'condition', 'unavailable variable: ': 'variable',
    'unverified text reference: ': 'reference', 'unsupported macro: ': 'unsupported',
    'cyclic text reference: ': 'cycle',
  };
  for (const [prefix, key] of Object.entries(prefixes))
    if (issue.startsWith(prefix)) return { key, detail: issue.slice(prefix.length) };
  if (issue.startsWith('invalid ')) return { key: 'invalid', detail: issue.slice(8).replace(/ macro$/, '') };
  if (issue === 'template nesting/node limit') return { key: 'limit', detail: '' };
  if (issue === 'unclosed template brace') return { key: 'unclosed', detail: '' };
  if (issue === 'no audited mapping') return { key: 'mapping', detail: '' };
  return { key: 'other', detail: issue };
}
