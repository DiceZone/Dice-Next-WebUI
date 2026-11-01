import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { createRequestGate } from '@/lib/request-gate';
import { readServerListPage, type ServerListPage } from '@/lib/server-list-page';
import { panelQueryClient, panelKeys } from '@/lib/query-client';

export function useServerListPage<T>(url: string) {
  const [state, setState] = useState<{ data: ServerListPage<T> | null; url: string; loading: boolean; error: boolean }>({
    data: null, url, loading: true, error: false,
  });
  const gate = useRef(createRequestGate()).current;
  const active = useRef(false);
  const selectedUrl = useRef(url);
  selectedUrl.current = url;
  gate.select(url); // Invalidate an old selection before its effect gets a chance to run.
  const load = useCallback(async () => {
    // A delete/export callback can finish after changing pages or leaving this
    // screen. Its old reload must not cancel the new selection's request.
    if (!active.current || selectedUrl.current !== url) return;
    const current = gate.start();
    setState((old) => ({ ...old, url, loading: true, error: false }));
    try {
      const result = await panelQueryClient.fetchQuery({ queryKey: panelKeys.list(url),
        queryFn: () => apiClient.get<unknown>(url), staleTime: 0 });
      const data = readServerListPage<T>(result.data);
      if (current()) setState({ data, url, loading: false, error: false });
    } catch {
      if (current()) setState((old) => ({ ...old, loading: false, error: true }));
    }
  }, [gate, url]);
  useEffect(() => {
    active.current = true;
    void load();
    return () => { active.current = false; gate.invalidate(); };
  }, [gate, load]);
  return { ...state, loading: state.url !== url || state.loading, error: state.url === url && state.error, load };
}
