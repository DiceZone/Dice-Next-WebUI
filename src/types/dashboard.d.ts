/**
 * Dashboard statistics types.
 *
 * Used for the dashboard overview page (T04) and the
 * dashboard store (dashboard-store.ts).
 */
/** Statistical summary displayed on the main dashboard.
 *  Matches the Dice!Next backend GET /api/dashboard/stats response. */
export interface DashboardStats {
    /** Server uptime in seconds. */
    uptime_seconds: number;
    /** Number of adapters currently connected (0 until adapter tracking is added). */
    active_connections: number;
    /** Total number of custom reply rules. */
    total_rules: number;
    /** Number of active game sessions (.log sessions). */
    active_sessions: number;
    /** Recent log entries (max 10 from server). */
    recent_logs: RecentLogEntry[];
}
/** A single log entry shown in the recent logs stream. */
export interface RecentLogEntry {
    id: string;
    timestamp: string;
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'critical';
    module?: string;
    message: string;
}
/** Default empty dashboard stats. */
export declare const DEFAULT_DASHBOARD_STATS: DashboardStats;
