// Shared routing and key-update rules; never send an entire adapter snapshot.
export const CLOUD_SETTING_IDS = [
  'settings-cloud', 'settings-cloud-keys', 'settings-cloudban',
  'settings-cloud-cards', 'settings-heartbeat', 'settings-logsite',
] as const;

export const isCloudSettingsQuery = (query: string) => {
  const params = new URLSearchParams(query);
  if (params.get('focus') === 'settings-image-host') return false;
  return params.get('tab') === 'cloud'
    || CLOUD_SETTING_IDS.some((id) => id === params.get('focus'));
};

// Preserve old cloud-tab bookmarks without sending image-host settings to BDC.
export const resolveSettingsRoute = (path: string, query: string) => {
  const params = new URLSearchParams(query);
  if ((path === '/settings' || path === '/cloud-services')
      && params.get('focus') === 'settings-image-host') {
    params.delete('tab');
    return { path: '/settings', query: params.toString() };
  }
  if (path === '/settings' && isCloudSettingsQuery(query)) {
    params.delete('tab');
    return { path: '/cloud-services', query: params.toString() };
  }
  return { path, query };
};

export const cloudKeyPatch = (value: string, clear: boolean): { heartApiKey: string } | null => {
  if (clear) return { heartApiKey: '' };
  const key = value.trim();
  return key ? { heartApiKey: key } : null;
};
