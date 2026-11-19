import { useTranslation } from 'react-i18next';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formulaIllustration, formulaPresets } from '@/lib/formula-presets';
import { MathFormula } from './math-formula';
import type { Variable } from './variable-picker';

export function FormulaPicker({ open, onOpenChange, options, onSelect }: {
  open: boolean; onOpenChange: (open: boolean) => void; options: Variable[];
  onSelect: (formula: string, fallback: string) => void;
}) {
  const { t } = useTranslation();
  const available = new Set(options.map(v => v.token));
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent layout="editor" className="max-w-2xl" aria-describedby="formula-picker-hint">
      <DialogHeader><DialogTitle>{t('visual_editor.formula.title')}</DialogTitle></DialogHeader>
      <p id="formula-picker-hint" className="text-sm text-muted-foreground">{t('visual_editor.formula.hint')}</p>
      <DialogBody><div className="grid min-w-0 gap-3 sm:grid-cols-2">{formulaPresets.map(preset => {
        const missing = preset.variables.filter(name => !available.has('{' + name + '}'));
        return <button key={preset.id} type="button" disabled={missing.length > 0}
          aria-label={t('visual_editor.formula.' + preset.id)}
          className="min-w-0 space-y-3 rounded-lg border bg-background p-4 text-left hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => { onSelect(preset.formula, preset.fallback); onOpenChange(false); }}>
          <span className="block text-sm font-medium">{t('visual_editor.formula.' + preset.id)}</span>
          <span className="block overflow-x-auto py-2"><MathFormula text={formulaIllustration(preset.formula)} /></span>
          {missing.length > 0 && <span className="block text-xs text-muted-foreground">{t('visual_editor.formula.missing', { names: missing.join(', ') })}</span>}
        </button>;
      })}</div></DialogBody>
    </DialogContent>
  </Dialog>;
}
