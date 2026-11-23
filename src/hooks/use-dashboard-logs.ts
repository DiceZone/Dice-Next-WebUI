import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { startLogFeed } from '@/lib/dashboard-log-feed';
import type { RecentLogEntry } from '@/types/dashboard';

export function useDashboardLogs(enabled: boolean) {
  const [logs, setLogs] = useState<RecentLogEntry[]>();
  const latest = useRef<RecentLogEntry[]>();
  useEffect(() => {
    if (!enabled) return;
    let stop: (() => void) | undefined;
    function sync() {
      stop?.(); stop = undefined;
      if (document.hidden) return;
      stop = startLogFeed((after, stream, signal) => {
        const key = apiClient.getApiKey();
        return fetch('/api/dashboard/logs?after=' + encodeURIComponent(after), {
          signal, cache: 'no-store', credentials: 'same-origin',
          headers: { Accept: stream ? 'text/event-stream' : 'application/json', ...(key ? { 'X-API-Key': key } : {}) },
        });
      }, rows => { latest.current = rows; setLogs(rows); }, latest.current);
    }
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => { document.removeEventListener('visibilitychange', sync); stop?.(); };
  }, [enabled]);
  return logs;
}
