import React, { useEffect } from 'react';
import { useTourValue } from '@/components/onboarding/tour-data';
import { tourSamples } from '@/lib/tour-samples';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { RecentLogs } from '@/components/dashboard/recent-logs';
import { ServerInfo } from '@/components/dashboard/server-info';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { Button } from '@/components/ui/button';
import { zustandDashboardStore } from '@/store/dashboard-store';
import { Clock, LayoutDashboard, MessagesSquare, PlugZap, Scroll, Users, UsersRound } from 'lucide-react';

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { stats: liveStats, loading, error, fetchStats } = zustandDashboardStore();
  const stats = useTourValue(liveStats, tourSamples.dashboard);

  useEffect(() => {
    void fetchStats();
    const interval = setInterval(() => void fetchStats(), 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <div className="space-y-6">
      <PageHeader icon={LayoutDashboard} title={t('dashboard.title')} description={t('dashboard.subtitle')} help={t('page_help.dashboard')} />
      {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
        {t('common.load_fail')}<Button type="button" variant="outline" size="sm" onClick={() => void fetchStats()}>{t('common.retry')}</Button>
      </div>}

      {loading && !stats ? (
        <div data-tour="dashboard-summary" className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div data-tour="dashboard-summary" className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard icon={PlugZap} label={t('dashboard.online_adapters')}
            value={`${stats?.active_connections ?? 0} / ${stats?.total_adapters ?? 0}`} />
          <StatCard icon={Users} label={t('dashboard.user_count')} value={stats?.player_count ?? 0} />
          <StatCard icon={UsersRound} label={t('dashboard.group_count')} value={stats?.group_count ?? 0} />
          <StatCard icon={Scroll} label={t('dashboard.log_count')}
            value={`${stats?.active_logs ?? 0} / ${stats?.total_logs ?? 0}`} />
          <StatCard icon={MessagesSquare} label={t('dashboard.total_commands')} value={stats?.total_commands ?? 0} />
          <StatCard icon={Clock} label={t('dashboard.uptime')} value={stats ? formatUptime(stats.uptime_seconds) : '--'} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        <div className="flex flex-col gap-4 lg:col-span-1 lg:h-full">
          <div data-tour="dashboard-server" className="flex min-h-0 flex-1 flex-col"><ServerInfo /></div>
          <QuickActions onNavigate={(path) => { window.location.hash = path; }} />
        </div>
        <div data-tour="dashboard-logs" className="lg:col-span-2 lg:h-full"><RecentLogs logs={stats?.recent_logs ?? []} /></div>
      </div>
    </div>
  );
};

export default DashboardPage;
