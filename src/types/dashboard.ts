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
  os_id: string;          // logo key: windows/ubuntu/debian/centos/rocky/linux/macos
  cpu_model: string;
  cpu_cores: number;      // logical
  cpu_physical: number;   // physical cores
  cpu_mhz: number;        // base frequency
  /** CPU load percentage, or -1 if unavailable. */
  cpu_load: number;
  mem_total_mb: number;
  mem_used_mb: number;
  mem_load: number;
  mem_speed_mhz: number;  // module speed (0 = unknown)
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
export const DEFAULT_DASHBOARD_STATS: DashboardStats = {
  uptime_seconds: 0,
  active_connections: 0,
  total_adapters: 0,
  total_commands: 0,
  total_rules: 0,
  active_sessions: 0,
  recent_logs: [],
};
