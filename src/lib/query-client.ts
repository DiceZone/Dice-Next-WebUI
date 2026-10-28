import { QueryClient } from '@tanstack/react-query';

// Cache only in memory, never persist credentials or another login's data.
// Explicit refresh and polling are owned by their pages; no surprise refetch
// may replace an editor draft or repeat a destructive action.
export function createPanelQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        gcTime: typeof document === 'undefined' ? 0 : 5 * 60_000,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false },
    },
  });
}
export const panelQueryClient = createPanelQueryClient();

export const panelKeys = {
  adapters: ['panel', 'adapters'] as const,
  dashboard: ['panel', 'dashboard'] as const,
  diceRules: ['panel', 'dice-rules'] as const,
  list: (url: string) => ['panel', 'server-list', url] as const,
  statistics: (days: number, platform: string, adapter: string, granularity: string) =>
    ['panel', 'statistics', days, platform, adapter, granularity] as const,
  replies: (scope: string, target: string) => ['panel', 'replies', scope, target] as const,
};
