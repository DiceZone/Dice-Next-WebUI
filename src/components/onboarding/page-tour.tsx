import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Eye, MousePointerClick, Sparkles, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { completeTour, hasCompletedTour, type TourMode } from '@/lib/onboarding';
import { getPageTourProfile, type PageTourAction, type PageTourStep } from '@/lib/page-tours';
import { cn } from '@/lib/utils';

interface PageTourProps {
  currentPath: string;
  replayToken: number;
  tourMode: TourMode | null;
  onCloseAllTours: () => void;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

// The spotlight sits just outside the element so its own border stays visible.
const HOLE_PADDING = 8;
const CARD_GAP = 14;
const CARD_MAX_WIDTH = 380;
const VIEWPORT_MARGIN = 16;

// A step may list several selectors when the same control lives in different
// places depending on the view; the first one actually on screen wins.
function resolveTarget(step: PageTourStep): HTMLElement | null {
  const selectors = typeof step.target === 'string' ? [step.target] : step.target;
  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    return element;
  }
  return null;
}

function boxOf(element: HTMLElement): Box {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top - HOLE_PADDING,
    left: rect.left - HOLE_PADDING,
    width: rect.width + HOLE_PADDING * 2,
    height: rect.height + HOLE_PADDING * 2,
  };
}

