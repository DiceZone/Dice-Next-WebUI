import { render, screen, waitFor, act } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerInfo } from '../../src/components/dashboard/server-info';
import { appendServerInfo } from '../../src/lib/server-info-history';
import { panelQueryClient } from '../../src/lib/query-client';
import apiClient from '../../src/lib/api-client';
import { tourSamples } from '../../src/lib/tour-samples';
import english from '../../src/i18n/locales/en.json';

afterEach(() => vi.restoreAllMocks());
const sample = { ...tourSamples.system, cpu_load: 25, mem_load: 50 };
async function setup() {
  const i18n = createInstance();
  await i18n.init({ lng: 'en', resources: { en: { translation: english } } });
  return () =>
    render(
      <I18nextProvider i18n={i18n}>
        <ServerInfo />
      </I18nextProvider>,
    );
}
describe('Server information history', () => {
  it('keeps only real samples, caps history and expires stale history', () => {
    let history = appendServerInfo(undefined, sample, 1);
    expect(history.cpu).toEqual([25]);
    for (let n = 2; n < 90; n++) history = appendServerInfo(history, { ...sample, cpu_load: n }, n);
    expect(history.cpu).toHaveLength(60);
    expect(history.cpu.at(-1)).toBe(89);
    const unknown = appendServerInfo(history, { ...sample, cpu_load: -1, mem_load: NaN }, 100);
    expect(unknown.cpu).toEqual(history.cpu);
    expect(unknown.memory).toEqual(history.memory);
    expect(appendServerInfo(history, sample, 31 * 60_000).cpu).toEqual([25]);
  });
  it('shows a loading placeholder then retains the curve across page visits and refresh failures', async () => {
    let resolve!: (value: any) => void;
    const get = vi.spyOn(apiClient, 'get').mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const mount = await setup();
    const first = mount();
    expect(screen.getByRole('status', { name: english.common.loading })).toBeInTheDocument();
    await act(async () => resolve({ data: sample, code: 0, message: 'ok' }));
    await waitFor(() => expect(screen.getByText(sample.os)).toBeInTheDocument());
    expect(first.container.querySelectorAll('svg[viewBox="0 0 100 20"] circle')).toHaveLength(2);
    const key = ['panel', 'server-info-history'];
    panelQueryClient.setQueryData(
      key,
      appendServerInfo(appendServerInfo(undefined, sample), { ...sample, cpu_load: 45 }),
    );
    first.unmount();
    const second = mount();
    expect(
      second.container
        .querySelector('svg[viewBox="0 0 100 20"] polyline')
        ?.getAttribute('points')
        ?.split(' '),
    ).toHaveLength(2);
    expect(get).toHaveBeenCalledTimes(1);
    get.mockRejectedValue(new Error('offline'));
    await act(async () => {
      await panelQueryClient.invalidateQueries({ queryKey: key });
    });
    await waitFor(() =>
      expect(screen.getByText(new RegExp(english.dashboard.cached_snapshot))).toBeInTheDocument(),
    );
    expect(
      second.container
        .querySelector('svg[viewBox="0 0 100 20"] polyline')
        ?.getAttribute('points')
        ?.split(' '),
    ).toHaveLength(2);
    second.unmount();
    panelQueryClient.clear();
    get.mockImplementation(() => new Promise(() => {}));
    mount();
    expect(screen.getByRole('status', { name: english.common.loading })).toBeInTheDocument();
  });
});
