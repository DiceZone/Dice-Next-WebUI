import { ApiError } from './api-client';
export interface DeckPackageInfo { files: string[]; images: number; warnings: string[]; }
function headers(): Record<string, string> { const key = localStorage.getItem('dice-api-key'); return key ? { 'X-API-Key': key } : {}; }
export async function sendDeckPackage(file: File, options: { inspect?: boolean; overwrite?: boolean; signal?: AbortSignal } = {}): Promise<DeckPackageInfo> {
  const response = await fetch(`/api/decks/package?${new URLSearchParams({ inspect: options.inspect ? '1' : '0', overwrite: options.overwrite ? '1' : '0' })}`, { method: 'POST', body: file, headers: { ...headers(), 'Content-Type': 'application/octet-stream' }, credentials: 'same-origin', signal: options.signal });
  const result = await response.json();
  if (!response.ok || result.code !== 0) throw new ApiError(result.code || response.status, result.message || 'Deck package import failed');
  return result.data as DeckPackageInfo;
}
export async function fetchDeckPackage(name: string, source?: string): Promise<{ blob: Blob; name: string }> {
  const response = await fetch(`/api/decks/export?${new URLSearchParams({ name, ...(source ? { source } : {}) })}`, { headers: headers(), credentials: 'same-origin' });
  const disposition = response.headers.get('Content-Disposition') || '';
  if (!response.ok || !disposition) { const body = await response.json(); throw new ApiError(body.code || response.status, body.message || 'Deck export failed'); }
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  return { blob: await response.blob(), name: encoded ? decodeURIComponent(encoded) : name };
}
