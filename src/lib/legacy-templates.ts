import type { OutcomeMetadata } from './outcome-replies.js';

/** Display-only examples. Rule evaluation and random rolls remain on the backend. */
export function legacyTemplatePreviewArgs(
  base: Record<string, string>, key: string, labels: Record<string, string>, outcome?: OutcomeMetadata,
): Record<string, string> {
  if (!key.startsWith('dice.compat.')) return base;
  const grade = key.startsWith('dice.compat.check.single.') ? key.substring(key.lastIndexOf('.') + 1) : outcome?.grade ?? 'regular';
  const rank = ({ fumble: 0, failure: 1, regular: 2, hard: 3, extreme: 4, critical: 5 } as Record<string, number>)[grade] ?? 2;
  const result = ({ critical: 1, extreme: 10, hard: 25, regular: 50, failure: 80, fumble: 100 } as Record<string, number>)[grade] ?? 50;
  const args = { ...base, rank: String(rank), result: String(result), roll: '1D100=' + result, res: '1D100=' + result,
    rate: '60', level: labels[grade] ?? grade };
  if (key.startsWith('dice.compat.sanity.')) {
    const loss = rank >= 2 ? '0' : rank === 0 ? '6' : '3';
    return { ...args, attr: '理智', san: '60', res: args.roll + '/60', loss,
      change: loss === '0' ? '0' : rank === 0 ? 'Max{1d6}=6' : '1D6=3', final: String(60 - Number(loss)) };
  }
  if (key.startsWith('dice.compat.growth.')) {
    const unchanged = key.endsWith('.unchanged'), passed = !unchanged && !key.endsWith('.failure');
    const growthRoll = passed ? '70' : '42';
    const level = labels[passed ? 'regular' : 'failure'] ?? (passed ? 'regular' : 'failure');
    return { ...args, result: growthRoll, roll: '1D100=' + growthRoll, res: '1D100=' + growthRoll + '/60 ' + level, level,
      change: unchanged ? '' : passed ? '1D10=5' : '-1', final: unchanged ? '60' : passed ? '65' : '59' };
  }
  return args;
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
