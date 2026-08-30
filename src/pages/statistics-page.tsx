import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity, BarChart3, CalendarDays, Command, Dices, MessagesSquare,
  PlugZap, User, UsersRound,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type OnlineGranularity = '5m' | '1h' | '6h' | '1d';

interface AdapterOption {
  id: string;
  name: string;
  platform: string;
  connected: boolean;
}

interface StatisticsData {
  summary: {
    total_commands: number;
    total_rolls: number;
    total_players: number;
    active_groups: number;
    adapter_online: number;
    adapter_total: number;
    availability_rate: number;
    uptime_seconds: number;
  };
  filters: {
    days: number;
    platform: string;
    adapter: string;
    platforms: string[];
    adapters: AdapterOption[];
    granularity: OnlineGranularity;
  };
  daily_usage: { date: string; commands: number; rolls: number }[];
  usage_by_hour: { hour: number; commands: number; rolls: number }[];
  dice_faces: { sides: number; total: number; faces: { face: number; count: number }[] }[];
  check_results: Record<string, number>;
  command_distribution: { command: string; count: number }[];
  scope_comparison: { id: string; name: string; platform: string; commands: number; rolls: number }[];
  top_groups: {
    name: string;
    group_id: string;
    platform: string;
    command_count: number;
    roll_count: number;
    active_users: number;
    last_command_at: string;
  }[];
  top_users: {
    nickname: string;
    user_id: string;
    platform: string;
    command_count: number;
    last_command_at: string;
  }[];
  online_history: { sampled_at: string; online_count: number; total_count: number }[];
  adapter_availability: {
    id: string;
    name: string;
    platform: string;
    connected: boolean;
    uptime_percent: number;
    samples: number;
  }[];
  scoped_data_available: boolean;
}

const number = (value: number) => value.toLocaleString();
const compact = (value: number) => Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const percent = (value: number) => value.toFixed(value >= 99 ? 2 : 1) + '%';

const platformLabel = (platform: string) => ({
  onebot_v11: 'OneBot V11',
  qq_official: 'QQ Official',
  discord: 'Discord',
  kook: 'KOOK',
}[platform] || platform || '—');

const commandLabel = (command: string) => ({
  roll: '.r / .rd',
  check: '.ra / .rc',
  card: '.st / .pc',
  log: '.log',
  deck: '.draw / .deck',
  other: 'Other',
}[command] || '.' + command);

