import type { SystemInfo } from '@/types/dashboard';

export interface ServerInfoHistory { info: SystemInfo; cpu: number[]; memory: number[]; sampledAt: number }
export const SERVER_HISTORY_LIMIT = 60;
export function appendServerInfo(previous: ServerInfoHistory | undefined, info: SystemInfo, now = Date.now()): ServerInfoHistory {
  // Preserve real samples across page visits; never fill gaps with fabricated values.
  const recent = previous && now - previous.sampledAt < 30 * 60_000 ? previous : undefined;
  const append = (values: number[] | undefined, value: number) =>
    Number.isFinite(value) && value >= 0 ? [...(values ?? []), Math.min(100, value)].slice(-SERVER_HISTORY_LIMIT) : values ?? [];
  return { info, cpu: append(recent?.cpu, info.cpu_load), memory: append(recent?.memory, info.mem_load), sampledAt: now };
}