function sameBox(a: Box | null, b: Box | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5
    && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

function overlaps(a: Box, b: Box): boolean {
  return !(a.left + a.width <= b.left || b.left + b.width <= a.left
    || a.top + a.height <= b.top || b.top + b.height <= a.top);
}

// Place the card beside the spotlight without covering it. The measured card
// height matters: a fixed guess makes the "does it fit below" test wrong for
// long steps, and the card lands on the very control it is describing.
function placeCard(box: Box | null, size: { width: number; height: number }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const M = VIEWPORT_MARGIN;
  const { width: cw, height: ch } = size;

  if (!box) {
    return { top: Math.max(M, vh / 2 - ch / 2), left: Math.max(M, vw / 2 - cw / 2) };
  }

  const clampX = (x: number) => Math.min(Math.max(M, x), Math.max(M, vw - cw - M));
  const clampY = (y: number) => Math.min(Math.max(M, y), Math.max(M, vh - ch - M));
  const midX = clampX(box.left + box.width / 2 - cw / 2);
  const midY = clampY(box.top + box.height / 2 - ch / 2);

  const candidates = [
    { top: box.top + box.height + CARD_GAP, left: midX },
    { top: box.top - CARD_GAP - ch, left: midX },
    { top: midY, left: box.left + box.width + CARD_GAP },
    { top: midY, left: box.left - CARD_GAP - cw },
  ];
  for (const spot of candidates) {
    const fits = spot.top >= M && spot.left >= M
      && spot.top + ch <= vh - M && spot.left + cw <= vw - M;
    if (!fits) continue;
    if (overlaps({ ...spot, width: cw, height: ch }, box)) continue;
    return spot;
  }

  // Nothing fits beside it: the target is a full-width card. Hug whichever edge
  // has more room so most of the spotlight stays visible.
  const above = box.top - M;
  const below = vh - (box.top + box.height) - M;
  return above > below
    ? { top: M, left: midX }
    : { top: Math.max(M, vh - ch - M), left: midX };
}

function ActionIcon({ action }: { action: PageTourAction }) {
  if (action === 'danger') return <TriangleAlert className="h-4 w-4" />;
  if (action === 'inspect' || action === 'overview') return <Eye className="h-4 w-4" />;
  return <MousePointerClick className="h-4 w-4" />;
}

export const PageTour: React.FC<PageTourProps> = ({
  currentPath,
  replayToken,
  tourMode,
  onCloseAllTours,
}) => {
  const { t } = useTranslation();
  const profile = getPageTourProfile(currentPath);
  const [open, setOpen] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [box, setBox] = React.useState<Box | null>(null);
  // A near full-screen overlay is easy to hit by accident; ask before throwing
  // the tour away, or the reader assumes they broke it.
  const [confirmExit, setConfirmExit] = React.useState(false);
  const [cardSize, setCardSize] = React.useState({ width: CARD_MAX_WIDTH, height: 220 });
  const cardRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const lastReplayTokenRef = React.useRef(replayToken);

  const step = open && profile ? profile.steps[stepIndex] : undefined;

  const close = React.useCallback(() => {
    if (profile) completeTour(currentPath, profile.version);
    setOpen(false);
    setConfirmExit(false);
    setBox(null);
    window.requestAnimationFrame(() => previousFocusRef.current?.focus());
  }, [currentPath, profile]);

  const closeEverything = React.useCallback(() => {
    onCloseAllTours();
    close();
  }, [close, onCloseAllTours]);

  React.useEffect(() => {
    setOpen(false);
    setStepIndex(0);
    setBox(null);
    setConfirmExit(false);
    if (!profile) return;

    const manualReplay = replayToken !== lastReplayTokenRef.current;
    lastReplayTokenRef.current = replayToken;
    // Replaying is an explicit request, so it ignores both the veteran choice
    // and the completion mark. Everything else waits for a new user who has
    // not seen this page yet.
    if (!manualReplay) {
      if (tourMode !== 'new') return;
      if (hasCompletedTour(currentPath, profile.version)) return;
    }

    const timer = window.setTimeout(() => {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    }, manualReplay ? 0 : 450);
    return () => window.clearTimeout(timer);
  }, [currentPath, profile, replayToken, tourMode]);

  // Measure every frame rather than on a timer: the target may be mid-scroll or
  // mid-expand, and a polled spotlight visibly chases it.
  React.useEffect(() => {
    if (!open || !step) return;
    let alive = true;

    resolveTarget(step)?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });

    let frame = 0;
    const tick = () => {
      if (!alive) return;
      const card = cardRef.current;
      if (card) {
        const rect = card.getBoundingClientRect();
        setCardSize((previous) => (
          Math.abs(previous.height - rect.height) > 1 || Math.abs(previous.width - rect.width) > 1
            ? { width: rect.width, height: rect.height }
            : previous
        ));
      }
      const target = resolveTarget(step);
      const next = target ? boxOf(target) : null;
      setBox((previous) => (sameBox(previous, next) ? previous : next));
      frame = window.requestAnimationFrame(tick);
    };
    tick();

    return () => {
      alive = false;
      window.cancelAnimationFrame(frame);
    };
  }, [open, step]);

  const stepCount = profile?.steps.length ?? 0;
  const isLastStep = stepIndex === stepCount - 1;

  const goNext = React.useCallback(() => {
    setStepIndex((current) => {
      if (current + 1 >= stepCount) {
        close();
        return current;
      }
      return current + 1;
    });
  }, [close, stepCount]);

  const goBack = React.useCallback(() => setStepIndex((current) => Math.max(0, current - 1)), []);

  React.useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => cardRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        // Escape is as easy to fat-finger as the overlay, so it asks too.
        setConfirmExit(true);
        return;
      }
      if (confirmExit) return;
      if (event.key === 'ArrowRight') goNext();
      if (event.key === 'ArrowLeft') goBack();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [confirmExit, goBack, goNext, open]);

  if (!open || !profile || !step) return null;

  const pageTitle = t(profile.titleKey);
  const stepTitle = t(step.titleKey);
  const translatedDetail = step.descriptionKey ? t(step.descriptionKey) : '';
  const instruction = translatedDetail && translatedDetail !== step.descriptionKey
    ? translatedDetail
    : t('onboarding.actions.' + step.action, { target: stepTitle });
  const cardWidth = Math.min(CARD_MAX_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
  const card = placeCard(box, { width: cardWidth, height: cardSize.height });

  return createPortal(
    <div
      className="fixed inset-0 z-[100]"
      // Radix sets pointer-events:none on body while a dialog is open, and this
      // layer is portalled into body. Without this the tour would take no
      // clicks at all when it opens right after one.
      style={{ pointerEvents: 'auto' }}
    >
      <div className="fixed inset-0 z-0" onClick={() => setConfirmExit(true)} aria-hidden="true" />

      {box ? (
        <div
          className="pointer-events-none fixed z-10 rounded-lg ring-2 ring-primary transition-[top,left,width,height] duration-100"
          style={{ ...box, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)' }}
          aria-hidden="true"
        />
      ) : (
        <div className="pointer-events-none fixed inset-0 z-10 bg-black/55" aria-hidden="true" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('onboarding.dialog_label', { page: pageTitle })}
        tabIndex={-1}
        className="fixed z-20 flex flex-col overflow-hidden rounded-xl border bg-background shadow-2xl outline-none"
        style={{ top: card.top, left: card.left, width: cardWidth }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{pageTitle}</p>
              <p className="text-xs text-muted-foreground">
                {t('onboarding.step_count', { current: stepIndex + 1, total: stepCount })}
              </p>
            </div>
          </div>
          {/* Labelled, so pressing it is already an explicit exit and needs no prompt. */}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={close} title={t('onboarding.close')}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[45vh] overflow-y-auto p-4">
          <div className={cn(
            'mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            step.action === 'danger'
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'bg-primary/10 text-primary',
          )}>
            <ActionIcon action={step.action} />
            {t('onboarding.action_labels.' + step.action)}
          </div>
          <h2 className="text-lg font-semibold leading-snug">{stepTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{instruction}</p>
          {!box && (
            <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
              {t('onboarding.target_missing')}
            </p>
          )}
          {isLastStep && (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm leading-6">
              {t('onboarding.replay_hint')}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t px-4 py-3">
          <div className="mr-auto flex items-center gap-1.5" aria-hidden="true">
            {profile.steps.map((_, index) => (
              <span
                key={index}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  index === stepIndex ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30',
                )}
              />
            ))}
          </div>
          {stepIndex > 0 && (
            <Button variant="outline" size="sm" onClick={goBack}>
              <ChevronLeft className="mr-1 h-4 w-4" />{t('onboarding.previous')}
            </Button>
          )}
          <Button size="sm" onClick={goNext}>
            {isLastStep ? t('onboarding.finish') : (
              <>{t('onboarding.next')}<ChevronRight className="ml-1 h-4 w-4" /></>
            )}
          </Button>
        </div>
      </div>

      {confirmExit && (
        // Drawn inside the tour layer rather than with the shared Dialog: that
        // one is z-50 and would end up underneath this overlay.
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border bg-background p-4 shadow-2xl">
            <p className="text-sm font-semibold">{t('onboarding.exit_title')}</p>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{t('onboarding.exit_body')}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button size="sm" variant="outline" onClick={() => setConfirmExit(false)}>
                {t('onboarding.exit_continue')}
              </Button>
              <Button size="sm" variant="outline" onClick={close}>
                {t('onboarding.exit_page')}
              </Button>
              <Button size="sm" variant="destructive" onClick={closeEverything}>
                {t('onboarding.exit_all')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
};

export default PageTour;
