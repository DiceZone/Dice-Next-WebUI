import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Generic API hook that provides `{ data, loading, error, refetch }`.
 *
 * @param fetcher - Async function that returns `T`.
 * @param immediate - Whether to call the fetcher immediately on mount (default: true).
 * @returns Hook result with data, loading/error states, and a refetch function.
 *
 * @example
 * ```ts
 * const { data, loading, error, refetch } = useApi(() => apiClient.get<User[]>('/users'));
 * ```
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  immediate: boolean = true
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(immediate);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);

  // Keep the fetcher reference up to date
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : '请求失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (immediate) {
      void execute();
    }
  }, [immediate, execute]);

  return { data, loading, error, refetch: execute };
}
