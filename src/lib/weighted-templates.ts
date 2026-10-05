export interface TemplateVariant { text: string; weight: number; }
export interface PersonaWeight { id: number; weight: number; }
export const WEIGHTED_TEMPLATE_PREFIX = '@dicenext:weighted:v1\n';
export const MAX_TEMPLATE_WEIGHT = 999999;

export function validWeights(items: { weight: number }[]): boolean {
  return items.length > 0 && items.length <= 256
    && items.every(item => Number.isInteger(item.weight) && item.weight >= 0 && item.weight <= MAX_TEMPLATE_WEIGHT)
    && items.some(item => item.weight > 0);
}

export function probabilities(items: { weight: number }[]): number[] {
  const total = items.reduce((sum, item) => sum + (Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 0), 0);
  return items.map(item => total > 0 && item.weight > 0 ? item.weight / total * 100 : 0);
}

export function readTemplateVariants(value: string): TemplateVariant[] {
  if (value.startsWith(WEIGHTED_TEMPLATE_PREFIX)) {
    try {
      const items: unknown = JSON.parse(value.slice(WEIGHTED_TEMPLATE_PREFIX.length));
      if (Array.isArray(items) && items.length > 0 && items.length <= 256
        && items.every(item => item && typeof item.text === 'string' && typeof item.weight === 'number'))
        return items as TemplateVariant[];
    } catch { /* Legacy text is literal unless it is a valid native container. */ }
  }
  return [{ text: value, weight: 1 }];
}

// Preserve single-template exports and existing .strXXX behavior. This also
// serializes invalid drafts; validation happens on save, not on each keystroke.
export function writeTemplateVariants(items: TemplateVariant[]): string {
  if (items.length === 1 && items[0].weight === 1) return items[0].text;
  return WEIGHTED_TEMPLATE_PREFIX + JSON.stringify(items);
}

export function templateSummary(value: string): string {
  return readTemplateVariants(value).map(item => item.text).join('\n');
}

// Only convert a complete outer sample, never a sample embedded in a sentence.
// Delimiters nested in variables/macros belong to the selected branch.
export function splitLegacySample(text: string): string[] | null {
  if (!text.startsWith('{sample:') || !text.endsWith('}')) return null;
  let depth = 0, start = 8;
  const out: string[] = [];
  for (let i = start; i < text.length; i++) {
    let slashes = 0;
    for (let j = i - 1; j >= 0 && text[j] === '\\'; --j) slashes++;
    if (slashes % 2 && (text[i] === '{' || text[i] === '}')) continue;
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      if (!depth) {
        if (i !== text.length - 1) return null;
        out.push(text.slice(start, i));
        return out;
      }
      depth--;
    } else if (text[i] === '|' && depth === 0) {
      out.push(text.slice(start, i)); start = i + 1;
    }
  }
  return null;
}