const shortDate = (value: string) => value.length >= 10 ? value.slice(5, 10).replace('-', '/') : value;
const lastUsed = (value: string) => value ? value.slice(0, 10) : '—';
const localTime = (value: string) => {
  if (!value) return '—';
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : value + 'Z');
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const StatisticsPage: React.FC = () => {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const [platform, setPlatform] = useState('');
  const [adapter, setAdapter] = useState('');
  const [granularity, setGranularity] = useState<OnlineGranularity>('1h');
  const [data, setData] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ days: String(days), granularity });
        if (platform) params.set('platform', platform);
        if (adapter) params.set('adapter', adapter);
        const response = await fetch('/api/statistics/overview?' + params.toString());
        const payload = await response.json();
        if (!response.ok || payload.code !== 0) throw new Error(payload.message || response.statusText);
        if (!active) return;
        setData(payload.data);
        setError('');
      } catch (reason) {
        if (active) setError(String(reason));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [days, platform, adapter, granularity]);

  const adapterOptions = useMemo(() => {
    const rows = data?.filters.adapters || [];
    return platform ? rows.filter((item) => item.platform === platform) : rows;
  }, [data, platform]);

  const selectDays = (value: number) => {
    setDays(value);
    if (value > 7 && granularity === '5m') setGranularity('1h');
  };

  const selectPlatform = (value: string) => {
    setPlatform(value);
    setAdapter('');
  };

  if (!data && loading) return <div className="h-[36rem] animate-pulse rounded-xl bg-muted" />;
  if (!data) return <p className="text-sm text-destructive">{t('statistics.load_failed')}: {error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <PageHeader icon={BarChart3} title={t('statistics.title')} description={t('statistics.subtitle')} />
        {loading && <span className="mt-2 text-xs text-muted-foreground">{t('statistics.refreshing')}</span>}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-3">
          <div className="inline-flex rounded-lg bg-muted p-1" aria-label={t('statistics.date_range')}>
            {[7, 30, 90].map((value) => (
              <Button key={value} type="button" variant="ghost" size="sm"
                className={cn('h-7 px-3 text-xs', days === value && 'bg-background text-foreground shadow-sm hover:bg-background')}
                onClick={() => selectDays(value)}>
                {t('statistics.days', { count: value })}
              </Button>
            ))}
          </div>

          <Select value={platform || '__all_platforms__'}
            onValueChange={(value) => selectPlatform(value === '__all_platforms__' ? '' : value)}>
            <SelectTrigger aria-label={t('statistics.platform_filter')} className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all_platforms__">{t('statistics.all_platforms')}</SelectItem>
              {data.filters.platforms.map((item) => <SelectItem key={item} value={item}>{platformLabel(item)}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={adapter || '__all_adapters__'}
            onValueChange={(value) => setAdapter(value === '__all_adapters__' ? '' : value)}>
            <SelectTrigger aria-label={t('statistics.adapter_filter')} className="h-9 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all_adapters__">{t('statistics.all_adapters')}</SelectItem>
              {adapterOptions.map((item) => (
                <SelectItem key={item.id} value={item.id}>{item.name || item.id} · {platformLabel(item.platform)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span>{t('statistics.scope_collection_note')}</span>
          </div>
        </CardContent>
      </Card>

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Summary icon={MessagesSquare} label={t('statistics.commands')} value={number(data.summary.total_commands)}
          foot={t('statistics.selected_period')} />
        <Summary icon={Dices} label={t('statistics.rolls')} value={number(data.summary.total_rolls)}
          foot={data.summary.total_commands ? t('statistics.roll_ratio', { value: percent(data.summary.total_rolls / data.summary.total_commands * 100) }) : '—'} />
        <Summary icon={User} label={t('statistics.players')} value={number(data.summary.total_players)}
          foot={t('statistics.active_in_period')} />
        <Summary icon={UsersRound} label={t('statistics.active_groups')} value={number(data.summary.active_groups)}
          foot={t('statistics.active_in_period')} />
        <Summary icon={PlugZap} label={t('statistics.availability')} value={percent(data.summary.availability_rate)}
          foot={data.summary.adapter_online + ' / ' + data.summary.adapter_total + ' ' + t('statistics.online')} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />{t('statistics.daily_trend')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t('statistics.daily_trend_desc')}</p>
        </CardHeader>
        <CardContent><DailyTrend rows={data.daily_usage} /></CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><PlugZap className="h-4 w-4 text-primary" />{t('statistics.online_history')}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{t('statistics.online_history_desc')}</p>
          </div>
          <Select value={granularity} onValueChange={(value) => setGranularity(value as OnlineGranularity)}>
            <SelectTrigger aria-label={t('statistics.online_granularity')} className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5m" disabled={days > 7}>{t('statistics.granularity_5m')}</SelectItem>
              <SelectItem value="1h">{t('statistics.granularity_1h')}</SelectItem>
              <SelectItem value="6h">{t('statistics.granularity_6h')}</SelectItem>
              <SelectItem value="1d">{t('statistics.granularity_1d')}</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent><OnlineHistory rows={data.online_history} granularityLabel={t('statistics.granularity_' + granularity)} /></CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{adapter || platform ? t('statistics.adapter_comparison') : t('statistics.platform_comparison')}</CardTitle></CardHeader>
          <CardContent><ScopeComparison rows={data.scope_comparison} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Command className="h-4 w-4 text-primary" />{t('statistics.command_distribution')}</CardTitle></CardHeader>
          <CardContent><CommandDistribution rows={data.command_distribution} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t('statistics.adapter_availability')}</CardTitle></CardHeader>
          <CardContent><AdapterAvailability rows={data.adapter_availability} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t('statistics.usage_hours')}</CardTitle></CardHeader>
          <CardContent><HourChart rows={data.usage_by_hour} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t('statistics.check_results')}</CardTitle></CardHeader>
          <CardContent><ResultChart rows={data.check_results} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t('statistics.face_distribution')}</CardTitle></CardHeader>
        <CardContent>
          {data.dice_faces.length
            ? <div className="grid gap-6 xl:grid-cols-2">{[...data.dice_faces].sort((a, b) => b.total - a.total).slice(0, 8).map((dice) => <FaceChart key={dice.sides} dice={dice} />)}</div>
            : <Empty />}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <RankingCard title={t('statistics.top_groups')} kind="group" rows={data.top_groups} />
        <RankingCard title={t('statistics.top_users')} kind="user" rows={data.top_users} />
      </div>
    </div>
  );
};

function Summary({ icon: Icon, label, value, foot }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  foot: string;
}) {
  return <Card><CardContent className="p-4">
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>{label}</span>
      <span className="rounded-md bg-primary/10 p-1.5 text-primary"><Icon className="h-4 w-4" /></span>
    </div>
    <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
    <p className="mt-1 truncate text-[11px] text-muted-foreground">{foot}</p>
  </CardContent></Card>;
}

