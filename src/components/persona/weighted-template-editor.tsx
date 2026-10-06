import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FeatureHelp } from '@/components/ui/feature-help';
import { MAX_TEMPLATE_WEIGHT, probabilities, splitLegacySample, validWeights, type TemplateVariant } from '@/lib/weighted-templates';

interface Props {
  items: TemplateVariant[];
  onChange: (items: TemplateVariant[]) => void;
  activeIndex?: number;
  onActiveIndex?: (index: number) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

export function WeightedTemplateEditor({ items, onChange, activeIndex, onActiveIndex, textareaRef }: Props) {
  const { t } = useTranslation();
  const [localIndex, setLocalIndex] = useState(0);
  const index = Math.min(activeIndex ?? localIndex, items.length - 1);
  const select = (next: number) => { setLocalIndex(next); onActiveIndex?.(next); };
  const update = (patch: Partial<TemplateVariant>) => onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  const chances = probabilities(items);
  const legacy = items.length === 1 ? splitLegacySample(items[0].text) : null;
  return <div className="space-y-3">
    <div className="flex items-center gap-1.5 text-sm font-medium">
      {t('weighted.replies')}
      <FeatureHelp title={t('weighted.replies')} description={<p>{t('weighted.reply_hint')}</p>} />
    </div>
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('weighted.replies')}>
      {items.map((item, i) => <Button key={i} type="button" size="sm" variant={i === index ? 'default' : 'outline'}
        aria-pressed={i === index} onClick={() => select(i)}>
        {t('weighted.reply_number', { n: i + 1 })} · {chances[i].toFixed(2)}%{item.weight === 0 ? ` · ${t('weighted.disabled')}` : ''}
      </Button>)}
      <Button type="button" size="sm" variant="outline" disabled={items.length >= 256}
        onClick={() => { onChange([...items, { text: '', weight: 1 }]); select(items.length); }}>
        <Plus className="mr-1 h-3.5 w-3.5" />{t('weighted.add_reply')}
      </Button>
    </div>
    <div className="rounded-lg border bg-muted/10 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs">
          {t('weighted.weight')}
          <Input type="number" inputMode="numeric" min={0} max={MAX_TEMPLATE_WEIGHT} step={1}
            aria-label={t('weighted.reply_weight', { n: index + 1 })} className="h-8 w-24"
            value={Number.isFinite(items[index].weight) ? items[index].weight : ''}
            onChange={event => update({ weight: event.target.value === '' ? 0 : Number(event.target.value) })} />
          <span className="tabular-nums text-muted-foreground">{chances[index].toFixed(2)}%</span>
        </label>
        <Button type="button" size="sm" variant="ghost" disabled={items.length <= 1}
          onClick={() => { onChange(items.filter((_, i) => i !== index)); select(Math.max(0, index - 1)); }}>
          <Trash2 className="mr-1 h-3.5 w-3.5" />{t('weighted.remove_reply')}
        </Button>
      </div>
      <Textarea ref={textareaRef} rows={7} className="min-h-40 font-mono text-sm" spellCheck={false}
        aria-label={t('weighted.reply_number', { n: index + 1 })} value={items[index].text}
        onChange={event => update({ text: event.target.value })} />
    </div>
    {!validWeights(items) && <p role="alert" className="text-xs text-destructive">{t('weighted.invalid_weights')}</p>}
    {legacy && legacy.length > 1 && legacy.length <= 256 && <Button type="button" size="sm" variant="outline"
      onClick={() => { onChange(legacy.map(text => ({ text, weight: 1 }))); select(0); }}>{t('weighted.convert_sample')}</Button>}
  </div>;
}
