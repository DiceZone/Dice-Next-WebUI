import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, BarChart3, Clock3, Dices, MessagesSquare, PlugZap, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatisticsData {
  summary: {
    total_commands: number;
    total_rolls: number;
    total_players: number;
    adapter_online: number;
    adapter_total: number;
    uptime_seconds: number;
  };
  usage_by_hour: { hour: number; commands: number; rolls: number }[];
  dice_faces: { sides: number; total: number; faces: { face: number; count: number }[] }[];
  check_results: Record<string, number>;
  top_users: { nickname: string; user_id: string; command_count: number; last_command_at: string }[];
  online_history: { sampled_at: string; online_count: number; total_count: number }[];
}

const number = (value: number) => value.toLocaleString();

const duration = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days ? `${days}d ${hours}h` : `${hours}h ${minutes}m`;
};

const localTime = (value: string) => {
  if (!value) return '—';
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const StatisticsPage: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<StatisticsData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/statistics/overview');
        const payload = await response.json();
        if (!response.ok || payload.code !== 0) throw new Error(payload.message || response.statusText);
        setData(payload.data);
        setError('');
      } catch (reason) {
        setError(String(reason));
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const uptimeBuckets = useMemo(() => {
    const samples = data?.online_history || [];
    if (samples.length <= 96) return samples;
    const size = Math.ceil(samples.length / 96);
    return Array.from({ length: Math.ceil(samples.length / size) }, (_, index) => {
      const group = samples.slice(index * size, (index + 1) * size);
      const last = group[group.length - 1];
      return {
        ...last,
        online_count: Math.min(...group.map((item) => item.online_count)),
        total_count: Math.max(...group.map((item) => item.total_count)),
      };
    });
  }, [data]);

  if (!data && !error) {
    return <div className="h-72 animate-pulse rounded-lg bg-muted" />;
  }

  if (!data) {
    return <p className="text-sm text-destructive">{t('statistics.load_failed')}: {error}</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={BarChart3} title={t('statistics.title')} description={t('statistics.subtitle')} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Summary icon={PlugZap} label={t('statistics.adapters')} value={`${data.summary.adapter_online} / ${data.summary.adapter_total}`} />
        <Summary icon={MessagesSquare} label={t('statistics.commands')} value={number(data.summary.total_commands)} />
        <Summary icon={Dices} label={t('statistics.rolls')} value={number(data.summary.total_rolls)} />
        <Summary icon={Users} label={t('statistics.players')} value={number(data.summary.total_players)} />
        <Summary icon={Clock3} label={t('statistics.uptime')} value={duration(data.summary.uptime_seconds)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Activity className="h-5 w-5" />{t('statistics.online_history')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {uptimeBuckets.length ? (
            <>
              <div className="flex h-16 items-stretch gap-[2px]">
                {uptimeBuckets.map((sample, index) => {
                  const status = sample.total_count === 0 ? 'unknown'
                    : sample.online_count === sample.total_count ? 'online'
                      : sample.online_count > 0 ? 'partial' : 'offline';
                  const colors = { online: 'bg-emerald-500', partial: 'bg-amber-400', offline: 'bg-rose-500', unknown: 'bg-muted' };
                  return <div key={`${sample.sampled_at}-${index}`} className={`min-w-0 flex-1 rounded-sm ${colors[status]}`}
                    title={`${localTime(sample.sampled_at)} · ${sample.online_count}/${sample.total_count}`} />;
                })}
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <Legend color="bg-emerald-500" label={t('statistics.online')} />
                <Legend color="bg-amber-400" label={t('statistics.partial')} />
                <Legend color="bg-rose-500" label={t('statistics.offline')} />
                <span className="ml-auto">{t('statistics.sample_note')}</span>
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground">{t('statistics.collecting')}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">{t('statistics.usage_hours')}</CardTitle></CardHeader>
          <CardContent><HourChart rows={data.usage_by_hour} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">{t('statistics.check_results')}</CardTitle></CardHeader>
          <CardContent><ResultChart rows={data.check_results} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">{t('statistics.face_distribution')}</CardTitle></CardHeader>
        <CardContent>
          {data.dice_faces.length
            ? <div className="grid gap-5 xl:grid-cols-2">{[...data.dice_faces].sort((a, b) => b.total - a.total).slice(0, 6).map((dice) => <FaceChart key={dice.sides} dice={dice} />)}</div>
            : <p className="text-sm text-muted-foreground">{t('statistics.collecting')}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">{t('statistics.top_users')}</CardTitle></CardHeader>
        <CardContent>
          <table className="rt w-full text-sm">
            <thead><tr className="border-b text-muted-foreground">
              <th className="px-3 py-2 text-center">{t('statistics.rank')}</th>
              <th className="px-3 py-2 text-center">{t('statistics.user')}</th>
              <th className="px-3 py-2 text-center">{t('statistics.commands')}</th>
              <th className="px-3 py-2 text-center">{t('statistics.last_used')}</th>
            </tr></thead>
            <tbody>{data.top_users.map((user, index) => (
              <tr key={user.user_id} className="border-b last:border-0">
                <td data-label={t('statistics.rank')} className="px-3 py-2 text-center">{index + 1}</td>
                <td data-label={t('statistics.user')} className="px-3 py-2 text-center">{user.nickname || user.user_id}</td>
                <td data-label={t('statistics.commands')} className="px-3 py-2 text-center tabular-nums">{number(user.command_count)}</td>
                <td data-label={t('statistics.last_used')} className="px-3 py-2 text-center text-muted-foreground">{localTime(user.last_command_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

function Summary({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return <Card><CardContent className="flex items-center gap-3 p-5">
    <div className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
    <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold tabular-nums">{value}</p></div>
  </CardContent></Card>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-sm ${color}`} />{label}</span>;
}

function HourChart({ rows }: { rows: StatisticsData['usage_by_hour'] }) {
  const max = Math.max(1, ...rows.map((row) => row.commands));
  return <div className="flex h-56 items-end gap-1">
    {rows.map((row) => <div key={row.hour} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
      <div className="w-full rounded-t bg-primary/75 transition-colors group-hover:bg-primary"
        style={{ height: `${Math.max(row.commands ? 4 : 0, row.commands / max * 180)}px` }}
        title={`${row.hour}:00 · ${row.commands}`} />
      <span className="text-[10px] text-muted-foreground">{row.hour % 3 === 0 ? row.hour : ''}</span>
    </div>)}
  </div>;
}

function ResultChart({ rows }: { rows: Record<string, number> }) {
  const labels: Record<string, string> = { crit: '大成功', extreme: '极难成功', hard: '困难成功', regular: '成功', fail: '失败', fumble: '大失败' };
  const max = Math.max(1, ...Object.values(rows));
  return <div className="space-y-3">{Object.entries(labels).map(([key, label]) => <div key={key} className="grid grid-cols-[5rem_1fr_4rem] items-center gap-3 text-sm">
    <span>{label}</span><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${rows[key] / max * 100}%` }} /></div>
    <span className="text-right tabular-nums">{number(rows[key] || 0)}</span>
  </div>)}</div>;
}

function FaceChart({ dice }: { dice: StatisticsData['dice_faces'][number] }) {
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
    <div className="mb-2 flex items-center justify-between"><span className="font-medium">D{dice.sides}</span><span className="text-xs text-muted-foreground">{number(dice.total)}</span></div>
    <div className="flex h-36 items-end gap-1">{bins.map((bin) => <div key={bin.start} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
      <div className="w-full rounded-t bg-sky-500/75 group-hover:bg-sky-500" style={{ height: `${Math.max(bin.count ? 3 : 0, bin.count / max * 110)}px` }}
        title={`${bin.start === bin.end ? bin.start : `${bin.start}-${bin.end}`} · ${bin.count}`} />
      <span className="text-[9px] text-muted-foreground">{bin.start}</span>
    </div>)}</div>
  </div>;
}

export default StatisticsPage;