function DailyTrend({ rows }: { rows: StatisticsData['daily_usage'] }) {
  const { t } = useTranslation();
  const width = Math.max(720, rows.length * 34 + 70);
  const height = 270;
  const left = 46;
  const right = 14;
  const top = 15;
  const bottom = 218;
  const plotWidth = width - left - right;
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.commands, row.rolls]));
  const y = (value: number) => bottom - (value / maxValue) * (bottom - top);
  const step = plotWidth / Math.max(1, rows.length);
  const barWidth = Math.min(12, step * 0.34);

  return <div>
    <div className="overflow-x-auto pb-2">
      <svg role="img" aria-label={t('statistics.daily_trend')} viewBox={'0 0 ' + width + ' ' + height}
        style={{ width: width + 'px', minWidth: '100%', height: height + 'px' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const value = maxValue * (1 - ratio);
          const py = top + (bottom - top) * ratio;
          return <g key={ratio}>
            <line x1={left} y1={py} x2={width - right} y2={py} className="stroke-border" />
            <text x={left - 8} y={py + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">{compact(value)}</text>
          </g>;
        })}
        {rows.map((row, index) => {
          const center = left + step * index + step / 2;
          return <g key={row.date}>
            <rect x={center - barWidth - 1} y={y(row.commands)} width={barWidth}
              height={Math.max(0, bottom - y(row.commands))} rx="2" className="fill-primary/80">
              <title>{row.date + ' · ' + row.commands.toLocaleString() + ' ' + t('statistics.commands')}</title>
            </rect>
            <rect x={center + 1} y={y(row.rolls)} width={barWidth}
              height={Math.max(0, bottom - y(row.rolls))} rx="2" className="fill-cyan-500/75">
              <title>{row.date + ' · ' + row.rolls.toLocaleString() + ' ' + t('statistics.rolls')}</title>
            </rect>
            <text transform={'translate(' + (center + 3) + ' ' + (bottom + 11) + ') rotate(-55)'}
              textAnchor="end" className="fill-muted-foreground text-[9px]">{shortDate(row.date)}</text>
          </g>;
        })}
      </svg>
    </div>
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      <Legend color="bg-primary" label={t('statistics.commands')} />
      <Legend color="bg-cyan-500" label={t('statistics.rolls')} />
      <span className="ml-auto">{t('statistics.all_dates_shown', { count: rows.length })}</span>
    </div>
  </div>;
}

function OnlineHistory({ rows, granularityLabel }: {
  rows: StatisticsData['online_history'];
  granularityLabel: string;
}) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState<StatisticsData['online_history'][number] | null>(null);
  if (!rows.length) return <Empty />;
  const statusOf = (sample: StatisticsData['online_history'][number]) => sample.total_count === 0 ? 'unknown'
    : sample.online_count === sample.total_count ? 'online' : sample.online_count > 0 ? 'partial' : 'offline';
  const colors: Record<string, string> = {
    online: 'bg-emerald-500 hover:bg-emerald-400',
    partial: 'bg-amber-400 hover:bg-amber-300',
    offline: 'bg-rose-500 hover:bg-rose-400',
    unknown: 'bg-muted hover:bg-muted-foreground/30',
  };
  const labels: Record<string, string> = {
    online: t('statistics.online'), partial: t('statistics.partial'),
    offline: t('statistics.offline'), unknown: t('statistics.collecting'),
  };
  const current = focused || rows[rows.length - 1];
  const currentStatus = statusOf(current);

  return <div className="space-y-3">
    <div className="max-h-56 overflow-y-auto rounded-md border bg-muted/20 p-2">
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(6px, 1fr))' }}>
        {rows.map((sample, index) => {
          const status = statusOf(sample);
          const active = sample.sampled_at === current.sampled_at;
          const detail = `${localTime(sample.sampled_at)} · ${labels[status]} · ${sample.online_count}/${sample.total_count}`;
          return <button type="button" key={sample.sampled_at + '-' + index} aria-label={detail}
            onMouseEnter={() => setFocused(sample)} onFocus={() => setFocused(sample)} onClick={() => setFocused(sample)}
            className={cn('h-4 min-w-0 rounded-[2px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              colors[status], active && 'ring-2 ring-foreground/50 ring-offset-1 ring-offset-background')} />;
        })}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <Legend color="bg-emerald-500" label={t('statistics.online')} />
      <Legend color="bg-amber-400" label={t('statistics.partial')} />
      <Legend color="bg-rose-500" label={t('statistics.offline')} />
      <span className="ml-auto">{t('statistics.online_points', { count: rows.length })} · {granularityLabel}</span>
    </div>
    <div className="rounded-md bg-muted/40 px-3 py-2 text-xs tabular-nums">
      {localTime(current.sampled_at)} · {labels[currentStatus]} · {current.online_count}/{current.total_count}
    </div>
  </div>;
}

function ScopeComparison({ rows }: { rows: StatisticsData['scope_comparison'] }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...rows.map((row) => row.commands));
  if (!rows.length) return <Empty />;
  return <div className="space-y-3">{rows.slice(0, 8).map((row) => (
    <div key={row.id} className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate font-medium">{row.name === row.platform ? platformLabel(row.platform) : row.name}</span>
        <span className="shrink-0 tabular-nums">{number(row.commands)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: row.commands / max * 100 + '%' }} />
      </div>
      <p className="text-[10px] text-muted-foreground">{platformLabel(row.platform)} · {number(row.rolls)} {t('statistics.rolls')}</p>
    </div>
  ))}</div>;
}

