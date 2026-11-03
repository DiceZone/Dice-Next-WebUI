import type { Adapter } from '@/types/adapter';

// Keep the deployment prefix; never copy the panel hash, query or credentials.
export function officialWebhookUrl(base: string): string {
  const url = new URL(base);
  url.hash = ''; url.search = ''; url.username = ''; url.password = '';
  url.pathname = url.pathname.replace(/index\.html?$/i, '').replace(/\/?$/, '/') + 'qq-official/webhook';
  return url.toString();
}

// This is a deployment hint, not a public reachability probe. A local panel
// may still sit behind a correctly configured public reverse proxy.
export function officialWebhookNeedsPublicUrl(base: string): boolean {
  try {
    const url = new URL(base);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    return url.protocol !== 'https:' || host === 'localhost' || host.endsWith('.localhost')
      || host === '[::1]' || host.includes(':') || /^\d+(?:\.\d+){3}$/.test(host)
      || !host.includes('.') || host.endsWith('.local');
  } catch {
    return true;
  }
}

export function adapterConnectionKey(adapter: Adapter): string {
  if (adapter.type === 'qq_official') return adapter.qqReceiveMode === 'webhook' ? 'adapters.transport_webhook' : 'adapters.transport_websocket';
  if (adapter.type === 'discord' || adapter.type === 'kook') return 'adapters.transport_websocket';
  const mode = adapter.type === 'openopq' ? adapter.openopqTransport : adapter.connectionMode;
  return mode === 'reverse_ws' ? 'adapters.mode_reverse_ws' : mode === 'http' ? 'adapters.mode_http' : 'adapters.mode_forward_ws';
}
