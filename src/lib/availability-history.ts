export type OnlineGranularity = '5m' | '1h' | '6h' | '1d';
export type OnlineState = 'online' | 'partial' | 'offline' | 'unknown';
export interface OnlineSample { sampled_at: string; online_count: number; total_count: number }
export interface OnlineSlot {
  start: number; end: number; state: OnlineState; sample?: OnlineSample;
}
export interface OnlineDay {
  date: string; start: number; end: number; slots: OnlineSlot[];
  state: OnlineState; knownCount: number;
}
export const ONLINE_BUCKET_MINUTES: Record<OnlineGranularity, number> = { '5m': 5, '1h': 60, '6h': 360, '1d': 1440 };

export function onlineState(sample?: OnlineSample): OnlineState {
  if (!sample || sample.total_count === 0) return 'unknown';
  return sample.online_count === sample.total_count ? 'online' : sample.online_count > 0 ? 'partial' : 'offline';
}

/** Keep UTC source buckets intact, clipping them at the server's calendar-day
 * boundaries. A missing bucket stays unknown, never online or offline. */
export function buildOnlineDays(rows: readonly OnlineSample[], dates: readonly string[], granularity: OnlineGranularity, offsetMinutes = 0, now = Infinity): OnlineDay[] {
  const step = ONLINE_BUCKET_MINUTES[granularity] * 60_000;
  const offset = Number.isFinite(offsetMinutes) ? offsetMinutes * 60_000 : 0;
  const buckets = new Map<number, OnlineSample>();
  for (const row of rows) {
    if (!Number.isInteger(row.online_count) || !Number.isInteger(row.total_count)
      || row.online_count < 0 || row.total_count < row.online_count) continue;
    const timestamp = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(row.sampled_at) ? row.sampled_at : row.sampled_at.replace(' ', 'T') + 'Z');
    if (!Number.isFinite(timestamp)) continue;
    const key = Math.floor(timestamp / step) * step;
    const previous = buckets.get(key);
    // Match the server's worst-state aggregation, including changing adapter counts.
    buckets.set(key, previous ? { sampled_at: row.sampled_at,
      online_count: Math.min(previous.online_count, row.online_count),
      total_count: Math.max(previous.total_count, row.total_count) } : row);
  }
  return [...new Set(dates)].sort().flatMap(date => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const midnight = Date.parse(date + 'T00:00:00Z');
    if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== date) return [];
    const start = midnight - offset;
    const end = start + 86_400_000;
    const slots: OnlineSlot[] = [];
    let state: OnlineState = 'unknown';
    let knownCount = 0;
    for (let key = Math.floor(start / step) * step; key < end; key += step) {
      const slotStart = Math.max(start, key);
      const slotEnd = Math.min(end, key + step);
      const sample = slotStart < now ? buckets.get(key) : undefined;
      const slotState = onlineState(sample);
      // A coarse current bucket is an observation so far, not a promise of
      // being online for its future hours. Keep the remaining time gray.
      if (sample && slotStart < now && now < slotEnd) {
        slots.push({ start: slotStart, end: now, state: slotState, sample });
        slots.push({ start: now, end: slotEnd, state: 'unknown' });
      } else slots.push({ start: slotStart, end: slotEnd, state: slotState, sample });
      if (slotState !== 'unknown') {
        knownCount++;
        // A mixed day is partially available, not fully offline. Detailed
        // buckets still keep their worst state; missing time is not an outage.
        state = state === 'unknown' ? slotState : state === slotState ? state : 'partial';
      }
    }
    return [{ date, start, end, slots, state, knownCount }];
  });
}

export function selectedOnlineDay(days: readonly OnlineDay[], preferred: string | null): OnlineDay | undefined {
  return days.find(day => day.date === preferred)
    ?? [...days].reverse().find(day => day.knownCount > 0) ?? days[days.length - 1];
}

export function onlineClock(timestamp: number, offsetMinutes: number): string {
  return new Date(timestamp + offsetMinutes * 60_000).toISOString().slice(11, 16);
}
