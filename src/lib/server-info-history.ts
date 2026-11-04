import type { SystemInfo } from '@/types/dashboard';

/** One sample on a time axis: unix seconds and a 0–100 percentage. */
export interface HistoryPoint { t: number; v: number }
export interface ServerInfoHistory {
  info: SystemInfo;
  cpu: HistoryPoint[];
  memory: HistoryPoint[];
  /** Seconds the curve spans (backend history window, or the local fallback window). */
  window: number;
  /** Newest sample time, sent back as ?since= so polls only fetch new samples. */
  lastT: number;
  /** True when the history came from the backend sampler. */
  backend: boolean;
  sampledAt: number;
}

/** Wire format added by the backend sampler: [unix seconds, CPU %, memory %]. */
export interface BackendHistory { interval: number; window: number; samples: [number, number, number][] }

// Older backends have no history: keep the previous browser-side curve.
export const SERVER_HISTORY_LIMIT = 60;
const LOCAL_POLL_SECONDS = 5;

const valid = (value: number) => Number.isFinite(value) && value >= 0;
const point = (t: number, value: number): HistoryPoint => ({ t, v: Math.min(100, value) });

export function appendServerInfo(previous: ServerInfoHistory | undefined, info: SystemInfo & { history?: BackendHistory },
  now = Date.now()): ServerInfoHistory {
  const history = info.history;
  if (history && Array.isArray(history.samples) && history.window > 0) {
    // Backend history: merge the incremental samples and trim to its window.
    const base = previous?.backend ? previous : undefined;
    const cpu = [...(base?.cpu ?? [])], memory = [...(base?.memory ?? [])];
    let lastT = base?.lastT ?? 0;
    for (const sample of history.samples) {
      if (!Array.isArray(sample) || sample.length < 3) continue;
      const [t, cpuLoad, memLoad] = sample;
      if (!Number.isFinite(t) || t <= lastT) continue;
      if (valid(cpuLoad)) cpu.push(point(t, cpuLoad));
      if (valid(memLoad)) memory.push(point(t, memLoad));
      lastT = t;
    }
    const start = lastT - history.window;
    return { info, cpu: cpu.filter((p) => p.t > start), memory: memory.filter((p) => p.t > start),
      window: history.window, lastT, backend: true, sampledAt: now };
  }
  // Legacy: preserve real browser samples across page visits; never fabricate gaps.
  const recent = previous && !previous.backend && now - previous.sampledAt < 30 * 60_000 ? previous : undefined;
  const t = Math.floor(now / 1000);
  const append = (values: HistoryPoint[] | undefined, value: number) =>
    valid(value) ? [...(values ?? []), point(t, value)].slice(-SERVER_HISTORY_LIMIT) : values ?? [];
  return { info, cpu: append(recent?.cpu, info.cpu_load), memory: append(recent?.memory, info.mem_load),
    window: SERVER_HISTORY_LIMIT * LOCAL_POLL_SECONDS, lastT: t, backend: false, sampledAt: now };
}

/** Evenly spaced points for fixed sample data such as the page tour. */
export const spacedPoints = (values: number[], interval = LOCAL_POLL_SECONDS): HistoryPoint[] =>
  values.map((v, i) => ({ t: i * interval, v }));
