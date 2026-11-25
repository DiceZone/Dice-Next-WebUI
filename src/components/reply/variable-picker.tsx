import { ImageResourcePicker } from '@/components/image-resource-picker';
import { useRef, useState, type ComponentProps, type RefObject, type ReactNode } from 'react';
import { Braces } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FeatureHelp } from '@/components/ui/feature-help';
import { Input } from '@/components/ui/input';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { describedVariables, type Variable } from '@/lib/variable-description';

export type { Variable } from '@/lib/variable-description';
export type TextField = HTMLInputElement | HTMLTextAreaElement;
export const globalNames = ['self', 'nick', 'name', 'qqnick', 'card', 'pcname', 'qqnickw', 'cardw', 'pcnamew', 'user', 'group', 'date', 'time', 'FormFeed'];
export const contextNames = ['uid', 'gid', 'selfId', 'char.hp', 'char.mp', 'char.san', 'user.trust', 'user.favor', 'list_all_deck', 'list_extern_deck', 'list_extern_order', 'list_reply_deck', 'list_dice_sister'];
export const tokens = (names: Iterable<string>): Variable[] => Array.from(names, name => ({ token: '{' + name + '}' }));
export const templateMacros = ['sample:A|B', 'ran:1~100', 'print:uid', 'print:gid', 'print:master', 'print:self', 'len:game.pls', 'len:game.gms', 'at:', 'at:self',
  'var:x=1', 'var:x?1', 'case:user.trust?0=A&else=B', 'grade:user.trust?1=A&else=B', 'expired:x', 'wait:100', 'text:文案名'];
export const templateVariables = tokens([...globalNames, ...contextNames, 'strSelfName', 'strSelfCall', 'strSelfNick', ...templateMacros]);
export const replyVariables = tokens([...globalNames, ...contextNames, 'strSelfName', 'strSelfCall', 'strSelfNick', ...templateMacros,
  'a|b|c', 'roll:1d100', 'draw:牌堆名', 'deck:牌堆名', 'help:词条', 'api:URL']);

export const finalTextVariables = tokens([...globalNames.filter(n => n !== 'FormFeed'), 'strSelfCall', 'strSelfName', 'strSelfNick']);

export function captureVariables(conditions: { type: string; content?: string }[]) {
  const count = Math.max(0, ...conditions.map(c => {
    if (c.type === 'prefix') return 2;
    if (c.type !== 'regex' || !c.content) return 0;
    // The empty alternative succeeds immediately. The match still has a slot for each capture.
    try { return new RegExp('(?:)|(?:' + c.content + ')').exec('')?.length ?? 0; } catch { return 0; }
  }));
  return tokens(Array.from({ length: count }, (_, i) => '$' + i));
}

type Props = {
  options: Variable[];
  field: RefObject<TextField>;
  onChange: (value: string) => void;
};

export function VariablePicker({ options, field, onChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selection = useRef([0, 0]);
  const caret = useRef<number | null>(null);
  const filtered = describedVariables(open ? options : [], t)
    .filter(([token, label]) => (token + ' ' + label).toLowerCase().includes(query.trim().toLowerCase()));
  if (!options.length) return null;
  return <Dialog open={open} onOpenChange={next => {
    if (next) {
      const el = field.current;
      if (!el || el.disabled || el.readOnly) return;
      selection.current = [el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length];
      caret.current = null;
      setQuery('');
    }
    setOpen(next);
  }}>
    <DialogTrigger asChild><Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
      <Braces className="size-3.5" />{t('visual_editor.insert_variable')}
    </Button></DialogTrigger>
    <DialogContent layout="editor" className="h-[min(65dvh,30rem)] max-w-lg" aria-describedby={undefined}
      onCloseAutoFocus={event => {
        const el = field.current;
        if (el && caret.current !== null) {
          event.preventDefault();
          el.focus({ preventScroll: true });
          el.setSelectionRange(caret.current, caret.current);
        }
      }}>
      <DialogHeader><div className="flex items-center gap-2"><DialogTitle>{t('visual_editor.insert_variable')}</DialogTitle>
        <FeatureHelp title={t('visual_editor.insert_variable')} description={<p>{t('visual_editor.variables.hint')}</p>} />
      </div></DialogHeader>
      <Input type="search" value={query} onChange={e => setQuery(e.target.value)} aria-label={t('visual_editor.search_variable')} placeholder={t('visual_editor.search_variable')} />
      <DialogBody><div className="grid gap-1.5 sm:grid-cols-2">{filtered.map(([token, label]) =>
        <button type="button" key={token} className="min-w-0 rounded-md border px-3 py-2 text-left hover:bg-accent" onClick={() => {
          const el = field.current;
          if (!el) return;
          const [start, end] = selection.current;
          onChange(el.value.slice(0, start) + token + el.value.slice(end));
          caret.current = start + token.length;
          setOpen(false);
        }}><code className="block break-all text-xs text-primary">{token}</code>
          <span className="mt-1 block break-words text-xs leading-relaxed text-muted-foreground">{label}</span></button>)}</div>
        {!filtered.length && <p className="text-sm text-muted-foreground">{t('persona.ed.no_match')}</p>}
      </DialogBody>
    </DialogContent>
  </Dialog>;
}

type InsertFieldProps = { options: Variable[]; onValueChange: (value: string) => void; value: string };

export function VariableInput({ options, onValueChange, value, ...props }: InsertFieldProps & ComponentProps<typeof Input>) {
  const ref = useRef<HTMLInputElement>(null);
  return <div className="min-w-0 space-y-1.5">
    <VariablePicker options={options} field={ref} onChange={onValueChange} />
    <Input {...props} ref={ref} value={value} onChange={e => onValueChange(e.target.value)} /></div>;
}

type TextTools = { imageDirectory?: string; extraTools?: ReactNode; fieldRef?: RefObject<HTMLTextAreaElement>; imageDisabled?: boolean };
export function VariableTextarea({ options, onValueChange, value, imageDirectory, extraTools, fieldRef, imageDisabled, ...props }: InsertFieldProps & ComponentProps<typeof Textarea> & TextTools) {
  const { t } = useTranslation();
  const local = useRef<HTMLTextAreaElement>(null);
  const field = fieldRef ?? local;
  const insertImage = (code: string) => {
    const el = field.current;
    if (!el || el.disabled || el.readOnly) return;
    const start = el.selectionStart;
    onValueChange(el.value.slice(0, start) + code + el.value.slice(el.selectionEnd));
    requestAnimationFrame(() => { el.focus({ preventScroll: true }); el.setSelectionRange(start + code.length, start + code.length); });
  };
  return <div className="min-w-0 space-y-1.5">
    <div className="flex flex-wrap items-center gap-1.5">
      {imageDirectory && <ImageResourcePicker directory={imageDirectory} disabled={imageDisabled || props.disabled || props.readOnly} className="h-8 text-xs"
        onSelect={image => insertImage(image.code)}>{t('commands.insert_image')}</ImageResourcePicker>}
      <VariablePicker options={options} field={field} onChange={onValueChange} />
      {extraTools}
    </div>
    <Textarea {...props} ref={field} value={value} onChange={e => onValueChange(e.target.value)} />
  </div>;
}
