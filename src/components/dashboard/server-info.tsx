import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, MemoryStick, HardDrive, Server } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import apiClient from '@/lib/api-client';
import type { SystemInfo } from '@/types/dashboard';

const HISTORY = 60;          // samples kept for the curve
const POLL_MS = 2500;        // live refresh interval

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

/** Tiny dependency-free area sparkline. Values are 0–100. */
const Sparkline: React.FC<{ data: number[]; className?: string }> = ({ data, className }) => {
  const w = 100, h = 28;
  if (data.length < 2) return <div className="h-7" />;
  const step = w / (HISTORY - 1);
  const pts = data.map((v, i) => {
    const x = (i + (HISTORY - data.length)) * step;
    const y = h - (Math.min(100, Math.max(0, v)) / 100) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = pts.join(' ');
  const first = pts[0].split(',')[0];
  const last = pts[pts.length - 1].split(',')[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn('h-7 w-full', className)}>
      <polygon points={`${first},${h} ${line} ${last},${h}`} fill="currentColor" className="opacity-15" />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth={1.5}
        strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

/** One resource: header row (icon + label + %), detail, progress bar, curve. */
const ResourceMeter: React.FC<{ icon: LucideIcon; label: string; pct: number; detail: string; history: number[] }>
  = ({ icon: Icon, label, pct, detail, history }) => {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = loadColor(clamped);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4 text-muted-foreground" />{label}</div>
        <div className="text-sm font-semibold tabular-nums">{Math.round(clamped)}%</div>
      </div>
      <div className="text-xs text-muted-foreground">{detail}</div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full bg-current transition-all', color)} style={{ width: `${clamped}%` }} />
      </div>
      <Sparkline data={history} className={color} />
    </div>
  );
};

export const ServerInfo: React.FC = () => {
  const { t } = useTranslation();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const cpuHist = useRef<number[]>([]);
  const memHist = useRef<number[]>([]);
  const [, force] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await apiClient.get<SystemInfo>('/system/sysinfo');
        if (!alive) return;
        const d = res.data;
        setInfo(d);
        const cpu = d.cpu_load < 0 ? 0 : d.cpu_load;
        cpuHist.current = [...cpuHist.current, cpu].slice(-HISTORY);
        memHist.current = [...memHist.current, d.mem_load].slice(-HISTORY);
        force((n) => n + 1);
      } catch { /* keep last snapshot */ }
    };
    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!info || !info.os) return null;
  const cpuKnown = info.cpu_load >= 0;
  const LOGOS = new Set(['windows', 'ubuntu', 'debian', 'centos', 'rocky', 'server']);
  const logoSrc = `/os/${LOGOS.has(info.os_id) ? info.os_id : 'server'}.svg`;
  const cpuDetail = [
    info.cpu_model,
    `${info.cpu_physical || info.cpu_cores} ${t('dashboard.physical')} · ${info.cpu_cores} ${t('dashboard.logical')}`,
    info.cpu_mhz ? fmtGHz(info.cpu_mhz) : null,
  ].filter(Boolean).join(' · ');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" />{t('dashboard.server_info')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <img src={logoSrc} alt={info.os} className="h-9 w-9 shrink-0 object-contain"
            onError={(e) => { const img = e.currentTarget; if (!img.src.endsWith('/os/server.svg')) img.src = '/os/server.svg'; }} />
          <div className="min-w-0 text-sm font-medium truncate">{info.os}</div>
        </div>

        <ResourceMeter icon={Cpu} label={t('dashboard.cpu')} pct={cpuKnown ? info.cpu_load : 0}
          detail={cpuDetail} history={cpuHist.current} />
        <ResourceMeter icon={MemoryStick} label={t('dashboard.memory')} pct={info.mem_load}
          detail={`${fmtMB(info.mem_used_mb)} / ${fmtMB(info.mem_total_mb)}${info.mem_speed_mhz ? ` · ${info.mem_speed_mhz} MHz` : ''}`}
          history={memHist.current} />

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium"><HardDrive className="h-4 w-4 text-muted-foreground" />{t('dashboard.disk')}</div>
          {info.disks.map((d) => (
            <div key={d.mount} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate">
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