function CommandDistribution({ rows }: { rows: StatisticsData['command_distribution'] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!rows.length) return <Empty />;
  return <div className="space-y-2.5">{rows.slice(0, 8).map((row, index) => (
    <div key={row.command} className="grid grid-cols-[6rem_1fr_3.5rem] items-center gap-2 text-xs">
      <span className="truncate font-mono">{commandLabel(row.command)}</span>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', index === 0 ? 'bg-primary' : 'bg-primary/55')}
          style={{ width: (total ? row.count / total * 100 : 0) + '%' }} />
      </div>
      <span className="text-right tabular-nums text-muted-foreground">{total ? percent(row.count / total * 100) : '0%'}</span>
    </div>
  ))}</div>;
}

function AdapterAvailability({ rows }: { rows: StatisticsData['adapter_availability'] }) {
  const { t } = useTranslation();
  if (!rows.length) return <Empty />;
  return <div className="space-y-3">{rows.map((row) => (
    <div key={row.id}>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="flex min-w-0 items-center gap-2">
          <i className={cn('h-2 w-2 shrink-0 rounded-full', row.connected ? 'bg-emerald-500' : 'bg-rose-500')} />
          <span className="truncate">{row.name || row.id}</span>
        </span>
        <span className="tabular-nums">{percent(row.uptime_percent)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', row.uptime_percent >= 99 ? 'bg-emerald-500' : row.uptime_percent >= 95 ? 'bg-amber-500' : 'bg-rose-500')}
          style={{ width: Math.max(0, Math.min(100, row.uptime_percent)) + '%' }} />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{platformLabel(row.platform)} · {row.samples || 0} {t('statistics.samples')}</p>
    </div>
  ))}</div>;
}

function RankingCard({ title, kind, rows }: {
  title: string;
  kind: 'group' | 'user';
  rows: StatisticsData['top_groups'] | StatisticsData['top_users'];
}) {
  const { t } = useTranslation();
  return <Card>
    <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
    <CardContent>
      {!rows.length ? <Empty /> : <table className="rt w-full text-sm">
        <thead><tr className="border-b text-xs text-muted-foreground">
          <th className="px-2 py-2 text-left">#</th>
          <th className="px-2 py-2 text-left">{kind === 'group' ? t('statistics.group') : t('statistics.user')}</th>
          <th className="px-2 py-2 text-left">{t('statistics.platform')}</th>
          {kind === 'group' && <th className="px-2 py-2 text-right">{t('statistics.players')}</th>}
          <th className="px-2 py-2 text-right">{t('statistics.commands')}</th>
          <th className="px-2 py-2 text-right">{t('statistics.last_used')}</th>
        </tr></thead>
        <tbody>{rows.slice(0, 10).map((raw, index) => {
          const row = raw as StatisticsData['top_groups'][number] & StatisticsData['top_users'][number];
          const name = kind === 'group' ? row.name : (row.nickname || row.user_id);
          const key = kind === 'group' ? row.platform + ':' + row.group_id : row.platform + ':' + row.user_id;
          return <tr key={key} className="border-b last:border-0">
            <td data-label="#" className="px-2 py-2 text-muted-foreground">{index + 1}</td>
            <td data-label={kind === 'group' ? t('statistics.group') : t('statistics.user')} className="max-w-48 truncate px-2 py-2 font-medium" title={name}>{name}</td>
            <td data-label={t('statistics.platform')} className="px-2 py-2 text-muted-foreground">{platformLabel(row.platform)}</td>
            {kind === 'group' && <td data-label={t('statistics.players')} className="px-2 py-2 text-right tabular-nums">{number(row.active_users)}</td>}
            <td data-label={t('statistics.commands')} className="px-2 py-2 text-right tabular-nums">{number(row.command_count)}</td>
            <td data-label={t('statistics.last_used')} className="px-2 py-2 text-right text-xs text-muted-foreground">{lastUsed(row.last_command_at)}</td>
          </tr>;
        })}</tbody>
      </table>}
    </CardContent>
  </Card>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={cn('h-2.5 w-2.5 rounded-sm', color)} />{label}</span>;
}

function HourChart({ rows }: { rows: StatisticsData['usage_by_hour'] }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...rows.flatMap((row) => [row.commands, row.rolls]));
  return <div>
    <div className="flex h-48 items-end gap-1">
      {rows.map((row) => <div key={row.hour} className="group flex min-w-0 flex-1 items-end gap-px">
        <div className="w-1/2 rounded-t bg-primary/75" style={{ height: Math.max(row.commands ? 3 : 0, row.commands / max * 170) + 'px' }}
          title={row.hour + ':00 · ' + row.commands + ' ' + t('statistics.commands')} />
        <div className="w-1/2 rounded-t bg-cyan-500/65" style={{ height: Math.max(row.rolls ? 3 : 0, row.rolls / max * 170) + 'px' }}
          title={row.hour + ':00 · ' + row.rolls + ' ' + t('statistics.rolls')} />
      </div>)}
    </div>
    <div className="mt-2 grid grid-cols-8 text-[9px] text-muted-foreground">
      {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => <span key={hour}>{String(hour).padStart(2, '0')}:00</span>)}
    </div>
  </div>;
}

