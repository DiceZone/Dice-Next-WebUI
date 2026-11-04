import type { TemplateFormat } from './outcome-replies';

export type PresentationKind = 'action' | 'bar' | 'math';
export type PresentationStyle = 'traditional' | 'standard' | 'visual';
export interface TemplatePreset { value: string; format: TemplateFormat; }
export interface PresentationComponent { kind: PresentationKind; fields: string[]; start: number; end: number; }

// Offsets keep surrounding prose, samples and unknown syntax untouched.
export function presentationComponents(text: string): PresentationComponent[] {
  return [...text.matchAll(/\[\[(action|bar|math):([\s\S]*?)\]\]/g)].flatMap(match => {
    const kind = match[1] as PresentationKind;
    const body = match[2];
    const first = body.indexOf('|');
    const second = kind === 'bar' ? body.indexOf('|', first + 1) : -1;
    if (first < 0 || (kind === 'bar' && second < 0)) return [];
    const fields = kind === 'bar'
      ? [body.slice(0, first), body.slice(first + 1, second), body.slice(second + 1)]
      : [body.slice(0, first), body.slice(first + 1)];
    return [{ kind, fields, start: match.index, end: match.index + match[0].length }];
  });
}
export const componentSource = (kind: PresentationKind, fields: string[]) => `[[${kind}:${fields.join('|')}]]`;
export function replaceComponent(text: string, component: PresentationComponent, fields: string[] | null) {
  return text.slice(0, component.start) + (fields ? componentSource(component.kind, fields) : '') + text.slice(component.end);
}
export function componentFieldValid(kind: PresentationKind, index: number, value: string) {
  return !value.includes(']]') && !/[\r\n]/.test(value)
    && (kind === 'action' && index === 1 || !value.includes('|'))
    && (kind !== 'math' || index !== 0 || !value.includes('$'));
}
export function presentationIssues(text: string): boolean {
  return presentationComponents(text).some(component => component.fields.some((field, index) =>
    !field.trim() || !componentFieldValid(component.kind, index, field)));
}
export function variablesOutsidePresentation(text: string): string[] {
  // Formula braces belong to TeX; only {{name}} is a formula variable.
  let ordinary = text;
  const math: string[] = [];
  for (const component of presentationComponents(text).reverse()) {
    if (component.kind === 'math') {
      math.push(...[...component.fields[0].matchAll(/\{\{([^{}]+)\}\}/g)].map(match => match[1]));
      ordinary = ordinary.slice(0, component.start) + component.fields[1] + ordinary.slice(component.end);
    } else if (component.kind === 'bar') {
      ordinary = ordinary.slice(0, component.start) + ordinary.slice(component.end);
    }
  }
  return [...math, ...[...ordinary.matchAll(/\{([^{}]+)\}/g)].map(match => match[1])];
}
