import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react';
import { Portal as TooltipPortal } from '@radix-ui/react-tooltip';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FeatureHelpProps {
  title: string;
  description: ReactNode;
  ariaLabel?: string;
}

// Read-only help can stay interactive in CSS-muted groups. Keep the trigger
// outside HTML-disabled fieldsets, which disable all descendant buttons.
export function FeatureHelp({ title, description, ariaLabel }: FeatureHelpProps) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoringFocus = useRef(false);

  const onDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (open) setTooltipOpen(false);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
      <TooltipProvider delayDuration={150}>
        <Tooltip open={tooltipOpen && !dialogOpen} onOpenChange={setTooltipOpen}>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <button type="button" aria-disabled={false} ref={triggerRef} data-dialog-autofocus-skip=""
                onClick={(event) => event.stopPropagation()}
                onFocus={(event) => {
                  // Restoring keyboard focus after reading help is not a new
                  // request to open the hover preview. Intentional Tab focus is.
                  if (restoringFocus.current) event.preventDefault();
                }}
                aria-label={ariaLabel ?? t('common.feature_help', { title })}
                className="pointer-events-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <HelpCircle className="h-4 w-4" aria-hidden="true" />
              </button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent side="top" align="start"
              className="max-h-[min(20rem,calc(100dvh-2rem))] max-w-[min(24rem,calc(100vw-2rem))] space-y-2 overflow-y-auto break-words p-3 text-xs leading-relaxed">
              {description}
            </TooltipContent>
          </TooltipPortal>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="max-h-[85vh] overflow-y-auto" onCloseAutoFocus={(event) => {
        event.preventDefault();
        setTooltipOpen(false);
        restoringFocus.current = true;
        try {
          triggerRef.current?.focus({ preventScroll: true });
        } finally {
          restoringFocus.current = false;
        }
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6 text-left leading-snug">
            <HelpCircle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" focusable="false" />
            <span className="min-w-0 break-words">{title}</span>
          </DialogTitle>
        </DialogHeader>
        <DialogDescription asChild>
          <div className="space-y-3 break-words leading-relaxed">{description}</div>
        </DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('common.close')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
