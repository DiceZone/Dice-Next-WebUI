export type TemplateFormat = 'plain' | 'markdown';
export interface OutcomeMetadata { family: string; grade: string; }
export interface OutcomeText {
  key: string;
  default: string;
  override: string | null;
  format: TemplateFormat;
  defaultFormat: TemplateFormat;
  outcome?: OutcomeMetadata;
  fallbackKeys?: string[];
  legacyCompatibility?: boolean;
  legacyReferences?: string[];
}
export interface ResolvedOutcomeText {
  key: string;
  value: string;
  format: TemplateFormat;
  layer: 'persona' | 'global' | 'builtin';
}
export type PersonaTexts = Record<string, { value: string; format: TemplateFormat }>;

function configuredText(row: OutcomeText | undefined, persona: PersonaTexts): ResolvedOutcomeText | undefined {
  if (!row) return undefined;
  const entry = persona[row.key];
  if (entry) return { key: row.key, ...entry, layer: 'persona' };
  if (row.override !== null) return { key: row.key, value: row.override, format: row.format, layer: 'global' };
  return undefined;
}

/** Mirror only template precedence/assembly, not dice rules. References are
 * left authored so the backend samples and formats their current values. */
function legacyCheckFallback(
  native: OutcomeText, outcome: OutcomeMetadata, index: ReadonlyMap<string, OutcomeText>, persona: PersonaTexts,
): ResolvedOutcomeText | undefined {
  const { family, grade } = outcome;
  const read = (key: string) => configuredText(index.get(key), persona);
  const resolved = (key: string, trigger: ResolvedOutcomeText) => {
    const row = index.get(key);
    return read(key) ?? (row ? { key, value: row.default, format: row.defaultFormat, layer: trigger.layer } : undefined);
  };
  if (['standard', 'bonus', 'penalty'].includes(family) && ['critical', 'extreme', 'hard', 'regular', 'failure', 'fumble'].includes(grade)) {
    const prefixKey = native.key.endsWith('_reason') ? 'dice.compat.check.prefix_reason' : 'dice.compat.check.prefix';
    const prefix = read('dice.compat.check.prefix') ?? read('dice.compat.check.prefix_reason');
    const singleKey = 'dice.compat.check.single.' + grade, single = read(singleKey);
    const levelKey = single ? singleKey : 'dice.level.' + grade;
    if (prefix) {
      const source = resolved(prefixKey, prefix);
      if (source) return { ...source, value: '{text:' + prefixKey + '}{roll}/{rate} {text:' + levelKey + '}' };
    }
    if (single) return { ...single, value: native.default.split('{level}').join('{text:' + singleKey + '}'), format: native.defaultFormat };
  }
  if (family === 'sanity') {
    const source = read('dice.compat.sanity.result');
    if (source) return source;
  }
  if (family === 'growth') {
    const key = grade === 'regular' ? 'dice.compat.growth.success' : 'dice.compat.growth.unchanged';
    const trigger = read(key) ?? read('dice.compat.growth.base');
    if (trigger) return resolved(key, trigger);
  }
  return undefined;
}

/** Do not recursively use the standard slot's legacy fallback: SAN/growth/etc
 * must retain their own original command template when both slots are unset. */
export function resolveOutcomeText(
  text: OutcomeText, index: ReadonlyMap<string, OutcomeText>, persona: PersonaTexts = {},
): ResolvedOutcomeText | undefined {
  if (!text.outcome) return undefined;
  for (const key of [text.key, ...(text.fallbackKeys ?? [])]) {
    let row = key === text.key ? text : index.get(key);
    if (!row) continue;
    const optional = key.startsWith('dice.outcome.');
    // The representative successful SAN preview has zero loss.
    if (!optional && text.outcome.family === 'sanity' && !['failure', 'fumble'].includes(text.outcome.grade))
      row = index.get('card.sc.result_noloss') ?? row;
    const entry = persona[row.key];
    if (entry && (!optional || entry.value !== ''))
      return { key: row.key, value: entry.value, format: entry.format, layer: 'persona' };
    if (row.override !== null && (!optional || row.override !== ''))
      return { key: row.key, value: row.override, format: row.format, layer: 'global' };
    if (!optional) {
      const legacy = legacyCheckFallback(row, text.outcome, index, persona);
      if (legacy) return legacy;
    }
    if (!optional || row.default !== '')
      return { key: row.key, value: row.default, format: row.defaultFormat, layer: 'builtin' };
  }
  return undefined;
}

/** Reset only the layer being edited; persona reset still inherits global text
 * at the same key before considering the standard outcome slot. */
export function resolveOutcomeInheritance(
  text: OutcomeText, index: ReadonlyMap<string, OutcomeText>, persona?: PersonaTexts,
): ResolvedOutcomeText | undefined {
  if (persona) {
    const remaining = { ...persona };
    delete remaining[text.key];
    return resolveOutcomeText(text, index, remaining);
  }
  return resolveOutcomeText({ ...text, override: null }, index);
}

/** Representative values are display-only, not a second implementation of rules. */
export function outcomePreviewArgs(
  base: Record<string, string>, outcome: OutcomeMetadata | undefined, labels: Record<string, string>,
): Record<string, string> {
  if (!outcome) return base;
  const { family, grade } = outcome;
  const dnd = family === 'dnd_check' || family === 'death_save';
  let result = ({ critical: 1, extreme: 10, hard: 25, regular: 50, failure: 80, fumble: 100, special: 10, tie: 80 } as Record<string, number>)[grade] ?? 42;
  let rate = 60;
  if (dnd) { result = ({ critical: 20, regular: 15, failure: 5, fumble: 1 } as Record<string, number>)[grade] ?? 15; rate = family === 'death_save' ? 10 : 15; }
  if (family === 'growth') result = grade === 'regular' ? 70 : 42;
  if (family === 'opposed') result = grade === 'regular' ? 10 : 80;
  const passed = !['failure', 'fumble', 'tie'].includes(grade);
  const level = labels[grade] ?? grade;
  const roll = `${dnd ? '1D20' : '1D100'}=${result}`;
  const args = { ...base, result: String(result), roll, res: roll, rate: String(rate), level, outcome: level,
    san: String(rate), grade: passed ? labels.regular : level, loss: passed ? '0' : '3', final: String(rate - (passed ? 0 : 3)),
    change: passed ? '1D10=5' : '', target: family === 'resist' ? String(rate) : '调查员', gid: base.group ?? '100000', receipt: level,
    detail: `${roll}=${result} ${level}`, total: String(result), threshold: String(rate), mod: '0', turn: '1',
    s: passed && grade !== 'critical' ? '1' : '0', f: grade === 'fumble' ? '2' : passed ? '0' : '1',
    la: '侦查', lb: '隐匿', ra: String(result), rb: grade === 'regular' ? '80' : grade === 'failure' ? '10' : '80',
    va: String(rate), vb: String(rate), lva: grade === 'regular' ? labels.extreme : labels.failure,
    lvb: grade === 'failure' ? labels.extreme : labels.failure,
  };
  if (family === 'sanity') args.res = String(result);
  if (family === 'psychology' || family === 'death_save') args.roll = String(result);
  if (family === 'growth') { args.res = `${roll}/${rate}`; args.final = String(rate + (passed ? 5 : 0)); }
  return args;
}
