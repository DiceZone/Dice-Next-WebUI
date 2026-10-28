import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

// Help remains in the Tab order, but must not be the modal's automatic first
// focus target: focus also opens its tooltip, covering the form on arrival.
function focusPastHelp(event: Event) {
  const container = event.currentTarget;
  if (!(container instanceof HTMLElement) || !container.querySelector('[data-dialog-autofocus-skip]')) return;

  const candidates = Array.from(container.querySelectorAll<HTMLElement>('*')).filter((element) => {
    if (element.tabIndex < 0 || element.tagName === 'A'
      || element.matches(':disabled, input[type="hidden"]')
      || element.closest('[hidden], [inert]') || element.getClientRects().length === 0) return false;
    const visibility = element.ownerDocument.defaultView?.getComputedStyle(element).visibility;
    return visibility !== 'hidden' && visibility !== 'collapse';
  });
  // Leave dialogs without a leading help trigger to Radix's normal behavior.
  if (!candidates[0]?.hasAttribute('data-dialog-autofocus-skip')) return;

  event.preventDefault();
  for (const candidate of candidates) {
    if (candidate.hasAttribute('data-dialog-autofocus-skip')) continue;
    candidate.focus({ preventScroll: true });
    if (candidate.ownerDocument.activeElement === candidate) return;
  }
  container.focus({ preventScroll: true });
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { layout?: 'content' | 'editor' }
>(({ className, children, onOpenAutoFocus, layout = 'content', ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'v2-dialog fixed left-[50%] top-[50%] z-50 grid max-h-[calc(100dvh-2rem)] min-w-0 w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto rounded-lg border bg-background p-6 shadow-lg [scrollbar-gutter:stable] transition-none',
        // Dynamic previews, validation and filtered lists must not repeatedly
        // resize/recenter the window while typing. Only editors opt in; small
        // prompts and confirmation dialogs still size naturally to content.
        layout === 'editor' && 'flex h-[min(90dvh,56rem)] flex-col overflow-hidden [scrollbar-gutter:auto]',
        className
      )}
      {...props}
      onOpenAutoFocus={(event) => {
        onOpenAutoFocus?.(event);
        if (!event.defaultPrevented) focusPastHelp(event);
      }}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex min-w-0 shrink-0 flex-col gap-2 pr-5 text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

// Keep scrollbars inside the working area, with a reserved gutter so their
// appearance cannot change line wrapping and trigger a second layout change.
const DialogBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]', className)} {...props} />
  )
);
DialogBody.displayName = 'DialogBody';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex min-w-0 shrink-0 flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
