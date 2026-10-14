import apiClient from './api-client.js';
export async function qqOfficialAction(adapterId: string, action: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const response = await apiClient.post<unknown>(`/adapters/${encodeURIComponent(adapterId)}/qq-official-actions`, { action, params }, { timeoutMs: 20000 });
  return response.data;
}
