import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HelpLabel } from '@/components/ui/help-label';
import { componentFieldValid, componentSource, presentationComponents, replaceComponent, type PresentationKind } from '@/lib/presentation-template';

export function PresentationTemplateEditor({ text, onChange, allowMath = true }: {
  text: string; onChange: (value: string) => void; allowMath?: boolean;
}) {
  const { t } = useTranslation();
  const components = presentationComponents(text);
  const add = (kind: PresentationKind) => {
    const fields = kind === 'action' ? [t('visual_editor.example_action'), '.r']
      : kind === 'bar' ? ['HP', '{hp}', '{hpmax}']
      : ['\\textcolor{#E5484D}{ {{nick}} }', '{nick}'];
    onChange(text + (text && !text.endsWith('\n') ? '\n' : '') + componentSource(kind, fields));
  };
  return <div className="space-y-3" data-testid="presentation-template-editor">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <HelpLabel title={t(allowMath ? 'visual_editor.components' : 'visual_editor.components_basic')} description={<><p>{t('visual_editor.hint')}</p>{allowMath && <p>{t('visual_editor.math_hint')}</p>}</>} labelClassName="text-sm font-medium" />
      <div className="flex flex-wrap gap-1.5">{(['action', 'bar', ...(allowMath ? ['math'] : [])] as PresentationKind[]).map(kind =>
        <Button key={kind} type="button" size="sm" variant="outline" onClick={() => add(kind)}>
          <Plus className="mr-1 h-3.5 w-3.5" />{t(`visual_editor.add_${kind}`)}
        </Button>)}</div>
    </div>
    {components.map((component, index) => <div key={index} className="min-w-0 space-y-2 rounded-lg border bg-background p-3" data-component-kind={component.kind}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{t(`visual_editor.kind_${component.kind}`)} {index + 1}</span>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={t('visual_editor.remove', { n: index + 1 })}
          onClick={() => onChange(replaceComponent(text, component, null))}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
      <div className={`grid min-w-0 gap-2 ${component.kind === 'bar' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {component.fields.map((value, field) => <label key={field} className="min-w-0 space-y-1 text-xs text-muted-foreground">
          <span>{t(`visual_editor.${component.kind}_${field}`)}</span>
          <Input className="w-full min-w-0 font-mono text-xs" value={value} aria-label={`${t(`visual_editor.${component.kind}_${field}`)} ${index + 1}`}
            onChange={event => {
              if (!componentFieldValid(component.kind, field, event.target.value)) return;
              onChange(replaceComponent(text, component, component.fields.map((old, i) => i === field ? event.target.value : old)));
            }} />
        </label>)}
      </div>
      {component.fields.some(value => !value.trim()) && <p role="alert" className="text-xs text-destructive">{t('visual_editor.required')}</p>}
      {component.kind === 'math' && <p className="text-xs text-muted-foreground">{t('visual_editor.math_hint')}</p>}
    </div>)}
  </div>;
}
