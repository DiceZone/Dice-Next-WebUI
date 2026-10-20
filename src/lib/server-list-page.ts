export interface ServerListPage<T> { items: T[]; total: number; page: number; size: number; }

/** Do not fall back to fetching an entire list when an older server lacks pagination. */
export function readServerListPage<T>(value: unknown): ServerListPage<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid paginated response');
  const page = value as ServerListPage<T>;
  if (!Array.isArray(page.items) || !Number.isSafeInteger(page.total) || page.total < 0
      || !Number.isSafeInteger(page.page) || page.page < 1 || !Number.isSafeInteger(page.size) || page.size < 1
      || page.size > 100 || page.items.length > page.size || page.items.length > page.total)
    throw new Error('Invalid paginated response');
  return page;
}

export function serverListUrl(endpoint: '/logs' | '/game-sessions', page: number, size: number,
  query: string, sort: string, direction: 'asc' | 'desc'): string {
  const params = new URLSearchParams({ page: String(page), size: String(size), sort, dir: direction });
  if (query.trim()) params.set('q', query.trim());
  return `${endpoint}?${params}`;
}
