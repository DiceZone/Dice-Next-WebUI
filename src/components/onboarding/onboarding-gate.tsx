import React from 'react';
import { useTranslation } from 'react-i18next';
import { GraduationCap, Rocket } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { TourMode } from '@/lib/onboarding';

interface OnboardingGateProps {
  /** Null until the question has been answered on this browser. */
  mode: TourMode | null;
  onChoose: (mode: TourMode) => void;
}

// Asked once, before any tour opens. Without it the first page a returning
// operator lands on interrupts them, and there is no obvious way to say
// "I know this already" other than closing tours one page at a time.
export const OnboardingGate: React.FC<OnboardingGateProps> = ({ mode, onChoose }) => {
  const { t } = useTranslation();
  if (mode !== null) return null;

  return (
    <Dialog open>
      <DialogContent
        // No dismissal: leaving the question unanswered would keep every tour
        // suppressed and re-open this on the next navigation.
        className="max-w-md [&>button]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('onboarding.welcome_title')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm leading-6 text-muted-foreground">{t('onboarding.welcome_body')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onChoose('new')}
            className="rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-accent"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Rocket className="h-4 w-4 text-primary" />{t('onboarding.welcome_new')}
            </span>
            <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">
              {t('onboarding.welcome_new_desc')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChoose('veteran')}
            className="rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-accent"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />{t('onboarding.welcome_veteran')}
            </span>
            <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">
              {t('onboarding.welcome_veteran_desc')}
            </span>
          </button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{t('onboarding.welcome_footnote')}</p>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingGate;
