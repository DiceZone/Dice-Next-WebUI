import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../src/lib/api-client';
import { panelQueryClient } from '../../src/lib/query-client';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});
describe('authentication cache isolation', () => {
  it('clears remote cache when changing or removing an API key', () => {
    panelQueryClient.setQueryData(['private'], { secret: true });
    apiClient.setApiKey('fixture');
    expect(panelQueryClient.getQueryData(['private'])).toBeUndefined();
    panelQueryClient.setQueryData(['private'], { secret: true });
    apiClient.clearApiKey();
    expect(panelQueryClient.getQueryData(['private'])).toBeUndefined();
  });
  it.each([401, 403])(
    'clears cache on expired login, not a single forbidden resource (%s)',
    async (status) => {
      panelQueryClient.setQueryData(['private'], 'existing snapshot');
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(JSON.stringify({ code: status, message: 'Denied' }), {
              status,
              headers: { 'Content-Type': 'application/json' },
            }),
        ),
      );
      await expect(apiClient.get('/fixture')).rejects.toMatchObject({ code: status });
      expect(panelQueryClient.getQueryData(['private'])).toBe(
        status === 401 ? undefined : 'existing snapshot',
      );
    },
  );
});
