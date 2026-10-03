import type { Adapter } from '@/types/adapter';

export type PersonaPolicy = Required<Pick<Adapter, 'personaSelection' | 'selectablePersonaIds' | 'defaultPersonaId'>>;

/** Only persona fields: never resend connection settings or masked credentials. */
export function readPersonaPolicy(adapter: Partial<PersonaPolicy>): PersonaPolicy {
  return {
    personaSelection: adapter.personaSelection ?? 'all',
    selectablePersonaIds: [...new Set(adapter.selectablePersonaIds ?? [])].sort((a, b) => a - b),
    defaultPersonaId: adapter.defaultPersonaId ?? 0,
  };
}

export function samePersonaPolicy(a: PersonaPolicy, b: PersonaPolicy): boolean {
  return JSON.stringify(readPersonaPolicy(a)) === JSON.stringify(readPersonaPolicy(b));
}
