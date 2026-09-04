import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Eye, MousePointerClick, Sparkles, TriangleAlert, X } from 'lucide-react';
import { TourDemoPage } from '@/components/onboarding/tour-demo-page';
import { Button } from '@/components/ui/button';
import { completeTour, hasCompletedTour } from '@/lib/onboarding';
import { getPageTourProfile, type PageTourAction } from '@/lib/page-tours';
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

const TARGET_PADDING = 8;

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function animateTargetIntoView(
  container: HTMLElement,
  target: HTMLElement,
  onFrame: () => void,
  onComplete: () => void,
): () => void {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const start = container.scrollTop;
  const destination = clamp(
    start + targetRect.top - containerRect.top - 28,
    0,
    container.scrollHeight - container.clientHeight,
  );
  const distance = destination - start;

  if (Math.abs(distance) < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    container.scrollTop = destination;
    onFrame();
    onComplete();
    return () => undefined;
  }

  const duration = clamp(Math.abs(distance) * 0.55, 360, 680);
  const startedAt = window.performance.now();
  let animationFrame = 0;
  let cancelled = false;

  const animate = (now: number) => {
    if (cancelled) return;
    const progress = Math.min((now - startedAt) / duration, 1);
    container.scrollTop = start + distance * easeInOutCubic(progress);
    onFrame();
    if (progress < 1) {
      animationFrame = window.requestAnimationFrame(animate);
    } else {
      onComplete();
    }
  };

  animationFrame = window.requestAnimationFrame(animate);
  return () => {
    cancelled = true;
    window.cancelAnimationFrame(animationFrame);
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
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const targetRef = React.useRef<HTMLElement | null>(null);
  const demoScrollRef = React.useRef<HTMLElement>(null);
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
    let retryTimer = 0;
    let cancelAnimation: () => void = () => undefined;
    let cancelled = false;
    let attempts = 0;

    const update = () => setSpotlight(visibleRect(targetRef.current));
    const locate = () => {
      if (cancelled) return;
      const target = document.querySelector<HTMLElement>(`[data-tour-demo-step="${stepIndex}"]`);
      const container = demoScrollRef.current;
      if ((!target || !container) && attempts < 12) {
        attempts += 1;
        retryTimer = window.setTimeout(locate, 50);
        return;
      }
      if (!target || !container) return;

      targetRef.current = target;
      setSpotlight(visibleRect(target));
      cancelAnimation = animateTargetIntoView(container, target, update, update);
    };

    locate();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      cancelAnimation();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, profile, stepIndex]);

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
  const translatedDetail = currentStep.descriptionKey ? t(currentStep.descriptionKey) : '';
  const instruction = translatedDetail && translatedDetail !== currentStep.descriptionKey
    ? translatedDetail
    : t(`onboarding.actions.${currentStep.action}`, { target: stepTitle });
  const isLastStep = stepIndex === stepCount - 1;

  return createPortal(
    <>
      <TourDemoPage currentPath={currentPath} profile={profile} currentStep={stepIndex} scrollRef={demoScrollRef} />

      {spotlight && (
        <div
          className="pointer-events-none fixed z-[101] rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background transition-[top,left,width,height] duration-100"
          style={{ ...spotlight, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.58)' }}
          aria-hidden="true"
        />
      )}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('onboarding.dialog_label', { page: pageTitle })}
        tabIndex={-1}
        className="fixed bottom-4 left-1/2 z-[102] flex max-h-[calc(100vh-2rem)] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border bg-background shadow-2xl outline-none md:bottom-auto md:left-auto md:right-4 md:top-1/2 md:translate-x-0 md:-translate-y-1/2"
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
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{instruction}</p>

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
    </>,
    document.body,
  );
};

export default PageTour;
