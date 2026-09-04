import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Eye, MousePointerClick, Sparkles, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { completeTour, hasCompletedTour } from '@/lib/onboarding';
import { getPageTourProfile, type PageTourAction, type PageTourStep } from '@/lib/page-tours';
import { cn } from '@/lib/utils';

interface PageTourProps {
  currentPath: string;
  replayToken: number;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface DialogSize {
  width: number;
  height: number;
}

const TARGET_PADDING = 8;
const VIEWPORT_MARGIN = 16;
const PANEL_GAP = 16;

function visibleRect(element: HTMLElement | null): SpotlightRect | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  if (rect.width <= 0 || rect.height <= 0 || style.display === 'none' || style.visibility === 'hidden') return null;

  const left = Math.max(TARGET_PADDING, rect.left - TARGET_PADDING);
  const top = Math.max(TARGET_PADDING, rect.top - TARGET_PADDING);
  const right = Math.min(window.innerWidth - TARGET_PADDING, rect.right + TARGET_PADDING);
  const bottom = Math.min(window.innerHeight - TARGET_PADDING, rect.bottom + TARGET_PADDING);
  if (right <= left || bottom <= top) return null;
  return { left, top, width: right - left, height: bottom - top };
}

function findTarget(step: PageTourStep): HTMLElement | null {
  const selectors = typeof step.target === 'string' ? [step.target] : step.target;
  for (const selector of selectors) {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') return element;
    }
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function positionDialog(target: SpotlightRect, dialog: DialogSize): React.CSSProperties {
  const width = Math.min(dialog.width || 420, window.innerWidth - VIEWPORT_MARGIN * 2);
  const height = Math.min(dialog.height || 360, window.innerHeight - VIEWPORT_MARGIN * 2);
  const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
  const maxTop = window.innerHeight - height - VIEWPORT_MARGIN;

  if (target.left + target.width + PANEL_GAP + width <= window.innerWidth - VIEWPORT_MARGIN) {
    return { left: target.left + target.width + PANEL_GAP, top: clamp(target.top, VIEWPORT_MARGIN, maxTop) };
  }
  if (target.left - PANEL_GAP - width >= VIEWPORT_MARGIN) {
    return { left: target.left - PANEL_GAP - width, top: clamp(target.top, VIEWPORT_MARGIN, maxTop) };
  }
  if (target.top + target.height + PANEL_GAP + height <= window.innerHeight - VIEWPORT_MARGIN) {
    return { left: clamp(target.left, VIEWPORT_MARGIN, maxLeft), top: target.top + target.height + PANEL_GAP };
  }
  if (target.top - PANEL_GAP - height >= VIEWPORT_MARGIN) {
    return { left: clamp(target.left, VIEWPORT_MARGIN, maxLeft), top: target.top - PANEL_GAP - height };
  }

  // A wide target may leave no horizontal space and not quite enough vertical
  // space for the panel at its natural height. Keep the target unobscured and
  // make the panel body scroll inside the larger of the two vertical gaps.
  const belowTop = target.top + target.height + PANEL_GAP;
  const belowSpace = window.innerHeight - VIEWPORT_MARGIN - belowTop;
  const aboveSpace = target.top - PANEL_GAP - VIEWPORT_MARGIN;
  if (Math.max(belowSpace, aboveSpace) >= 160) {
    if (belowSpace >= aboveSpace) {
      return {
        left: clamp(target.left, VIEWPORT_MARGIN, maxLeft),
        top: belowTop,
        maxHeight: belowSpace,
      };
    }
    return {
      left: clamp(target.left, VIEWPORT_MARGIN, maxLeft),
      top: target.top - PANEL_GAP - Math.min(height, aboveSpace),
      maxHeight: aboveSpace,
    };
  }
  return {
    left: target.left + target.width / 2 < window.innerWidth / 2 ? maxLeft : VIEWPORT_MARGIN,
    top: clamp(target.top, VIEWPORT_MARGIN, maxTop),
  };
}

function ActionIcon({ action }: { action: PageTourAction }) {
  if (action === 'danger') return <TriangleAlert className="h-4 w-4" />;
  if (action === 'inspect' || action === 'overview') return <Eye className="h-4 w-4" />;
  return <MousePointerClick className="h-4 w-4" />;
}

export const PageTour: React.FC<PageTourProps> = ({ currentPath, replayToken }) => {
  const { t } = useTranslation();
  const profile = getPageTourProfile(currentPath);
  const [open, setOpen] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [spotlight, setSpotlight] = React.useState<SpotlightRect | null>(null);
  const [dialogSize, setDialogSize] = React.useState<DialogSize>({ width: 420, height: 360 });
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const targetRef = React.useRef<HTMLElement | null>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const lastReplayTokenRef = React.useRef(replayToken);

  const finish = React.useCallback(() => {
    if (profile) completeTour(currentPath, profile.version);
    setOpen(false);
    targetRef.current = null;
    window.requestAnimationFrame(() => previousFocusRef.current?.focus());
  }, [currentPath, profile]);

  React.useEffect(() => {
    setOpen(false);
    setStepIndex(0);
    setSpotlight(null);
    targetRef.current = null;
    if (!profile) return;

    const manualReplay = replayToken !== lastReplayTokenRef.current;
    lastReplayTokenRef.current = replayToken;
    if (!manualReplay && hasCompletedTour(currentPath, profile.version)) return;

    const timer = window.setTimeout(() => {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    }, manualReplay ? 0 : 450);
    return () => window.clearTimeout(timer);
  }, [currentPath, profile, replayToken]);

  React.useLayoutEffect(() => {
    if (!open || !profile) return;
    let attempts = 0;
    let retry = 0;
    let settle = 0;
    let cancelled = false;
    const currentStep = profile.steps[stepIndex];

    const update = () => setSpotlight(visibleRect(targetRef.current));
    const locate = () => {
      if (cancelled) return;
      const target = findTarget(currentStep);
      if (!target && attempts < 12) {
        attempts += 1;
        retry = window.setTimeout(locate, 120);
        return;
      }

      targetRef.current = target
        ?? document.querySelector<HTMLElement>('[data-tour="page-content"] h1')
        ?? document.querySelector<HTMLElement>('[data-tour="page-content"]');
      // Align the real control near the top of its scroll container. Wide cards
      // then leave enough room for the guide below instead of being covered by it.
      targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      update();
      settle = window.setTimeout(update, 280);
    };

    setSpotlight(null);
    locate();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelled = true;
      window.clearTimeout(retry);
      window.clearTimeout(settle);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, profile, stepIndex]);

  React.useLayoutEffect(() => {
    if (!open || !dialogRef.current) return;
    const rect = dialogRef.current.getBoundingClientRect();
    setDialogSize((current) => (
      Math.abs(current.width - rect.width) < 1 && Math.abs(current.height - rect.height) < 1
        ? current
        : { width: rect.width, height: rect.height }
    ));
  }, [open, stepIndex, spotlight]);

  React.useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [finish, open]);

  if (!open || !profile) return null;

  const currentStep = profile.steps[stepIndex];
  const stepCount = profile.steps.length;
  const pageTitle = t(profile.titleKey);
  const stepTitle = t(currentStep.titleKey);
  const detail = currentStep.descriptionKey ? t(currentStep.descriptionKey) : '';
  const isLastStep = stepIndex === stepCount - 1;
  const desktopPositioned = Boolean(spotlight && window.innerWidth >= 768);
  const panelStyle = desktopPositioned ? positionDialog(spotlight!, dialogSize) : {};

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="presentation">
      <div className={cn('fixed inset-0', !spotlight && 'bg-black/60')} onMouseDown={finish} aria-hidden="true">
        {spotlight && (
          <div
            className="pointer-events-none fixed rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background transition-[top,left,width,height] duration-200"
            style={{ ...spotlight, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.62)' }}
          />
        )}
      </div>

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('onboarding.dialog_label', { page: pageTitle })}
        tabIndex={-1}
        style={panelStyle}
        className={cn(
          'fixed z-[101] flex max-h-[calc(100vh-2rem)] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl outline-none',
          spotlight && !desktopPositioned && 'bottom-4 left-1/2 -translate-x-1/2',
          !spotlight && 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{pageTitle}</p>
              <p className="text-xs text-muted-foreground">{t('onboarding.step_count', { current: stepIndex + 1, total: stepCount })}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={finish} title={t('onboarding.close')}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-y-auto p-4">
          <div className={cn(
            'mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            currentStep.action === 'danger'
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'bg-primary/10 text-primary',
          )}>
            <ActionIcon action={currentStep.action} />
            {t(`onboarding.action_labels.${currentStep.action}`)}
          </div>
          <h2 className="text-lg font-semibold leading-snug">{stepTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-foreground">
            {t(`onboarding.actions.${currentStep.action}`, { target: stepTitle })}
          </p>
          {detail && detail !== currentStep.descriptionKey && (
            <p className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">{detail}</p>
          )}
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{t('onboarding.guide_note')}</p>

          {isLastStep && (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm leading-6">
              {t('onboarding.replay_hint')}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t px-4 py-3">
          {!isLastStep && (
            <Button variant="ghost" size="sm" className="mr-auto" onClick={finish}>{t('onboarding.skip')}</Button>
          )}
          {stepIndex > 0 && (
            <Button variant="outline" size="sm" onClick={() => setStepIndex((current) => current - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" />{t('onboarding.previous')}
            </Button>
          )}
          {!isLastStep ? (
            <Button size="sm" onClick={() => setStepIndex((current) => current + 1)}>
              {t('onboarding.next')}<ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={finish}>{t('onboarding.finish')}</Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PageTour;
