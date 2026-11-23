import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthGate } from '../../src/components/auth-gate';
import { usePanelLogout } from '../../src/hooks/use-panel-logout';
import { panelQueryClient } from '../../src/lib/query-client';
import { registerNavigationGuard } from '../../src/lib/navigation-guard';
import { zustandAppStore } from '../../src/store/app-store';

const toast = vi.hoisted(() => vi.fn());
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../src/hooks/use-toast', () => ({ useToast: () => toast }));

function LogoutAction() {
  const { logout, busy } = usePanelLogout();
  return <button disabled={busy} onClick={() => void logout()}>Log out</button>;
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
});
function mockServer(logout: () => Promise<Response>) {
  const fetcher = vi.fn((url: string) => url === '/api/auth/status'
    ? Promise.resolve(json({ code: 0, data: { required: true, authed: true } }))
    : logout());
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
afterEach(() => { vi.unstubAllGlobals(); zustandAppStore.getState().setApiKey(null); });

describe('panel logout', () => {
  it('revokes the session, clears browser credentials/cache and returns to login without reloading', async () => {
    const fetcher = mockServer(async () => json({ code: 0 }));
    zustandAppStore.getState().setApiKey('test-key');
    panelQueryClient.setQueryData(['private'], 'cached');
    render(<AuthGate><LogoutAction /></AuthGate>);
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByLabelText('auth.password')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
    expect(localStorage.getItem('dice-api-key')).toBeNull();
    expect(zustandAppStore.getState().apiKey).toBeNull();
    expect(panelQueryClient.getQueryData(['private'])).toBeUndefined();
  });
  it.each(['server', 'network'])('keeps the panel open on %s failure and allows retry', async (failure) => {
    mockServer(async () => {
      if (failure === 'network') throw new TypeError('offline');
      return json({ code: 1, message: 'failed' }, 500);
    });
    zustandAppStore.getState().setApiKey('test-key');
    panelQueryClient.setQueryData(['private'], 'cached');
    render(<AuthGate><LogoutAction /></AuthGate>);
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'settings.logout_failed', variant: 'destructive' }));
    expect(screen.getByRole('button', { name: 'Log out' })).toBeEnabled();
    expect(localStorage.getItem('dice-api-key')).toBe('test-key');
    expect(panelQueryClient.getQueryData(['private'])).toBe('cached');
  });
  it('does not revoke the session when the user keeps unsaved changes', async () => {
    const fetcher = mockServer(async () => json({ code: 0 }));
    const unregister = registerNavigationGuard(async () => false);
    try {
      render(<AuthGate><LogoutAction /></AuthGate>);
      await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
      expect(fetcher.mock.calls.every(([url]) => url === '/api/auth/status')).toBe(true);
      expect(screen.getByRole('button', { name: 'Log out' })).toBeEnabled();
    } finally { unregister(); }
  });
  it('disables repeated clicks while logout is pending', async () => {
    let finish!: (value: Response) => void;
    const fetcher = mockServer(() => new Promise((resolve) => { finish = resolve; }));
    render(<AuthGate><LogoutAction /></AuthGate>);
    const button = await screen.findByRole('button', { name: 'Log out' });
    await userEvent.click(button);
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(fetcher.mock.calls.filter(([url]) => url === '/api/auth/logout')).toHaveLength(1);
    await act(async () => finish(json({ code: 0 })));
    expect(await screen.findByLabelText('auth.password')).toBeInTheDocument();
  });
});
