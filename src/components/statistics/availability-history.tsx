import { useMemo, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Portal as TooltipPortal } from '@radix-ui/react-tooltip';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { timezoneLabel } from '@/lib/schedule-time';
import { buildOnlineDays, onlineClock, selectedOnlineDay, type OnlineGranularity, type OnlineSample, type OnlineState } from '@/lib/availability-history';

const colors: Record<OnlineState, string> = {
  online: 'bg-emerald-500 hover:bg-emerald-400', partial: 'bg-amber-400 hover:bg-amber-300',
  offline: 'bg-rose-500 hover:bg-rose-400', unknown: 'bg-muted-foreground/15 hover:bg-muted-foreground/25',
};

export function AvailabilityHistory({ rows, dates, granularity, timezoneMinutes }: {
  rows: OnlineSample[]; dates: string[]; granularity: OnlineGranularity; timezoneMinutes: number | null;
}) {
  const { t } = useTranslation();
  const offset = timezoneMinutes ?? 0;
  const days = useMemo(() => buildOnlineDays(rows, dates, granularity, offset, Date.now()), [rows, dates, granularity, offset]);
  const [selected, setSelected] = useState<string | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const day = selectedOnlineDay(days, selected);
  const labels: Record<OnlineState, string> = {
    online: t('statistics.online'), partial: t('statistics.partial'),
    offline: t('statistics.offline'), unknown: t('availability.uncollected'),
  };
  if (!day) return <p className="py-6 text-center text-xs text-muted-foreground">{t('statistics.collecting')}</p>;
  const index = days.indexOf(day);
  const current = day.slots.find(slot => slot.start === focused)
    ?? [...day.slots].reverse().find(slot => slot.state !== 'unknown') ?? day.slots[0];
  const choose = (date: string) => { setSelected(date); setFocused(null); };
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, position: number, count: number, selector: string) => {
    const next = event.key === 'ArrowRight' ? Math.min(count - 1, position + 1)
      : event.key === 'ArrowLeft' ? Math.max(0, position - 1)
        : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null;
    if (next === null) return;
    event.preventDefault();
    const target = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(selector)[next];
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const timeRange = (start: number, end: number) => onlineClock(start, offset) + '–' + (end === day.end ? '24:00' : onlineClock(end, offset));

  return <div className="space-y-4" data-online-timeline="compact">
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium">{t('availability.overview')}</span>
        <span className="text-muted-foreground">{t('availability.overview_hint')}</span>
      </div>
      <div className="overflow-x-auto px-1 py-1">
        <TooltipProvider delayDuration={150}>
          <div className="flex flex-nowrap gap-1" role="group" aria-label={t('availability.overview')}
            style={{ minWidth: Math.max(240, days.length * 9) }}>
            {days.map((item, itemIndex) => {
              const detail = `${item.date} · ${labels[item.state]} · ${t('availability.known_intervals', { count: item.knownCount, total: item.slots.length })}`;
              return <Tooltip key={item.date}>
                <TooltipTrigger asChild>
                  <button type="button" data-online-day={item.date} aria-label={detail} aria-pressed={item.date === day.date}
                    tabIndex={item.date === day.date ? 0 : -1} onClick={() => choose(item.date)} onFocus={() => choose(item.date)}
                    onKeyDown={event => moveFocus(event, itemIndex, days.length, '[data-online-day]')}
                    className={cn('h-9 min-w-0 flex-1 rounded-[4px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring', colors[item.state],
                      item.date === day.date && 'ring-2 ring-primary ring-offset-2 ring-offset-background')} />
                </TooltipTrigger>
                <TooltipPortal><TooltipContent className="max-w-[min(24rem,calc(100vw-2rem))] text-xs">{detail}</TooltipContent></TooltipPortal>
              </Tooltip>;
            })}
          </div>
        </TooltipProvider>
      </div>
      {days.length <= 7 ? <div className="flex gap-1 px-1 text-[10px] tabular-nums text-muted-foreground" aria-hidden="true">
        {days.map(item => <span key={item.date} className={cn('min-w-0 flex-1 text-center', item.date === day.date && 'font-semibold text-primary')}>{item.date.slice(5).replace('-', '/')}</span>)}
      </div> : <div className="flex justify-between px-1 text-[10px] tabular-nums text-muted-foreground" aria-hidden="true">
        <span>{days[0].date}</span><span>{days[Math.floor(days.length / 2)].date}</span><span>{days[days.length - 1].date}</span>
      </div>}
    </div>

    <div className="rounded-xl border bg-muted/15 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="h-4 w-4 text-primary" />{t('availability.day_detail')}</div>
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={index === 0}
            aria-label={t('availability.previous_day')} onClick={() => choose(days[index - 1].date)}><ChevronLeft className="h-4 w-4" /></Button>
          <Select value={day.date} onValueChange={choose}>
            <SelectTrigger className="h-8 w-36 text-xs" aria-label={t('availability.day_picker')}><SelectValue /></SelectTrigger>
            <SelectContent>{days.map(item => <SelectItem key={item.date} value={item.date}>{item.date}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={index === days.length - 1}
            aria-label={t('availability.next_day')} onClick={() => choose(days[index + 1].date)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
        <span>{t('availability.known_intervals', { count: day.knownCount, total: day.slots.length })}</span>
        <span>{t('statistics.granularity_' + granularity)} · {timezoneMinutes === null ? t('availability.timezone_fallback') : timezoneLabel(offset)}</span>
      </div>
      <div className="overflow-x-auto px-1 py-1" data-online-detail-scroll="">
        <div style={{ minWidth: Math.max(480, day.slots.length * 6) }}>
          <div className="flex flex-nowrap gap-[2px]" role="group" aria-label={`${day.date} · ${t('availability.day_detail')}`}>
            {day.slots.map((slot, slotIndex) => {
              const detail = `${day.date} ${timeRange(slot.start, slot.end)} · ${labels[slot.state]}${slot.sample ? ` · ${slot.sample.online_count}/${slot.sample.total_count}` : ''}`;
              return <button type="button" key={slot.start} data-online-slot={slot.start} aria-label={detail}
                tabIndex={current.start === slot.start ? 0 : -1} onMouseEnter={() => setFocused(slot.start)} onFocus={() => setFocused(slot.start)} onClick={() => setFocused(slot.start)}
                onKeyDown={event => moveFocus(event, slotIndex, day.slots.length, '[data-online-slot]')}
                style={{ flexGrow: slot.end - slot.start, flexBasis: 0 }}
                className={cn('h-9 min-w-0 rounded-[3px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring', colors[slot.state],
                  current.start === slot.start && 'ring-2 ring-foreground/50 ring-offset-1 ring-offset-background')} />;
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] tabular-nums text-muted-foreground" aria-hidden="true">
            {['00:00', '06:00', '12:00', '18:00', '24:00'].map(label => <span key={label}>{label}</span>)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-background/70 px-3 py-2 text-xs tabular-nums" aria-live="polite" aria-atomic="true">
        <span className="font-medium">{day.date} {timeRange(current.start, current.end)}</span>
        <span className="flex items-center gap-1.5"><i className={cn('h-2 w-2 rounded-full', colors[current.state])} />{labels[current.state]}</span>
        {current.sample && <span className="text-muted-foreground">{current.sample.online_count}/{current.sample.total_count} {t('statistics.adapters')}</span>}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {(['online', 'partial', 'offline', 'unknown'] as const).map(state => <span key={state} className="inline-flex items-center gap-1.5"><i className={cn('h-2.5 w-2.5 rounded-sm', colors[state])} />{labels[state]}</span>)}
    </div>
  </div>;
}
