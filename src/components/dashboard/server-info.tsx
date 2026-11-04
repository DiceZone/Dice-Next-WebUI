import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTourActive, useTourValue } from '@/components/onboarding/tour-data';
import { panelQueryClient } from '@/lib/query-client';
import { appendServerInfo, spacedPoints, visibleServerHistory, SERVER_CHART_WINDOW_SECONDS, type BackendHistory, type HistoryPoint, type ServerInfoHistory } from '@/lib/server-info-history';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { tourSamples } from '@/lib/tour-samples';
import { useTranslation } from 'react-i18next';
import { Cpu, MemoryStick, HardDrive, Server } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FeatureHelp } from '@/components/ui/feature-help';
import { cn } from '@/lib/utils';
import apiClient from '@/lib/api-client';
import type { SystemInfo } from '@/types/dashboard';

const POLL_MS = 5000;        // the backend samples every 5 s; polls only fetch new samples
const HISTORY_KEY = ['panel', 'server-info-history'] as const;

function fmtMB(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}
function fmtGHz(mhz: number): string {
  return mhz >= 1000 ? `${(mhz / 1000).toFixed(2)} GHz` : `${mhz} MHz`;
}
/** Text-colour class by load level; drives both the bar and the curve. */
function loadColor(pct: number): string {
  return pct >= 90 ? 'text-red-500' : pct >= 70 ? 'text-amber-500' : 'text-green-500';
}

/** Tiny dependency-free area sparkline on a time axis: the right edge is the newest
 *  sample and the width spans `window` seconds. Values are 0–100. */
