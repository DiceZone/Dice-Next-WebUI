/**
 * Log type definitions.
 *
 * System and bot event logs with filtering and pagination support.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'critical';
export type LogSource = 'system' | 'adapter' | 'dice' | 'reply' | 'session' | 'deck';
export interface LogEntry {
    id: string;
    timestamp: string;
    level: LogLevel;
    source: LogSource;
    module: string;
    message: string;
    details?: Record<string, unknown>;
}
export interface LogFilter {
    level?: LogLevel;
    source?: LogSource;
    search?: string;
    startTime?: string;
    endTime?: string;
}
export interface LogPagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}
export interface LogResponse {
    entries: LogEntry[];
    pagination: LogPagination;
}
export declare const LOG_LEVEL_LABELS: Record<LogLevel, string>;
export declare const LOG_SOURCE_LABELS: Record<LogSource, string>;
