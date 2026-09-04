export const ONBOARDING_STORAGE_KEY = 'dice-next:page-tours';

export interface TourProgressEntry {
  version: number;
  completedAt: number;
}

export type TourProgress = Record<string, TourProgressEntry>;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function canonicalTourPath(path: string): string {
  return path === '/banlist' ? '/permissions' : path;
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readTourProgress(storage: StorageLike | null = browserStorage()): TourProgress {
  if (!storage) return {};
  try {
    const raw = storage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const progress: TourProgress = {};
    for (const [path, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const candidate = entry as Partial<TourProgressEntry>;
      if (typeof candidate.version !== 'number' || !Number.isFinite(candidate.version)) continue;
      progress[canonicalTourPath(path)] = {
        version: candidate.version,
        completedAt: typeof candidate.completedAt === 'number' ? candidate.completedAt : 0,
      };
    }
    return progress;
  } catch {
    return {};
  }
}

export function hasCompletedTour(
  path: string,
  version: number,
  storage: StorageLike | null = browserStorage(),
): boolean {
  const entry = readTourProgress(storage)[canonicalTourPath(path)];
  return Boolean(entry && entry.version >= version);
}

export function completeTour(
  path: string,
  version: number,
  storage: StorageLike | null = browserStorage(),
  completedAt = Date.now(),
): boolean {
  if (!storage) return false;
  try {
    const progress = readTourProgress(storage);
    progress[canonicalTourPath(path)] = { version, completedAt };
    storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function resetTourProgress(storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(ONBOARDING_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
