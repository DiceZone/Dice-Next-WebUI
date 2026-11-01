import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { enUS, ja, zhCN, zhTW } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const pad = (value: number) => String(value).padStart(2, '0');
// Date-only form fields are server wall-calendar values, NOT UTC instants.
// Never serialize through toISOString(), which shifts dates across timezones.
const parseDateValue = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = parse(value, 'yyyy-MM-dd', new Date());
  return isValid(date) && format(date, 'yyyy-MM-dd') === value ? date : undefined;
};

export function DatePicker({ value, onValueChange, label, placeholder, className }: {
  value: string; onValueChange: (value: string) => void; label: string; placeholder?: string; className?: string;
}) {
  const { i18n } = useTranslation();
  const selected = parseDateValue(value);
  const [open, setOpen] = useState(false);
  const locale = i18n.language === 'zh-Hant' ? zhTW : i18n.language.startsWith('zh') ? zhCN
    : i18n.language.startsWith('ja') ? ja : enUS;
  return <Dialog open={open} onOpenChange={setOpen}>
    <Button type="button" variant="outline" aria-label={label} onClick={() => setOpen(true)}
      className={cn('h-10 w-full justify-between px-3 font-normal', !value && 'text-muted-foreground', className)}>
      <span>{value || placeholder || label}</span><CalendarDays className="h-4 w-4 opacity-60" />
    </Button>
    <DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
      <Calendar mode="single" locale={locale} selected={selected} defaultMonth={selected} autoFocus
        className="mx-auto" onSelect={(date) => { if (!date) return; onValueChange(format(date, 'yyyy-MM-dd')); setOpen(false); }} />
    </DialogContent>
  </Dialog>;
}

export function TimePicker({ value, onValueChange, label, className, disabled = false }: {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const hour = match && Number(match[1]) < 24 ? match[1] : '00';
  const minute = match && Number(match[2]) < 60 ? match[2] : '00';
  return <div className={cn('grid grid-cols-[1fr_auto_1fr] items-center gap-2', className)}>
    <Select disabled={disabled} value={hour} onValueChange={(next) => onValueChange(next + ':' + minute)}>
      <SelectTrigger aria-label={label} className="h-10"><SelectValue /></SelectTrigger>
      <SelectContent>{Array.from({ length: 24 }, (_, index) => pad(index)).map((item) => (
        <SelectItem key={item} value={item}>{item}</SelectItem>
      ))}</SelectContent>
    </Select>
    <span className="text-sm text-muted-foreground">:</span>
    <Select disabled={disabled} value={minute} onValueChange={(next) => onValueChange(hour + ':' + next)}>
      <SelectTrigger aria-label={label} className="h-10"><SelectValue /></SelectTrigger>
      <SelectContent>{Array.from({ length: 60 }, (_, index) => pad(index)).map((item) => (
        <SelectItem key={item} value={item}>{item}</SelectItem>
      ))}</SelectContent>
    </Select>
  </div>;
}
