export type DeckDocument = Record<string, unknown>;
export const DECK_METADATA = new Set(['_title', '_author', '_version', '_date', '_brief', '_meta']);

export interface DeckFileIdentity {
  filename: string;
  source?: 'builtin' | 'user';
  readonly?: boolean;
}

export function isReadonlyDeck(file: DeckFileIdentity): boolean {
  return file.source === 'builtin' || file.readonly === true;
}

export function deckFileKey(file: DeckFileIdentity): string {
  return JSON.stringify([file.source ?? (file.readonly ? 'builtin' : 'user'), file.filename]);
}

export function canCopyDeckGroup(file: DeckFileIdentity, name: string | undefined, document: DeckDocument | null): boolean {
  if (!isReadonlyDeck(file) || !name || name.startsWith('_') || !document || !Object.prototype.hasOwnProperty.call(document, name)) return false;
  return Array.isArray(document[name]) && document[name].length > 0;
}

export function deckCopyFilename(name: string): string {
  let base = Array.from(name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')).slice(0, 100).join('').replace(/[. ]+$/g, '') || 'deck';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base)) base = `_${base}`;
  return `${base}.json`;
}

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
