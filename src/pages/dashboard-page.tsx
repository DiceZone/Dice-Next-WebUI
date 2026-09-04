import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { RecentLogs } from '@/components/dashboard/recent-logs';
import { ServerInfo } from '@/components/dashboard/server-info';
import { zustandDashboardStore } from '@/store/dashboard-store';
import { Clock, LayoutDashboard, MessagesSquare, PlugZap } from 'lucide-react';

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { stats, loading, fetchStats } = zustandDashboardStore();

  useEffect(() => {
    void fetchStats();
    const interval = setInterval(() => void fetchStats(), 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <div className="space-y-6">
      <PageHeader icon={LayoutDashboard} title={t('dashboard.title')} description={t('dashboard.subtitle')} />

      {loading && !stats ? (
        <div data-tour="dashboard-summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div data-tour="dashboard-summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={PlugZap} label={t('dashboard.online_adapters')}
            value={`${stats?.active_connections ?? 0} / ${stats?.total_adapters ?? 0}`} />
          <StatCard icon={MessagesSquare} label={t('dashboard.total_commands')} value={stats?.total_commands ?? 0} />
          <StatCard icon={Clock} label={t('dashboard.uptime')} value={stats ? formatUptime(stats.uptime_seconds) : '--'} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        <div data-tour="dashboard-server" className="lg:col-span-1"><ServerInfo /></div>
        <div data-tour="dashboard-logs" className="lg:col-span-2"><RecentLogs logs={stats?.recent_logs ?? []} /></div>
      </div>
    </div>
  );
};

export default DashboardPage;
