import { readTemplateVariants, writeTemplateVariants, WEIGHTED_TEMPLATE_PREFIX } from './weighted-templates.js';

export type TemplateFormat = 'plain' | 'markdown';
export interface OutcomeMetadata { family: string; grade: string; }
export interface OutcomeText {
  key: string;
  default: string;
  override: string | null;
  format: TemplateFormat;
  defaultFormat: TemplateFormat;
  presets?: Partial<Record<'traditional' | 'standard' | 'visual', { value: string; format: TemplateFormat }>>;
  presetStyle?: 'traditional' | 'standard' | 'visual';
  outcome?: OutcomeMetadata;
  fallbackKeys?: string[];
  /** Line the backend appends when this slot uses the standard slot's text. */
  inheritedDetailKey?: string;
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

export function reasonReplyBase(key: string): string | undefined {
  return key === 'dice.roll.result_reason' ? 'dice.roll.result'
    : key === 'dice.roll.multi_reason' ? 'dice.roll.multi' : undefined;
}

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
  const reasonBase = reasonReplyBase(text.key);
  if (reasonBase) return configuredText(text, persona) ?? configuredText(index.get(reasonBase), persona)
    ?? { key: text.key, value: text.default, format: text.defaultFormat, layer: 'builtin' };
  if (!text.outcome) return undefined;
  const resolved = resolveOutcomeSlot(text, text.outcome, index, persona);
  // The standard text cannot show SAN loss, growth or the other side of a
  // contest; the backend appends the family's detail line, so the preview does too.
  if (!resolved || !text.inheritedDetailKey || !resolved.key.startsWith('dice.outcome.standard.')) return resolved;
  return { ...resolved, value: withDetailLine(resolved.value, text.inheritedDetailKey) };
}

function withDetailLine(value: string, detailKey: string): string {
  const line = '\n{text:' + detailKey + '}';
  if (!value.startsWith(WEIGHTED_TEMPLATE_PREFIX)) return value === '' ? value : value + line;
  return writeTemplateVariants(readTemplateVariants(value).map(item => ({ ...item, text: item.text === '' ? '' : item.text + line })));
}

function resolveOutcomeSlot(
  text: OutcomeText, outcome: OutcomeMetadata, index: ReadonlyMap<string, OutcomeText>, persona: PersonaTexts,
): ResolvedOutcomeText | undefined {
  for (const key of [text.key, ...(text.fallbackKeys ?? [])]) {
    let row = key === text.key ? text : index.get(key);
    if (!row) continue;
    const optional = key.startsWith('dice.outcome.');
    // The representative successful SAN preview has zero loss.
    if (!optional && outcome.family === 'sanity' && !['failure', 'fumble'].includes(outcome.grade))
      row = index.get('card.sc.result_noloss') ?? row;
    const entry = persona[row.key];
    if (entry && (!optional || entry.value !== ''))
      return { key: row.key, value: entry.value, format: entry.format, layer: 'persona' };
    if (row.override !== null && (!optional || row.override !== ''))
      return { key: row.key, value: row.override, format: row.format, layer: 'global' };
    if (!optional) {
      const legacy = legacyCheckFallback(row, outcome, index, persona);
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
