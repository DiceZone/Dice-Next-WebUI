import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bold, Code, Heading2, Italic, Link2, List, ListOrdered, Minus, Quote, Strikethrough, type LucideIcon } from 'lucide-react';
import { applyMarkdown, shortcutAction, type MarkdownAction } from '@/lib/markdown-edit';
import { cn } from '@/lib/utils';

const ICONS: Record<MarkdownAction, LucideIcon> = {
  bold: Bold, italic: Italic, strike: Strikethrough, code: Code, heading: Heading2,
  quote: Quote, bullet: List, number: ListOrdered, divider: Minus, link: Link2,
};
const GROUPS: MarkdownAction[][] = [['bold', 'italic', 'strike', 'code'], ['heading', 'quote', 'bullet', 'number', 'divider'], ['link']];
const SHORTCUTS: Partial<Record<MarkdownAction, string>> = { bold: 'B', italic: 'I' };

interface Props {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
  /** Plain-text replies show Markdown markers literally; the buttons wait for conversion. */
  disabled?: boolean;
}

export function useMarkdownEditing({ textareaRef, value, onChange }: Omit<Props, 'disabled'>) {
  const { t } = useTranslation();
  const apply = (action: MarkdownAction) => {
    const area = textareaRef.current;
    const start = area?.selectionStart ?? value.length, end = area?.selectionEnd ?? value.length;
    const edit = applyMarkdown(value, start, end, action, t('visual_editor.markdown.placeholder'));
    if (edit.text === value && edit.start === start && edit.end === end) return;
    onChange(edit.text);
    requestAnimationFrame(() => {
      const current = textareaRef.current;
      if (!current) return;
      current.focus();
      current.setSelectionRange(edit.start, edit.end);
    });
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const action = shortcutAction(event);
    if (!action) return;
    event.preventDefault();
    apply(action);
  };
  return { apply, onKeyDown };
}

export function MarkdownToolbar({ textareaRef, value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const { apply } = useMarkdownEditing({ textareaRef, value, onChange });
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return <div role="toolbar" aria-label={t('visual_editor.markdown.label')} data-testid="markdown-toolbar"
    className="flex flex-wrap items-center gap-0.5 rounded-md border bg-muted/30 p-1">
    {GROUPS.map((group, index) => <React.Fragment key={index}>
      {index > 0 && <span aria-hidden className="mx-1 h-5 w-px bg-border" />}
      {group.map(action => {
        const Icon = ICONS[action];
        const label = t(`visual_editor.markdown.${action}`);
        const shortcut = SHORTCUTS[action] ? ` (${isMac ? '⌘' : 'Ctrl+'}${SHORTCUTS[action]})` : '';
        return <button key={action} type="button" disabled={disabled} aria-label={label} title={label + shortcut}
          // Keep the textarea selection: a mouse down on the button would blur it first.
          onMouseDown={event => event.preventDefault()} onClick={() => apply(action)}
          className={cn('inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors',
            'hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:pointer-events-none disabled:opacity-40')}>
          <Icon className="h-4 w-4" />
        </button>;
      })}
    </React.Fragment>)}
  </div>;
}
