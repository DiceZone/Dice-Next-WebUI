import type { OutcomeMetadata } from './outcome-replies';

export interface TemplateSimulation {
  version: 1;
  seed: number;
  command: string;
  family: string;
  grade: string;
  args: Record<string, string>;
  unresolved: string[];
  issues: string[];
}

/** Send identity/branch metadata, never a frontend approximation of dice rules.
 * The original key stays intact even when the text comes from a standard slot. */
export function previewSimulation(key: string, sourceKey: string, seed: number, outcome?: OutcomeMetadata) {
  return { version: 1, key, sourceKey, seed: seed >>> 0, ...(outcome ? { outcome } : {}) };
}

export function readTemplateSimulation(data: unknown): TemplateSimulation | null {
  if (!data || typeof data !== 'object') return null;
  const s = (data as { simulation?: TemplateSimulation }).simulation;
  if (!s || s.version !== 1 || !Number.isInteger(s.seed) || s.seed < 0 || s.seed > 0xffffffff
    || typeof s.command !== 'string' || typeof s.family !== 'string' || typeof s.grade !== 'string'
    || !s.args || Array.isArray(s.args) || typeof s.args !== 'object'
    || !Object.values(s.args).every(value => typeof value === 'string')
    || !Array.isArray(s.unresolved) || !s.unresolved.every(value => typeof value === 'string')
    || !Array.isArray(s.issues) || !s.issues.every(value => typeof value === 'string')) return null;
  return s;
}