const Sparkline: React.FC<{ data: HistoryPoint[]; window: number; end: number; title?: string; className?: string; tall?: boolean }> = ({ data, window, end, title, className, tall }) => {
  const w = 100, h = 20;
  if (!data.length) return <div className={tall ? 'min-h-5 flex-1' : 'h-5'} />;
  const span = Math.max(1, window);
  const pts = data.map(({ t, v }) => {
    const x = Math.max(0, w - ((end - t) / span) * w);
    const y = h - (Math.min(100, Math.max(0, v)) / 100) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = pts.join(' ');
  const first = pts[0].split(',')[0];
  const last = pts[pts.length - 1].split(',')[0];
  return (
    <div className={cn('relative w-full', tall ? 'min-h-5 flex-1' : 'h-5', className)} title={title}>
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <polygon points={`${first},${h} ${line} ${last},${h}`} fill="currentColor" className="opacity-15" />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth={1.5}
        strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {data.length === 1 && <circle cx={Number(first)} cy={h - data[0].v / 100 * h} r={1.5} fill="currentColor" />}
    </svg>
    </div>
  );
};

/** One resource: header row (icon + label + %), detail, progress bar, curve. */
const ResourceMeter: React.FC<{ icon: LucideIcon; label: string; pct: number; detail: string; history: HistoryPoint[]; window: number; end: number; note?: string; tall?: boolean }>
  = ({ icon: Icon, label, pct, detail, history, window, end, note, tall }) => {
  const known = Number.isFinite(pct) && pct >= 0;
  const clamped = known ? Math.min(100, pct) : 0;
  const color = known ? loadColor(clamped) : 'text-muted-foreground';
  return (
    <div className={cn('min-w-0 space-y-2', tall && 'flex h-full flex-col')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4 text-muted-foreground" />{label}</div>
        <div className="text-sm font-semibold tabular-nums">{known ? `${Math.round(clamped)}%` : '—'}</div>
      </div>
      <div className="truncate text-xs text-muted-foreground" title={detail}>{detail}</div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full bg-current transition-all', color)} style={{ width: `${clamped}%` }} />
      </div>
      <Sparkline data={history} window={window} end={end} tall={tall} title={note} className={cn(color, tall && 'mt-auto')} />
    </div>
  );
};

export const ServerInfo: React.FC = () => {
  const { t } = useTranslation();
  const touring = useTourActive();
  const query = useQuery({
    queryKey: HISTORY_KEY, enabled: !touring,
    queryFn: async () => {
      // The backend keeps an hour of samples; after the first load only newer ones are fetched.
      const previous = panelQueryClient.getQueryData<ServerInfoHistory>(HISTORY_KEY);
      const since = previous?.backend ? previous.lastT : 0;
      const { data } = await apiClient.get<SystemInfo & { history?: BackendHistory }>(`/system/sysinfo?since=${since}`);
      if (!data?.os || !Array.isArray(data.disks)) throw new Error('Invalid server information');
      return appendServerInfo(previous, data);
    },
    staleTime: POLL_MS, gcTime: typeof document === 'undefined' ? 0 : 30 * 60_000, refetchInterval: POLL_MS,
  }, panelQueryClient);
  const info = useTourValue(query.data?.info ?? null, tourSamples.system);
  const cpuHistory = useTourValue(query.data?.cpu ?? [], spacedPoints(tourSamples.cpuHistory));
  const memHistory = useTourValue(query.data?.memory ?? [], spacedPoints(tourSamples.memHistory));
  const historyEnd = useTourValue(query.data?.lastT ?? 0, (Math.max(tourSamples.cpuHistory.length, tourSamples.memHistory.length) - 1) * 5);
  const historyWindow = SERVER_CHART_WINDOW_SECONDS;
  const historyNote = t('dashboard.history_window', { minutes: historyWindow / 60 });

  if (!info) return <Card className="h-full min-h-64 p-4" aria-busy={query.isPending}>
    <CardTitle className="mb-4 text-sm">{t('dashboard.server_info')}</CardTitle>
    {query.isError ? <div role="alert" className="space-y-3 text-sm text-destructive">{t('common.load_fail')}
      <Button variant="outline" size="sm" onClick={() => void query.refetch()}>{t('common.retry')}</Button></div>
      : <div role="status" aria-label={t('common.loading')} className="space-y-5"><div className="grid grid-cols-2 gap-4"><Skeleton className="h-28" /><Skeleton className="h-28" /></div><Skeleton className="h-12" /></div>}
  </Card>;
  const LOGOS = new Set(['windows', 'macos', 'ubuntu', 'debian', 'centos', 'rocky', 'server']);
  const logoSrc = `./os/${LOGOS.has(info.os_id) ? info.os_id : 'server'}.svg`;
  const cpuDetail = [
    info.cpu_model,
    `${info.cpu_physical || info.cpu_cores} ${t('dashboard.physical')} · ${info.cpu_cores} ${t('dashboard.logical')}`,
    info.cpu_mhz ? fmtGHz(info.cpu_mhz) : null,
  ].filter(Boolean).join(' · ');

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="flex shrink-0 flex-row flex-wrap items-center justify-between gap-3 p-4 pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4 text-muted-foreground" />{t('dashboard.server_info')}
          <FeatureHelp title={t('dashboard.server_info')} description={<p data-testid="server-history-window">{historyNote}</p>} />
        </CardTitle>
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <img src={logoSrc} alt="" className="h-4 w-4 shrink-0 object-contain"
            onError={(e) => { const img = e.currentTarget; if (!img.src.endsWith('/os/server.svg')) img.src = './os/server.svg'; }} />
          <span className="truncate">{info.os}</span>
        </div>
      </CardHeader>
      <CardContent className="grid min-h-0 flex-1 grid-cols-2 gap-3 p-4 pt-0 lg:grid-rows-[minmax(0,1fr)_auto]">
        {!touring && query.isError && <p role="status" className="col-span-2 text-xs text-amber-600">{t('common.load_fail')} · {t('dashboard.cached_snapshot')}</p>}
        <ResourceMeter tall icon={Cpu} label={t('dashboard.cpu')} pct={info.cpu_load}
          detail={cpuDetail} history={visibleServerHistory(cpuHistory, historyEnd)} window={historyWindow} end={historyEnd} note={historyNote} />
        <ResourceMeter tall icon={MemoryStick} label={t('dashboard.memory')} pct={info.mem_load}
          detail={`${fmtMB(info.mem_used_mb)} / ${fmtMB(info.mem_total_mb)}${info.mem_speed_mhz ? ` · ${info.mem_speed_mhz} MHz` : ''}`}
          history={visibleServerHistory(memHistory, historyEnd)} window={historyWindow} end={historyEnd} note={historyNote} />

        <div className="col-span-2 min-w-0 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium"><HardDrive className="h-4 w-4 text-muted-foreground" />{t('dashboard.disk')}
            <FeatureHelp title={t('dashboard.disk')} description={<p>{t('dashboard.disk_hint')}</p>} />
          </div>
          {info.disks.length === 0 && <p className="text-xs text-muted-foreground">{t('dashboard.disk_unavailable')}</p>}
          {info.disks.map((d) => (
            <div key={d.mount} data-disk-path={d.mount} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate" title={d.mount}>
                  <span className="font-medium">{d.mount}</span>
                  {d.label && <span className="text-muted-foreground"> {d.label}</span>}
                  {d.model && <span className="text-muted-foreground"> · {d.model}</span>}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{d.used_gb} / {d.total_gb} GB · {d.load}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full bg-current transition-all', loadColor(d.load))} style={{ width: `${Math.min(100, d.load)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ServerInfo;
