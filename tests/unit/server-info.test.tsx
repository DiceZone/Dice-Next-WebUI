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
  it('older servers: keeps only real browser samples, caps history and expires stale history', () => {
    const values = (points: { v: number }[]) => points.map((p) => p.v);
    let history = appendServerInfo(undefined, sample, 1);
    expect(values(history.cpu)).toEqual([25]);
    expect(history.backend).toBe(false);
    for (let n = 2; n < 90; n++) history = appendServerInfo(history, { ...sample, cpu_load: n }, n);
    expect(history.cpu).toHaveLength(60);
    expect(history.cpu.at(-1)?.v).toBe(89);
    const unknown = appendServerInfo(history, { ...sample, cpu_load: -1, mem_load: NaN }, 100);
    expect(unknown.cpu).toEqual(history.cpu);
    expect(unknown.memory).toEqual(history.memory);
    expect(values(appendServerInfo(history, sample, 31 * 60_000).cpu)).toEqual([25]);
  });

  it('uses the backend history: merges incremental samples and trims to its window', () => {
    const backend = (samples: [number, number, number][]) => ({
      ...sample,
      history: { interval: 5, window: 20, samples },
    });
    let history = appendServerInfo(
      undefined,
      backend([
        [100, 10, 40],
        [105, 20, 41],
        [110, -1, 42],
      ]),
    );
    expect(history.backend).toBe(true);
    expect(history.lastT).toBe(110);
    expect(history.cpu.map((p) => p.t)).toEqual([100, 105]); // unavailable CPU is skipped, not zeroed
    expect(history.memory.map((p) => p.v)).toEqual([40, 41, 42]);
    history = appendServerInfo(
      history,
      backend([
        [110, 30, 42],
        [115, 30, 43],
        [125, 50, 44],
      ]),
    );
    expect(history.lastT).toBe(125);
    expect(history.memory.map((p) => p.t)).toEqual([110, 115, 125]); // duplicates ignored, older than 20 s dropped
    // A legacy snapshot never mixes into backend points and vice versa.
    expect(appendServerInfo(history, sample).backend).toBe(false);
  });

  it('draws the backend hour immediately, even on the first visit after a reload', async () => {
    const samples: [number, number, number][] = Array.from({ length: 720 }, (_, i) => [1000 + i * 5, 20, 30]);
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { ...sample, history: { interval: 5, window: 3600, samples } },
    } as any);
    const mount = await setup();
    const view = mount();
    await waitFor(() =>
      expect(view.container.querySelector('[title*="60"]')?.getAttribute('title')).toContain('60'),
    );
    expect(get).toHaveBeenCalledWith('/system/sysinfo?since=0');
    const points = view.container
      .querySelector('svg[viewBox="0 0 100 20"] polyline')
      ?.getAttribute('points')
      ?.split(' ');
    expect(points).toHaveLength(720);
    expect(points?.[0].startsWith('0.')).toBe(true); // spans the full width
    view.unmount();
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
