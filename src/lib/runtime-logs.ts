import type { LogLevel } from '../types/log';

export const LOG_LEVELS: LogLevel[] = ['trace', 'debug', 'info', 'success', 'warn', 'error'];
export function normalizeLogLevel(value: unknown): LogLevel {
  const key = typeof value === 'string' ? value.toLowerCase() : '';
  if (key === 'warning') return 'warn';
  if (key === 'critical' || key === 'fatal' || key === 'err') return 'error';
  return LOG_LEVELS.includes(key as LogLevel) ? key as LogLevel : 'info';
}
export function logAtLeast(value: string, minimum: LogLevel): boolean {
  return LOG_LEVELS.indexOf(normalizeLogLevel(value)) >= LOG_LEVELS.indexOf(minimum);
}
// Server wall-clock time is already formatted; do not reinterpret its timezone.
export function logTimestamp(value: string): string {
  return value.replace('T', ' ').replace(/Z$/, '');
}
export function logMessageId(log: { msg_id?: string; details?: Record<string, unknown>; message: string }): string | undefined {
  return log.msg_id || (typeof log.details?.msg_id === 'string' ? log.details.msg_id : undefined)
    || /\(msgID:([^，,)]+)[，,)]/.exec(log.message)?.[1];
}
