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

/**
 * Whether this browser wants tours at all.
 *
 * Asked once, on the very first visit: someone who already knows the panel
 * should not have a tour open on every page they touch, and someone new
 * should not have to hunt for the entry point. `veteran` suppresses every
 * automatic tour; the header button still replays one on demand, because
 * clicking it is an explicit request.
 */
export const TOUR_MODE_STORAGE_KEY = 'dice-next:tour-mode';

export type TourMode = 'new' | 'veteran';

export function readTourMode(storage: StorageLike | null = browserStorage()): TourMode | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(TOUR_MODE_STORAGE_KEY);
    return raw === 'new' || raw === 'veteran' ? raw : null;
  } catch {
    return null;
  }
}

export function setTourMode(mode: TourMode, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(TOUR_MODE_STORAGE_KEY, mode);
    return true;
  } catch {
    return false;
  }
}

export function resetTourMode(storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(TOUR_MODE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
