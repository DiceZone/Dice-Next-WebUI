export type DeckDocument = Record<string, unknown>;
export const DECK_METADATA = new Set(['_title', '_author', '_version', '_date', '_brief', '_meta']);

export function parseDeckDocument(content: string, importing = false): DeckDocument {
  const value: unknown = JSON.parse(content);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_deck');
  if (importing && Object.values(value).some((entry) => !Array.isArray(entry))) throw new Error('invalid_deck');
  return value as DeckDocument;
}

export function editableEntries(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

// Replace only the selected field. Do not flatten newlines or interpret weights
// and references; arbitrary extension fields and _meta must survive round trips.
export function replaceDeckEntries(content: string, name: string, entries: string[]): string {
  return JSON.stringify({ ...parseDeckDocument(content), [name]: entries }, null, 2);
}

export function addDeckGroup(content: string, name: string): string {
  const document = parseDeckDocument(content);
  const key = name.trim();
  if (!key || Object.prototype.hasOwnProperty.call(document, key)) throw new Error('invalid_name');
  return JSON.stringify({ ...document, [key]: [] }, null, 2);
}
