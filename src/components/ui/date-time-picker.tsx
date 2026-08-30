import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const pad = (value: number) => String(value).padStart(2, '0');
const toDateValue = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDateValue = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toDateValue(date) === value ? date : null;
};

export function DatePicker({ value, onValueChange, label, placeholder, className }: {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const selected = parseDateValue(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => selected || new Date());
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => (
    index < firstWeekday ? null : index - firstWeekday + 1
  ));
  const weekdayLabels = useMemo(() => Array.from({ length: 7 }, (_, day) => (
    new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(new Date(2026, 7, 30 + day))
  )), []);
  const monthLabel = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long' }).format(view);

  const changeOpen = (next: boolean) => {
    if (next) setView(selected || new Date());
    setOpen(next);
  };

  return <Dialog open={open} onOpenChange={changeOpen}>
    <Button type="button" variant="outline" onClick={() => changeOpen(true)}
      className={cn('h-10 w-full justify-between px-3 font-normal', !value && 'text-muted-foreground', className)}>
      <span>{value || placeholder || label}</span><CalendarDays className="h-4 w-4 opacity-60" />
    </Button>
    <DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" size="icon" onClick={() => setView(new Date(year, month - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{monthLabel}</span>
          <Button type="button" variant="ghost" size="icon" onClick={() => setView(new Date(year, month + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdayLabels.map((day, index) => <span key={index} className="py-1 text-xs text-muted-foreground">{day}</span>)}
          {cells.map((day, index) => day == null ? <span key={'blank-' + index} /> : (() => {
            const candidate = toDateValue(new Date(year, month, day));
            const active = candidate === value;
            return <Button key={candidate} type="button" size="sm" variant={active ? 'default' : 'ghost'}
              className="h-9 w-full p-0" onClick={() => { onValueChange(candidate); setOpen(false); }}>
              {day}
            </Button>;
          })())}
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}

export function TimePicker({ value, onValueChange, label, className }: {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const hour = match && Number(match[1]) < 24 ? match[1] : '00';
  const minute = match && Number(match[2]) < 60 ? match[2] : '00';
  return <div className={cn('grid grid-cols-[1fr_auto_1fr] items-center gap-2', className)}>
    <Select value={hour} onValueChange={(next) => onValueChange(next + ':' + minute)}>
      <SelectTrigger aria-label={label} className="h-10"><SelectValue /></SelectTrigger>
      <SelectContent>{Array.from({ length: 24 }, (_, index) => pad(index)).map((item) => (
        <SelectItem key={item} value={item}>{item}</SelectItem>
      ))}</SelectContent>
    </Select>
    <span className="text-sm text-muted-foreground">:</span>
    <Select value={minute} onValueChange={(next) => onValueChange(hour + ':' + next)}>
      <SelectTrigger aria-label={label} className="h-10"><SelectValue /></SelectTrigger>
      <SelectContent>{Array.from({ length: 60 }, (_, index) => pad(index)).map((item) => (
        <SelectItem key={item} value={item}>{item}</SelectItem>
      ))}</SelectContent>
    </Select>
  </div>;
}