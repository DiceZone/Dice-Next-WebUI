import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft, ChevronRight, Circle, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { completeTour, hasCompletedTour } from '@/lib/onboarding';
import { getPageTourProfile } from '@/lib/page-tours';
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

const STEP_COUNT = 5;
const TARGET_PADDING = 8;

function visibleRect(element: Element | null): SpotlightRect | null {
  if (!(element instanceof HTMLElement)) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const left = Math.max(TARGET_PADDING, rect.left - TARGET_PADDING);
  const top = Math.max(TARGET_PADDING, rect.top - TARGET_PADDING);
  return {
    left,
    top,
    width: Math.min(window.innerWidth - left - TARGET_PADDING, rect.width + TARGET_PADDING * 2),
    height: Math.min(window.innerHeight - top - TARGET_PADDING, rect.height + TARGET_PADDING * 2),
  };
}

function targetForStep(step: number): Element | null {
  if (step === 0) {
    return document.querySelector('[data-tour="page-content"] h1');
  }
  if (step === STEP_COUNT - 1) return document.querySelector('[data-tour="replay"]');
  return null;
}

export const PageTour: React.FC<PageTourProps> = ({ currentPath, replayToken }) => {
  const { t } = useTranslation();
  const profile = getPageTourProfile(currentPath);
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [spotlight, setSpotlight] = React.useState<SpotlightRect | null>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const lastReplayTokenRef = React.useRef(replayToken);

  const finish = React.useCallback(() => {
    if (profile) completeTour(currentPath, profile.version);
    setOpen(false);
    window.requestAnimationFrame(() => previousFocusRef.current?.focus());
  }, [currentPath, profile]);

  React.useEffect(() => {
    setOpen(false);
    setStep(0);
    setSpotlight(null);
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
    if (!open) return;
    const update = () => setSpotlight(visibleRect(targetForStep(step)));
    update();
    const retry = window.setTimeout(update, 180);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearTimeout(retry);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, step]);

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

  const pageTitle = t(profile.titleKey);
  const demoIndex = step >= 1 && step <= 3 ? step - 1 : -1;
  const demoLabels = profile.demo.map((item) => t(item.labelKey));
  const titles = [
    t('onboarding.intro_title', { page: pageTitle }),
    t('onboarding.scope_title'),
    t('onboarding.configure_title'),
    t('onboarding.preview_title'),
    t('onboarding.done_title'),
  ];
  const descriptions = [
    t(profile.descriptionKey),
    t('onboarding.scope_body', { label: demoLabels[0], value: profile.demo[0].value }),
    t('onboarding.configure_body', { label: demoLabels[1], value: profile.demo[1].value }),
    t('onboarding.preview_body', { label: demoLabels[2], value: profile.demo[2].value }),
    t('onboarding.done_body'),
  ];

  const targetedSpotlight = step === 0 || step === STEP_COUNT - 1 ? spotlight : null;
  const positionedNearTarget = Boolean(targetedSpotlight);
  const panelStyle: React.CSSProperties = positionedNearTarget && window.innerWidth >= 768
    ? {
        left: Math.min(Math.max(16, targetedSpotlight!.left), window.innerWidth - 436),
        top: targetedSpotlight!.top + targetedSpotlight!.height + 16,
      }
    : {};

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="presentation">
      <div
        className={cn('fixed inset-0', !targetedSpotlight && 'bg-black/60')}
        onMouseDown={finish}
        aria-hidden="true"
      >
        {targetedSpotlight && (
          <div
            className="pointer-events-none fixed rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background transition-[top,left,width,height] duration-200"
            style={{
              ...targetedSpotlight,
              boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.62)',
            }}
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
          positionedNearTarget && 'bottom-4 left-1/2 -translate-x-1/2 md:bottom-auto md:translate-x-0',
          !positionedNearTarget && 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
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
              <p className="text-xs text-muted-foreground">{t('onboarding.step_count', { current: step + 1, total: STEP_COUNT })}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={finish} title={t('onboarding.close')}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-y-auto p-4">
          <h2 className="text-lg font-semibold leading-snug">{titles[step]}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{descriptions[step]}</p>

          {demoIndex >= 0 && (
            <div className="mt-4 rounded-lg border bg-muted/30 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-primary">{t('onboarding.simulation')}</span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                  {t('onboarding.not_saved')}
                </span>
              </div>
              <div className="space-y-2">
                {profile.demo.map((item, index) => {
                  const active = index === demoIndex;
                  const completed = index < demoIndex;
                  return (
                    <div
                      key={demoLabels[index]}
                      className={cn(
                        'flex items-center gap-3 rounded-md border bg-background px-3 py-2 transition-colors',
                        active && 'border-primary bg-primary/5 ring-1 ring-primary/25',
                        index > demoIndex && 'opacity-45',
                      )}
                    >
                      <span className={cn('text-muted-foreground', (active || completed) && 'text-primary')}>
                        {completed ? <Check className="h-4 w-4" /> : <Circle className={cn('h-4 w-4', active && 'fill-primary/20')} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-muted-foreground">{demoLabels[index]}</p>
                        <p className="truncate font-mono text-sm font-medium">{item.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{t('onboarding.simulation_note')}</p>
            </div>
          )}

          {step === STEP_COUNT - 1 && (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm leading-6">
              {t('onboarding.replay_hint')}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t px-4 py-3">
          {step < STEP_COUNT - 1 && (
            <Button variant="ghost" size="sm" className="mr-auto" onClick={finish}>{t('onboarding.skip')}</Button>
          )}
          {step > 0 && (
            <Button variant="outline" size="sm" onClick={() => setStep((current) => current - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" />{t('onboarding.previous')}
            </Button>
          )}
          {step < STEP_COUNT - 1 ? (
            <Button size="sm" onClick={() => setStep((current) => current + 1)}>
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