function ResultChart({ rows }: { rows: Record<string, number> }) {
  const { t } = useTranslation();
  const labels: Record<string, string> = {
    crit: t('statistics.result_crit'),
    extreme: t('statistics.result_extreme'),
    hard: t('statistics.result_hard'),
    regular: t('statistics.result_regular'),
    fail: t('statistics.result_fail'),
    fumble: t('statistics.result_fumble'),
  };
  const total = Object.values(rows).reduce((sum, value) => sum + value, 0);
  if (!total) return <Empty />;
  return <div className="space-y-3">{Object.entries(labels).map(([key, label]) => (
    <div key={key} className="grid grid-cols-[5rem_1fr_4rem] items-center gap-3 text-sm">
      <span>{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: (rows[key] || 0) / total * 100 + '%' }} /></div>
      <span className="text-right tabular-nums">{number(rows[key] || 0)}</span>
    </div>
  ))}</div>;
}

function FaceChart({ dice }: { dice: StatisticsData['dice_faces'][number] }) {
  const { t } = useTranslation();
  const bins = useMemo(() => {
    const size = Math.max(1, Math.ceil(dice.sides / 20));
    const values = Array.from({ length: Math.ceil(dice.sides / size) }, (_, index) => ({
      start: index * size + 1,
      end: Math.min(dice.sides, (index + 1) * size),
      count: 0,
    }));
    for (const face of dice.faces) values[Math.floor((face.face - 1) / size)].count += face.count;
    return values;
  }, [dice]);
  const max = Math.max(1, ...bins.map((bin) => bin.count));
  return <div>
    <div className="mb-2 flex items-center justify-between">
      <span className="font-medium">D{dice.sides}</span>
      <span className="text-xs text-muted-foreground">{number(dice.total)} {t('statistics.samples')}</span>
    </div>
    <div className="flex h-36 items-end gap-1">{bins.map((bin) => (
      <div key={bin.start} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
        <div className="w-full rounded-t bg-primary/65 transition-colors group-hover:bg-primary"
          style={{ height: Math.max(bin.count ? 3 : 0, bin.count / max * 110) + 'px' }}
          title={(bin.start === bin.end ? String(bin.start) : bin.start + '-' + bin.end) + ' · ' + bin.count} />
        <span className="text-[9px] text-muted-foreground">{bin.start}</span>
      </div>
    ))}</div>
  </div>;
}

function Empty() {
  const { t } = useTranslation();
  return <p className="py-6 text-center text-xs text-muted-foreground">{t('statistics.collecting')}</p>;
}

export default StatisticsPage;