import apiClient from './api-client.js';
export interface NetworkAddressState {
  status: 'detecting' | 'ready' | 'failed';
  addresses: string[];
  stale: boolean;
  checked_at: number;
}
export interface NetworkInfo {
  lan: NetworkAddressState;
  wan: NetworkAddressState;
  refreshing: boolean;
  attempted_at: number;
}
export function validIpv4(value: unknown): value is string {
  return typeof value === 'string' && value.split('.').length === 4
    && Number(value.split('.')[0]) > 0 && Number(value.split('.')[0]) < 224
    && value.split('.').every((part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255);
}
export function reverseWsAddress(ip: unknown, port: string): string | null {
  const trimmed = port.trim();
  if (!validIpv4(ip) || !/^\d+$/.test(trimmed) || Number(trimmed) < 1 || Number(trimmed) > 65535) return null;
  return `ws://${ip}:${Number(trimmed)}`;
}
export function parseNetworkInfo(input: unknown): NetworkInfo {
  if (!input || typeof input !== 'object') throw new Error('Invalid network information');
  const data = input as Record<string, unknown>;
  const address = (input: unknown): NetworkAddressState => {
    if (!input || typeof input !== 'object') throw new Error('Invalid address state');
    const item = input as Record<string, unknown>;
    if (!['detecting', 'ready', 'failed'].includes(String(item.status)) || !Array.isArray(item.addresses))
      throw new Error('Invalid address state');
    return { status: item.status as NetworkAddressState['status'],
      addresses: [...new Set(item.addresses.filter(validIpv4))].slice(0, 32), stale: item.stale === true,
      checked_at: typeof item.checked_at === 'number' && Number.isFinite(item.checked_at) ? item.checked_at : 0 };
  };
  if (typeof data.refreshing !== 'boolean') throw new Error('Invalid refresh state');
  return { lan: address(data.lan), wan: address(data.wan), refreshing: data.refreshing,
    attempted_at: typeof data.attempted_at === 'number' && Number.isFinite(data.attempted_at) ? data.attempted_at : 0 };
}
// GET only reads the startup cache. POST is reserved for an explicit refresh.
export async function fetchNetworkInfo(refresh = false): Promise<NetworkInfo> {
  const response = refresh
    ? await apiClient.post<unknown>('/system/network-info/refresh', undefined, { timeoutMs: 6000 })
    : await apiClient.get<unknown>('/system/network-info', { timeoutMs: 6000 });
  return parseNetworkInfo(response.data);
}
export function chooseLanAddress(data: NetworkInfo | null, previous: string): string {
  const candidates = data?.lan.addresses ?? [];
  return candidates.includes(previous) ? previous : candidates[0] ?? '';
}
