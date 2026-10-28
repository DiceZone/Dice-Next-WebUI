export type WebuiVersion = 'v1' | 'v2';
export interface WebuiVersionState {
  selected: WebuiVersion;
  effective: WebuiVersion | '';
  legacy: boolean;
  available: Record<WebuiVersion, boolean>;
}

export function validWebuiState(value: unknown): value is WebuiVersionState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<WebuiVersionState>;
  return (state.selected === 'v1' || state.selected === 'v2') &&
    (state.effective === '' || state.effective === 'v1' || state.effective === 'v2') &&
    typeof state.legacy === 'boolean' && typeof state.available?.v1 === 'boolean' && typeof state.available?.v2 === 'boolean';
}

/** Strip only our final entry directory, never a reverse proxy's prefix. */
export function panelRoot(pathname: string): string {
  return pathname.replace(/index\.html$/, '').replace(/\/(?:v1|v2)\/?$/, '/').replace(/\/+$/, '');
}

/** No server-supplied redirect URLs; keep origin, hash route and query intact. */
export function webuiTarget(version: WebuiVersion, legacy: boolean,
  location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  if (version !== 'v1' && version !== 'v2') throw new Error('Invalid WebUI version');
  return `${panelRoot(location.pathname)}/${legacy ? '' : `${version}/`}${location.search}${location.hash}`;
}
