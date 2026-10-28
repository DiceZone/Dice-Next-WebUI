import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createNavigationBlocker } from '../../src/lib/safe-navigation';
import { createPanelQueryClient, panelKeys } from '../../src/lib/query-client';
import { Button } from '../../src/components/ui/button';
import { DatePicker } from '../../src/components/ui/date-time-picker';
import { I18nextProvider } from 'react-i18next';
import { createInstance } from 'i18next';

describe('V2 architecture contracts', () => {
  it('awaits navigation confirmation and blocks concurrent attempts', async () => {
    let resolve!: (value: boolean) => void;
    const confirm = vi.fn(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );
    const block = createNavigationBlocker(confirm);
    const pending = block();
    expect(await block()).toBe(true);
    resolve(false);
    expect(await pending).toBe(true);
    const accepted = block();
    resolve(true);
    expect(await accepted).toBe(false);
  });
  it('fails closed when a confirmation fails', async () => {
    expect(
      await createNavigationBlocker(async () => {
        throw new Error('failed');
      })(),
    ).toBe(true);
  });
  it('separates accounts, filters, dates and pagination and never retries writes', async () => {
    expect(panelKeys.list('/logs?page=1')).not.toEqual(panelKeys.list('/logs?page=2'));
    expect(panelKeys.statistics(7, 'onebot', 'bot-a', '1h')).not.toEqual(
      panelKeys.statistics(7, 'onebot', 'bot-b', '1h'),
    );
    expect(panelKeys.replies('account', 'bot-a')).not.toEqual(panelKeys.replies('account', 'bot-b'));
    const client = createPanelQueryClient();
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
    const read = vi.fn(async () => ({ ok: true }));
    await Promise.all([
      client.fetchQuery({ queryKey: ['same'], queryFn: read }),
      client.fetchQuery({ queryKey: ['same'], queryFn: read }),
    ]);
    expect(read).toHaveBeenCalledTimes(1);
    client.clear();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
  it('keeps standard button keyboard behavior', async () => {
    const click = vi.fn();
    render(<Button onClick={click}>Save</Button>);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(click).toHaveBeenCalledTimes(1);
  });
  it('uses an accessible styled calendar and keeps date-only values out of UTC conversion', async () => {
    const instance = createInstance();
    await instance.init({ lng: 'en', resources: { en: { translation: {} } } });
    const change = vi.fn();
    render(
      <I18nextProvider i18n={instance}>
        <DatePicker value="2026-10-26" label="Start date" onValueChange={change} />
      </I18nextProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Start date' }));
    expect(await screen.findByRole('dialog')).toBeVisible();
    expect(screen.getByRole('grid')).toBeVisible();
    const day = screen
      .getAllByRole('button')
      .find((item) => item.getAttribute('data-day') === new Date(2026, 9, 27).toLocaleDateString());
    if (!day) throw new Error('Expected localized day button');
    await act(async () => day.click());
    expect(change).toHaveBeenCalledWith('2026-10-27');
  });
});
