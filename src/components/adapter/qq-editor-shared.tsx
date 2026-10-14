import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { EditorIssue } from '@/lib/qq-official-editor';

export function EditorSelect({ label, value, options, disabled, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; disabled?: boolean; onChange: (value: string) => void;
}) {
  return <div className="min-w-0 space-y-1.5"><Label>{label}</Label>
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}
export function ItemActions({ index, count, disabled, onMove, onRemove }: {
  index: number; count: number; disabled?: boolean; onMove: (delta: -1 | 1) => void; onRemove: () => void;
}) {
  const { t } = useTranslation();
  return <div className="flex shrink-0 gap-1">
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={disabled || index === 0} aria-label={t('qq_editor.up')} onClick={() => onMove(-1)}><ArrowUp className="h-4 w-4" /></Button>
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={disabled || index === count - 1} aria-label={t('qq_editor.down')} onClick={() => onMove(1)}><ArrowDown className="h-4 w-4" /></Button>
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={disabled} aria-label={t('common.delete')} onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
  </div>;
}
export function EditorIssues({ issues }: { issues: EditorIssue[] }) {
  const { t } = useTranslation();
  if (!issues.length) return null;
  return <ul role="alert" className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
    {issues.map((issue, index) => <li key={index}>{t(`qq_editor.errors_${issue.key}`, { path: issue.path, max: issue.max })}</li>)}
  </ul>;
}
export function CollapsibleEditorItem({ title, actions, children, defaultOpen }: {
  title: string; actions: ReactNode; children: ReactNode; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return <section className="min-w-0 rounded-lg border bg-muted/10">
    <div className="flex items-center gap-2 px-3 py-2">
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}<span className="truncate">{title}</span>
      </button>{actions}
    </div>
    {open && <div className="space-y-3 border-t p-3">{children}</div>}
  </section>;
}
export function EditorError({ error }: { error: string }) {
  if (!error) return null;
  return <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0 whitespace-pre-line break-words">{error}</span>
  </div>;
}
export function EditorPreview({ children, payload }: { children: ReactNode; payload: unknown }) {
  const { t } = useTranslation();
  return <aside className="min-w-0 space-y-4 self-start rounded-xl border bg-muted/20 p-4 xl:sticky xl:top-4">
    <div><h3 className="font-medium">{t('qq_editor.preview')}</h3><p className="mt-1 text-xs text-muted-foreground">{t('qq_editor.preview_hint')}</p></div>
    {children}
    <details className="min-w-0 rounded-lg border bg-background p-3">
      <summary className="cursor-pointer text-sm text-muted-foreground">{t('qq_editor.raw')}</summary>
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(payload, null, 2)}</pre>
    </details>
  </aside>;
}
export function errorMessage(error: unknown, translate: (key: string) => string): string {
  const message = error instanceof Error ? error.message : String(error);
  return ['invalid_response', 'conflict', 'invalid_targets'].includes(message) ? translate(`qq_editor.errors_${message}`) : message;
}
