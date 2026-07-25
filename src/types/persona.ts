/**
 * C#28-B: Persona switching system — TypeScript types
 */

export interface PersonaTemplate {
  id: number;
  name: string;
  description: string;
  isBuiltin: boolean;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonaEntry {
  id: number;
  personaId: number;
  locale: string;
  key: string;
  value: string;
}

export interface PersonaExport {
  name: string;
  description: string;
  isBuiltin: boolean;
  entries: PersonaEntry[];
}

export interface ActivePersonaInfo {
  activeId: number;
  name?: string;
  description?: string;
  globalId: number;
}
