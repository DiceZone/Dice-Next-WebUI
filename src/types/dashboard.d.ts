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
    /** Number of adapters currently connected. */
    active_connections: number;
    /** Total number of configured adapters (for the "connected / total" display). */
    total_adapters: number;
    /** Commands handled since the process started. */
    total_commands: number;
    /** Total number of custom reply rules. */
    total_rules: number;
    /** Number of active game sessions (.log sessions). */
    active_sessions: number;
    /** Host system metrics (CPU / memory / disk). */
    system?: SystemInfo;
    /** Recent log entries (max 10 from server). */
    recent_logs: RecentLogEntry[];
}
/** A mounted fixed disk / volume. */
export interface DiskInfo {
    mount: string;
    label: string;
    fs: string;
    model: string;
    total_gb: number;
    used_gb: number;
    load: number;
}
/** Host machine metrics from GET /api/system/sysinfo (and dashboard `system`). */
export interface SystemInfo {
    os: string;
    os_id: string;
    cpu_model: string;
    cpu_cores: number;
    cpu_physical: number;
    cpu_mhz: number;
    /** CPU load percentage, or -1 if unavailable. */
    cpu_load: number;
    mem_total_mb: number;
    mem_used_mb: number;
    mem_load: number;
    mem_speed_mhz: number;
    proc_mem_mb: number;
    disks: DiskInfo[];
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
