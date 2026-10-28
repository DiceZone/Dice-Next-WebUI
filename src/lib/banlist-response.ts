/** Arrays have an inherited entries() method. Never pass that function to a
 * React state setter when an older backend returns a bare list. */
export function readBanlistEntries<T>(value: unknown): T[] | null {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== 'object') return null;
  const entries = (value as { entries?: unknown }).entries;
  return Array.isArray(entries) ? entries as T[] : null;
}
