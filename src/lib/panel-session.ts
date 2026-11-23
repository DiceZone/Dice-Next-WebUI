import apiClient from './api-client';
import { zustandAppStore } from '@/store/app-store';

export const PANEL_LOGGED_OUT = 'dice:panel-logged-out';

export async function logoutPanel() {
  await apiClient.post('/auth/logout', undefined, { timeoutMs: 15_000 });
  // Clear this browser's API credential and query cache only after revocation succeeds.
  zustandAppStore.getState().setApiKey(null);
  window.dispatchEvent(new Event(PANEL_LOGGED_OUT));
}
