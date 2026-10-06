import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useCloseOnWideScreen } from '@/hooks/use-close-on-wide-screen';

export interface SecondaryAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  iconClassName?: string;
  onAction: () => unknown;
  disabled?: boolean;
  destructive?: boolean;
}

/** Keep primary controls outside this component. Secondary actions use the
 * same handlers and disabled state in desktop buttons and the mobile menu. */
export function ResponsiveActions({ actions, label, size = 'default', desktop }: {
  actions: readonly SecondaryAction[]; label?: string; size?: 'default' | 'sm'; desktop?: ReactNode;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  useCloseOnWideScreen(() => setMenuOpen(false));
  if (!actions.length) return null;
  const run = (action: SecondaryAction) => { if (!action.disabled) void action.onAction(); };
  return <>
    <div className="hidden flex-wrap items-center gap-2 md:flex" data-secondary-actions="desktop">
      {desktop ?? actions.map((action) => <Button key={action.id} type="button" variant="outline" size={size}
        disabled={action.disabled} onClick={() => run(action)}
        className={action.destructive ? 'text-destructive hover:text-destructive' : undefined}>
        {action.icon && <action.icon className={cn('mr-2 h-4 w-4', action.iconClassName)} />}{action.label}
      </Button>)}
    </div>
    <div className="md:hidden" data-secondary-actions="menu">
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size={size} className="w-full" disabled={actions.every((action) => action.disabled)}
            aria-label={label || t('common.more_actions')}>
            {label || t('common.more')}<ChevronDown className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[70dvh] max-w-[calc(100vw-2rem)] overflow-y-auto">
          {actions.map((action) => <DropdownMenuItem key={action.id} disabled={action.disabled}
            onSelect={() => run(action)} className={action.destructive ? 'text-destructive focus:text-destructive' : undefined}>
            {action.icon && <action.icon className={cn('mr-2 h-4 w-4 shrink-0', action.iconClassName)} />}
            <span className="break-words">{action.label}</span>
          </DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </>;
}
