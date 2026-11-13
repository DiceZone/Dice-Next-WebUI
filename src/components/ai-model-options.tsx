import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { TimePicker } from '@/components/ui/date-time-picker';
import { Label } from '@/components/ui/label';
import { HelpLabel } from '@/components/ui/help-label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type ThinkingMode = 'auto' | 'enabled' | 'disabled';
export interface ModelTuning {
  thinking?: ThinkingMode;
  thinking_protocol?: 'auto' | 'deepseek' | 'reasoning_effort';
  reasoning_effort?: 'low' | 'medium' | 'high';
  max_tokens?: number;
  price_cached_in?: number;
  off_peak?: { enabled: boolean; start: string; end: string; utc_offset_minutes: number; price_in: number; price_out: number; price_cached_in: number };
}

export function ThinkingSelect({ value, onChange, label }: { value: ThinkingMode; onChange: (value: ThinkingMode) => void; label: string }) {
  const { t } = useTranslation();
  return <Select value={value} onValueChange={(v) => onChange(v as ThinkingMode)}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>
    {(['auto', 'enabled', 'disabled'] as const).map((v) => <SelectItem key={v} value={v}>{t(`ai.thinking_${v}`)}</SelectItem>)}
  </SelectContent></Select>;
}

export function AiModelOptions({ value, onChange }: { value: ModelTuning & { kind: string; price_in: number; price_out: number }; onChange: (patch: Partial<ModelTuning>) => void }) {
  const { t } = useTranslation();
  const off = value.off_peak ?? { enabled: false, start: '00:00', end: '08:00', utc_offset_minutes: 480, price_in: value.price_in, price_out: value.price_out, price_cached_in: value.price_cached_in ?? value.price_in };
  const updateOff = (patch: Partial<typeof off>) => onChange({ off_peak: { ...off, ...patch } });
  return <div className="space-y-4 border-t pt-4">
    {value.kind === 'chat' && <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1"><HelpLabel title={t('ai.thinking')} description={<p>{t('ai.thinking_help')}</p>} /><ThinkingSelect label={t('ai.thinking')} value={value.thinking ?? 'auto'} onChange={(thinking) => onChange({ thinking })} /></div>
      <div className="space-y-1"><HelpLabel title={t('ai.model_max_tokens')} description={<p>{t('ai.model_max_tokens_help')}</p>} /><Input aria-label={t('ai.model_max_tokens')} type="number" min={0} max={393216} value={value.max_tokens ?? 0} onChange={(e) => onChange({ max_tokens: Math.max(0, Math.min(393216, Number(e.target.value) || 0)) })} /></div>
      <div className="space-y-1"><HelpLabel title={t('ai.thinking_protocol')} description={<p>{t('ai.thinking_protocol_help')}</p>} /><Select value={value.thinking_protocol ?? 'auto'} onValueChange={(v) => onChange({ thinking_protocol: v as ModelTuning['thinking_protocol'] })}><SelectTrigger aria-label={t('ai.thinking_protocol')}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">{t('ai.thinking_auto')}</SelectItem><SelectItem value="deepseek">DeepSeek · thinking</SelectItem><SelectItem value="reasoning_effort">OpenAI · reasoning_effort</SelectItem></SelectContent></Select></div>
      <div className="space-y-1"><Label>{t('ai.reasoning_effort')}</Label><Select value={value.reasoning_effort ?? 'high'} onValueChange={(v) => onChange({ reasoning_effort: v as ModelTuning['reasoning_effort'] })}><SelectTrigger aria-label={t('ai.reasoning_effort')}><SelectValue /></SelectTrigger><SelectContent>{(['low', 'medium', 'high'] as const).map((v) => <SelectItem key={v} value={v}>{t(`ai.effort_${v}`)}</SelectItem>)}</SelectContent></Select></div>
    </div>}
    <div className="space-y-1"><HelpLabel title={t('ai.price_cached_in')} description={<p>{t('ai.price_cached_help')}</p>} /><Input aria-label={t('ai.price_cached_in')} type="number" min={0} step="any" value={value.price_cached_in ?? value.price_in} onChange={(e) => onChange({ price_cached_in: Math.max(0, Number(e.target.value) || 0) })} /></div>
    <div className="flex items-center justify-between gap-3"><HelpLabel title={t('ai.off_peak')} description={<p>{t('ai.off_peak_help')}</p>} /><Switch aria-label={t('ai.off_peak')} checked={off.enabled} onCheckedChange={(enabled) => updateOff({ enabled })} /></div>
    {off.enabled && <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
      {(['start', 'end'] as const).map((key) => <div className="space-y-1" key={key}><Label htmlFor={`ai-off-${key}`}>{t(`ai.off_peak_${key}`)}</Label><TimePicker label={t(`ai.off_peak_${key}`)} value={off[key]} onValueChange={(v) => updateOff({ [key]: v })} /></div>)}
      <div className="space-y-1 sm:col-span-2"><HelpLabel title={t('ai.pricing_timezone')} description={<p>{t('ai.pricing_timezone_help')}</p>} /><Select value={String(off.utc_offset_minutes)} onValueChange={(v) => updateOff({ utc_offset_minutes: Number(v) })}><SelectTrigger aria-label={t('ai.pricing_timezone')}><SelectValue /></SelectTrigger><SelectContent>{[...new Set([...Array.from({ length: 105 }, (_, i) => i * 15 - 720), off.utc_offset_minutes])].sort((a, b) => a - b).map((m) => <SelectItem key={m} value={String(m)}>{`UTC${m < 0 ? '-' : '+'}${String(Math.floor(Math.abs(m) / 60)).padStart(2, '0')}:${String(Math.abs(m) % 60).padStart(2, '0')}`}</SelectItem>)}</SelectContent></Select></div>
      {(['price_in', 'price_cached_in', ...(value.kind === 'chat' ? ['price_out'] as const : [])] as const).map((key) => <div className="space-y-1" key={key}><Label htmlFor={`ai-off-${key}`}>{t(`ai.off_${key}`)}</Label><Input id={`ai-off-${key}`} type="number" min={0} step="any" value={off[key]} onChange={(e) => updateOff({ [key]: Math.max(0, Number(e.target.value) || 0) })} /></div>)}
      <p className="text-xs text-muted-foreground sm:col-span-2">{t('ai.pricing_estimate')}</p>
    </div>}
  </div>;
}
