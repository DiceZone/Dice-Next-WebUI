export interface ScheduleTiming {
  enabled: boolean; cronTime: string; days: string; lastRun: string;
  triggerType: string; intervalMin: number; onceDate: string;
}
const pad = (n: number) => String(n).padStart(2, '0');
const datePart = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const format = (d: Date) => `${datePart(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
export const scheduleToday = (offset: number, now = Date.now()) => datePart(new Date(now + offset * 60000));
export function timezoneLabel(offset: number) {
  const abs = Math.abs(offset);
  return `UTC${offset < 0 ? '-' : '+'}${Math.floor(abs / 60)}${abs % 60 ? ':' + pad(abs % 60) : ''}`;
}
/** Estimate in the bot's configured clock, never in the browser's timezone.
 * Includes the scheduler's one-hour catch-up window; execution still depends
 * on connectivity and conditions. An OS timezone's future DST is not predicted.
 */
export function nextScheduleRun(tk: ScheduleTiming, offset: number | null, nowMs = Date.now()): string {
  if (!tk.enabled || offset === null) return '—';
  const now = new Date(nowMs + offset * 60000);
  const today = datePart(now);
  if (tk.triggerType === 'interval') {
    if (tk.intervalMin < 1 || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(tk.lastRun)) return '—';
    const last = Date.parse(tk.lastRun.replace(' ', 'T') + ':00Z');
    return Number.isFinite(last) ? format(new Date(Math.max(now.getTime(), last + tk.intervalMin * 60000))) : '—';
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(tk.cronTime)) return '—';
  if (tk.triggerType === 'once') {
    if (tk.lastRun || !/^\d{4}-\d{2}-\d{2}$/.test(tk.onceDate)) return '—';
    const due = Date.parse(`${tk.onceDate}T${tk.cronTime}:00Z`);
    if (!Number.isFinite(due) || tk.onceDate < today || now.getTime() - due >= 61 * 60000) return '—';
    return format(new Date(Math.max(due, now.getTime())));
  }
  const [hh, mm] = tk.cronTime.split(':').map(Number);
  const days = tk.days.split(',').filter(Boolean).map(Number);
  const allowed = (d: Date) => !days.length || days.includes(d.getUTCDay());
  const candidate = new Date(now);
  candidate.setUTCHours(hh, mm, 0, 0);
  if (allowed(candidate) && tk.lastRun !== today && now.getTime() >= candidate.getTime()
      && now.getTime() - candidate.getTime() < 61 * 60000) return format(now);
  if (tk.lastRun === today || candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 1);
  for (let i = 0; i < 8; i++) {
    if (allowed(candidate)) return format(candidate);
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return '—';
}
