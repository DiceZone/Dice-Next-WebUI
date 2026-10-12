import { useCallback, useEffect, useRef, useState } from 'react';
import { useTourActive, useTourValue } from '@/components/onboarding/tour-data';
import { ApiError } from '@/lib/api-client';
import { fetchNetworkInfo, type NetworkInfo } from '@/lib/network-info';

export interface ServerNetworkView {
  data: NetworkInfo | null;
  loading: boolean;
  error: 'unavailable' | 'unsupported' | null;
}
const tourNetwork: ServerNetworkView = { loading: false, error: null, data: {
  lan: { status: 'ready', addresses: ['192.168.1.10'], stale: false, checked_at: 0 },
  wan: { status: 'ready', addresses: ['203.0.113.10'], stale: false, checked_at: 0 },
  refreshing: false, attempted_at: 0,
} };
export function useServerNetworkInfo() {
  const touring = useTourActive();
  const [state, setState] = useState<ServerNetworkView>({ data: null, loading: true, error: null });
  const mounted = useRef(true);
  const inFlight = useRef<Promise<void> | null>(null);
  const load = useCallback(async (refresh = false) => {
    if (inFlight.current) return inFlight.current;
    const request = (async () => {
      if (mounted.current) setState((old) => ({ ...old, loading: true }));
      try {
        const data = await fetchNetworkInfo(refresh);
        if (mounted.current) setState({ data, loading: false, error: null });
      } catch (error) {
        if (mounted.current) setState({ data: null, loading: false,
          error: error instanceof ApiError && error.code === 404 ? 'unsupported' : 'unavailable' });
      }
    })();
    inFlight.current = request;
    try { await request; } finally { inFlight.current = null; }
  }, []);
  useEffect(() => {
    mounted.current = true; void load();
    return () => { mounted.current = false; };
  }, [load]);
  // Only poll cached state during the backend's bounded job; failures stop it.
  const refreshing = state.data?.refreshing === true;
  useEffect(() => {
    if (!refreshing) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => { await load(); if (!stopped) timer = setTimeout(() => void poll(), 1200); };
    timer = setTimeout(() => void poll(), 1200);
    return () => { stopped = true; clearTimeout(timer); };
  }, [load, refreshing]);
  const refresh = useCallback(async () => { if (!touring) await load(true); }, [load, touring]);
  const readCache = useCallback(() => load(false), [load]);
  return { network: useTourValue(state, tourNetwork), refresh, readCache };
}
