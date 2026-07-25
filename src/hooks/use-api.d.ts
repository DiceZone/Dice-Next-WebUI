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
export declare function useApi<T>(fetcher: () => Promise<T>, immediate?: boolean): {
    data: T | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
};
