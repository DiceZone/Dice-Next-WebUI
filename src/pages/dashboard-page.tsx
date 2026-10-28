import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTourValue } from '@/components/onboarding/tour-data';
import { tourSamples } from '@/lib/tour-samples';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { RecentLogs } from '@/components/dashboard/recent-logs';
import { ServerInfo } from '@/components/dashboard/server-info';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { panelQueryClient, panelKeys } from '@/lib/query-client';
import { apiClient } from '@/lib/api-client';
import type { DashboardStats } from '@/types/dashboard';
import { Button } from '@/components/ui/button';
import { Clock, LayoutDashboard, MessagesSquare, PlugZap } from 'lucide-react';
import { navigatePanel } from '@/lib/panel-navigation';

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: panelKeys.dashboard,
    queryFn: async () => (await apiClient.get<DashboardStats>('/dashboard/stats')).data,
    refetchInterval: 30_000 }, panelQueryClient);
  const liveStats = query.data || null;
  const loading = query.isPending;
  const stats = useTourValue(liveStats, tourSamples.dashboard);


  return (
    <div className="v2-dashboard flex min-w-0 flex-col gap-4">
      <PageHeader icon={LayoutDashboard} title={t('dashboard.title')} description={t('dashboard.subtitle')} help={t('page_help.dashboard')} />
      {query.isError && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
        {t('common.load_fail')}<Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>{t('common.retry')}</Button>
      </div>}

      {loading && !stats ? (
        <div data-tour="dashboard-summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <section data-tour="dashboard-summary" aria-label={t('dashboard.title')} className="grid shrink-0 grid-cols-3 gap-2 sm:gap-4">
          <StatCard icon={PlugZap} label={t('dashboard.online_adapters')}
            value={`${stats?.active_connections ?? 0} / ${stats?.total_adapters ?? 0}`} />
          <StatCard icon={MessagesSquare} label={t('dashboard.total_commands')} value={stats?.total_commands ?? 0} />
          <StatCard icon={Clock} label={t('dashboard.uptime')} value={stats ? formatUptime(stats.uptime_seconds) : '--'} />
        </section>
      )}

      <div className="grid min-w-0 flex-1 gap-4 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.65fr)]">
        <div className="min-w-0 space-y-4">
          <div data-tour="dashboard-server"><ServerInfo /></div>
          <QuickActions onNavigate={navigatePanel} />
        </div>
        <div data-tour="dashboard-logs" className="min-w-0"><RecentLogs logs={stats?.recent_logs ?? []} /></div>
      </div>
    </div>
  );
};

export default DashboardPage;
