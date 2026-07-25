import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '@/components/dashboard/stat-card';
import { RecentLogs } from '@/components/dashboard/recent-logs';
import { zustandDashboardStore } from '@/store/dashboard-store';
import { Dices, Users, MessageSquareReply, PlugZap } from 'lucide-react';

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>

      {loading && !stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={PlugZap} label={t('dashboard.online_adapters')} value={`${stats?.active_connections ?? 0}`} />
          <StatCard icon={Dices} label={t('dashboard.uptime')} value={stats ? formatUptime(stats.uptime_seconds) : '--'} />
          <StatCard icon={Users} label={t('dashboard.active_records')} value={stats?.active_sessions ?? 0} />
          <StatCard icon={MessageSquareReply} label={t('dashboard.custom_replies')} value={stats?.total_rules ?? 0} />
        </div>
      )}

      <RecentLogs logs={stats?.recent_logs ?? []} />
    </div>
  );
};

export default DashboardPage;
