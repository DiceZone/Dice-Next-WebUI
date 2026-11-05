import { Reorder, useDragControls } from 'motion/react';
import { GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { HelpLabel } from '@/components/ui/help-label';

type Engine = 'dicenext' | 'onedice' | 'dicescript';
const engines: Engine[] = ['dicenext', 'onedice', 'dicescript'];
type Props = {
  order: Engine[]; onReorder: (order: Engine[]) => void;
  available: (id: Engine) => boolean; toggle: (id: Engine, enabled: boolean) => void;
  disabled: boolean;
};

function EngineRow({ id, order, onReorder, available, toggle, disabled }: Props & { id: Engine }) {
  const { t } = useTranslation();
  const controls = useDragControls();
  const index = order.indexOf(id), enabled = index >= 0;
  const move = (delta: number) => {
    if (disabled || index + delta < 0 || index + delta >= order.length) return;
    const next = [...order];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onReorder(next);
  };
  const name = t(`settings.expression_engine_${id}`);
  const content = <>
    {enabled && <Button type="button" size="icon" variant="ghost" disabled={disabled} className="h-8 w-8 shrink-0 touch-none cursor-grab active:cursor-grabbing"
      aria-label={`${t('settings.expression_drag')}: ${name}`}
      onPointerDown={event => { if (!disabled) controls.start(event); }}
      onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); move(event.key === 'ArrowUp' ? -1 : 1); } }}>
      <GripVertical className="h-4 w-4" />
    </Button>}
    {enabled && <span className="w-3 shrink-0 text-sm tabular-nums text-muted-foreground" aria-hidden>{index + 1}</span>}
    <Switch aria-label={name} checked={enabled} disabled={disabled || !available(id)} onCheckedChange={checked => toggle(id, checked)} />
    <div className="min-w-0 flex-1"><HelpLabel title={name} description={<p>{t(`settings.expression_engine_${id}_desc`)}</p>} labelClassName="text-sm font-medium" />
      {!available(id) && <Badge variant="secondary">{t('settings.expression_unavailable')}</Badge>}</div>
    {enabled && <div className="flex shrink-0">
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={disabled || index === 0} aria-label={t('settings.expression_move_up')} onClick={() => move(-1)}><ArrowUp className="h-4 w-4" /></Button>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={disabled || index === order.length - 1} aria-label={t('settings.expression_move_down')} onClick={() => move(1)}><ArrowDown className="h-4 w-4" /></Button>
    </div>}
  </>;
  const className = 'relative flex items-center gap-2 rounded-lg border bg-card px-2 py-2.5 sm:gap-3 sm:px-3';
  return enabled ? <Reorder.Item value={id} dragListener={false} dragControls={controls} dragMomentum={false} className={className} data-engine-id={id} whileDrag={{ boxShadow: '0 4px 16px #0002' }}>{content}</Reorder.Item>
    : <div className={className} data-engine-disabled={id}>{content}</div>;
}

export function ExpressionEngineOrder(props: Props) {
  return <div className="space-y-2" data-testid="expression-engine-order">
    <Reorder.Group axis="y" values={props.order} onReorder={order => { if (!props.disabled) props.onReorder(order); }} className="space-y-2">
      {props.order.map(id => <EngineRow key={id} id={id} {...props} />)}
    </Reorder.Group>
    {engines.filter(id => !props.order.includes(id)).map(id => <EngineRow key={id} id={id} {...props} />)}
  </div>;
}
