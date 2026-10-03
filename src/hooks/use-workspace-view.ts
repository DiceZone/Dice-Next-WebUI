import { useState, useSyncExternalStore } from 'react';
import { readWorkspaceView, resolveWorkspaceView, WORKSPACE_WIDE_QUERY, type WorkspaceViewPreference } from '@/lib/workspace-view';

function subscribe(onChange: () => void) {
  const query = window.matchMedia(WORKSPACE_WIDE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const isWide = () => window.matchMedia(WORKSPACE_WIDE_QUERY).matches;

export function useWorkspaceView(page: 'groups' | 'players') {
  const storageKey = `dice-workspace-view:${page}`;
  const [preference, setPreference] = useState<WorkspaceViewPreference>(() => {
    try { return readWorkspaceView(localStorage.getItem(storageKey), page === 'groups'); }
    catch { return 'auto'; }
  });
  const wide = useSyncExternalStore(subscribe, isWide, () => false);
  const setViewPreference = (value: string) => {
    const next = readWorkspaceView(value, page === 'groups');
    setPreference(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Storage can be unavailable in private browsing. */ }
  };
  return { preference, view: resolveWorkspaceView(preference, wide), setViewPreference };
}
