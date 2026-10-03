export interface VersionInfo {
  version: string;
  build?: number | string;
  buildNumber?: number | string;
  prerelease?: boolean;
  tag?: string;
}

export type UpdateAction = 'notify' | 'download' | 'install';
export type UpdateSource = 'auto' | 'direct' | 'mirror' | 'custom';
export interface UpdateSettings {
  autoCheck: boolean;
  intervalHours: number;
  autoAction: UpdateAction;
  source: UpdateSource;
  customMirror: string;
}
export interface UpdateStatus {
  current: VersionInfo & { build: number; tag: string };
  platform: { os: string; arch: string };
  latest: null | {
    tag: string;
    version: string;
    build: number;
    prerelease: boolean;
    publishedAt: string;
    releaseUrl: string;
    asset?: { name: string; size: number; sha256: string };
  };
  updateAvailable: boolean;
  phase: string;
  error: string;
  source: string;
  downloadedBytes: number;
  totalBytes: number;
  checkedAt: number;
  downloadSupported?: boolean;
  installSupported: boolean;
  cancelSupported?: boolean;
  canCancel?: boolean;
  selfUpdateBlockedReason?: string;
  runtime?: { container: boolean; containerType: string; containerDetection: string };
  pending: boolean;
  settings: UpdateSettings;
}

// Older servers omit channel metadata; existing builds were all beta releases.
export function formatVersion(info: VersionInfo | null): string {
  if (!info?.version) return '—';
  const prerelease = info.prerelease ?? (info.tag ? /-beta\./.test(info.tag) : true);
  const rawBuild = info.build ?? info.buildNumber;
  const numericBuild = Number(rawBuild);
  const build = rawBuild !== undefined && Number.isInteger(numericBuild) && numericBuild >= 0
    ? String(numericBuild) : '?';
  return `${prerelease ? 'beta-' : 'v'}${info.version}(${build})`;
}

export const isUpdateBusy = (phase: string) => (
  ['checking', 'connecting', 'downloading', 'verifying', 'preparing', 'cancelling', 'installing'].includes(phase)
);
