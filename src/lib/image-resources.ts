import { apiClient, ApiError } from './api-client';

export interface ImageResource {
  id: string; path: string; name: string; isDirectory: boolean; size: number; modified: number;
  references: number; code: string; protected?: boolean; url?: string;
}
export interface MigrationStatus { status: string; copied: number; warnings: string[]; error?: string; }
export interface ResourceListing { items: ImageResource[]; total: number; page: number; size: number; directory: string; root: string; referencesCheckedAt?: string; migration?: MigrationStatus; recoveryWarnings?: string[]; }
export interface ResourceUsage { path: string; id: string; label: string; type: string; }
export interface ResourceOperation { completed: number | string[]; referencesUpdated?: number; warnings?: string[]; recoverable?: boolean; }
export type ResourceSort = 'name' | 'path' | 'size' | 'modified';
export const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.bmp,.ico,.avif,.svg';
export const imageResourceCode = (path: string) => `[img,file=data/images/${path.replace(/&/g,'&amp;').replace(/,/g,'&#44;').replace(/\[/g,'&#91;').replace(/\]/g,'&#93;')}]`;
export function managedImageSource(value: string): string {
  const reference = value.replace(/&#44;/g,',').replace(/&#91;/g,'[').replace(/&#93;/g,']').replace(/&amp;/g,'&').replace(/\\/g,'/');
  if (reference.startsWith('data/images/')) return `/api/resources/images/content?${new URLSearchParams({ id: reference })}`;
  const old = /^data\/assets\/([^/]+)$/.exec(reference) || /\/api\/assets\/([^/?#]+)$/.exec(reference);
  return old ? `/api/assets/${old[1]}` : reference;
}
export function resourceUrl(directory: string, page: number, size: number, query: string, sort: ResourceSort, descending: boolean, trash = false) {
  return `/resources/images?${new URLSearchParams({ directory, page: String(page), size: String(size), q: query.trim(), sort, dir: descending ? 'desc' : 'asc', trash: trash ? '1' : '0' })}`;
}
export function joinResourcePath(directory: string, name: string) { return directory ? `${directory}/${name}` : name; }
export async function resourceOperation(action: string, paths: string[], target = '', overwrite = false) {
  return (await apiClient.post<ResourceOperation>('/resources/images/operation', { action, paths, target, overwrite })).data;
}
export async function resourceUsages(path: string) {
  const result = (await apiClient.get<{ items: ResourceUsage[]; warnings: (string | { document: string; error: string })[]; dynamicReferencesUncertain: boolean }>(`/resources/images/usages?${new URLSearchParams({ path })}`)).data;
  return { ...result, warnings: result.warnings.map((warning) => typeof warning === 'string' ? warning : `${warning.document}: ${warning.error}`) };
}
function authHeaders(): Record<string, string> {
  const key = localStorage.getItem('dice-api-key');
  return key ? { 'X-API-Key': key } : {};
}
export async function resourceArchive(paths: string[]) {
  const response = await fetch('/api/resources/images/archive', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ paths }) });
  if (!response.ok || !response.headers.get('Content-Disposition')) { const body = await response.json(); throw new ApiError(body.code || response.status, body.message || 'Archive failed'); }
  return response.blob();
}
export async function importResourceArchive(file: File, directory: string, overwrite = false) {
  const response = await fetch(`/api/resources/images/extract?${new URLSearchParams({ directory, overwrite: overwrite ? '1' : '0' })}`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/octet-stream' }, credentials: 'same-origin', body: file });
  const body = await response.json(); if (!response.ok || body.code !== 0) throw new ApiError(body.code || response.status, body.message || 'Import failed'); return body.data;
}
export async function resourceBlob(id: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(`/api/resources/images/content?${new URLSearchParams({ id })}`, { headers: authHeaders(), signal, credentials: 'same-origin' });
  if (!response.ok) throw new ApiError(response.status, 'Resource download failed');
  const type = response.headers.get('Content-Type') || '';
  if (type.includes('application/json')) { const body = await response.json(); throw new ApiError(body.code || 1, body.message || 'Resource download failed'); }
  if (!type.startsWith('image/')) throw new Error('Invalid image response');
  return response.blob();
}
export function downloadResourceBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Raw bytes, not a base64 JSON copy of every image. Progress is opt-in and bounded. */
export function uploadResource(file: File, directory: string, overwrite = false, progress?: (percent: number) => void): Promise<ImageResource> {
  if (file.size > 128 * 1024 * 1024) return Promise.reject(new ApiError(413, 'Image exceeds the 128 MiB upload limit'));
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `/api/resources/images/upload?${new URLSearchParams({ directory, filename: file.name, overwrite: overwrite ? '1' : '0' })}`);
    request.timeout = 120_000;
    for (const [key, value] of Object.entries(authHeaders())) request.setRequestHeader(key, value);
    request.setRequestHeader('Content-Type', 'application/octet-stream');
    request.upload.onprogress = (event) => { if (event.lengthComputable) progress?.(Math.min(100, Math.round(100 * event.loaded / event.total))); };
    request.onerror = () => reject(new Error('Image upload failed'));
    request.ontimeout = () => reject(new Error('Image upload timed out'));
    request.onabort = () => reject(new Error('Image upload cancelled'));
    request.onload = () => {
      try {
        const result = JSON.parse(request.responseText);
        if (request.status < 200 || request.status >= 300 || result.code !== 0) throw new ApiError(result.code || request.status, result.message || 'Image upload failed');
        resolve(result.data as ImageResource);
      } catch (error) { reject(error); }
    };
    request.send(file);
  });
}
