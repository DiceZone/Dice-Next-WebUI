import { useState, useRef, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ConfirmOpts {
  title: string; description?: string;
  confirmText?: string; cancelText?: string; destructive?: boolean;
}
interface PromptOpts {
  title: string; description?: string; defaultValue?: string; placeholder?: string;
  confirmText?: string; cancelText?: string;
}
interface State extends ConfirmOpts { kind: 'confirm' | 'prompt'; placeholder?: string; }

/**
 * Styled confirm()/prompt() replacements for the native browser dialogs.
 * Both return a Promise; `confirm` → boolean, `prompt` → string | null.
 *
 *   const dlg = useDialogs();
 *   if (await dlg.confirm({ title: '...' })) { ... }
 *   const v = await dlg.prompt({ title: '...', defaultValue: 'x' });
 *
 * Render `dlg.node` once somewhere in the component tree.
 */
export function useDialogs(t?: (k: string) => string) {
  const [state, setState] = useState<State | null>(null);
  const [value, setValue] = useState('');
  const resolver = useRef<((v: boolean | string | null) => void) | null>(null);

  const okText = t ? t('common.ok') : 'OK';
  const cancelText = t ? t('common.cancel') : 'Cancel';

  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((res) => {
    resolver.current = res as (v: boolean | string | null) => void;
    setState({ kind: 'confirm', ...opts });
  }), []);

  const prompt = useCallback((opts: PromptOpts) => new Promise<string | null>((res) => {
    resolver.current = res as (v: boolean | string | null) => void;
    setValue(opts.defaultValue ?? '');
    setState({ kind: 'prompt', title: opts.title, description: opts.description,
      placeholder: opts.placeholder, confirmText: opts.confirmText, cancelText: opts.cancelText });
  }), []);

  const finish = (result: boolean | string | null) => {
    const r = resolver.current; resolver.current = null;
    setState(null);
    r?.(result);
  };

  const node = (
    <Dialog open={!!state} onOpenChange={(o) => { if (!o) finish(state?.kind === 'confirm' ? false : null); }}>
      {state && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{state.title}</DialogTitle>
            {state.description && (
              <DialogDescription className="whitespace-pre-wrap">{state.description}</DialogDescription>
            )}
          </DialogHeader>
          {state.kind === 'prompt' && (
            <Input autoFocus value={value} placeholder={state.placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') finish(value); }} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => finish(state.kind === 'confirm' ? false : null)}>
              {state.cancelText ?? cancelText}
            </Button>
            <Button variant={state.destructive ? 'destructive' : 'default'}
              onClick={() => finish(state.kind === 'confirm' ? true : value)}>
              {state.confirmText ?? okText}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );

  return { confirm, prompt, node };
}
