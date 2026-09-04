import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Bot,
  Check,
  ChevronDown,
  CircleGauge,
  Database,
  FileText,
  MoreHorizontal,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { PageTourAction, PageTourProfile, PageTourStep } from '@/lib/page-tours';
import { canonicalTourPath } from '@/lib/onboarding';
import { cn } from '@/lib/utils';

type DemoLayout = 'dashboard' | 'conversation' | 'collection' | 'settings' | 'document';

interface TourDemoPageProps {
  currentPath: string;
  profile: PageTourProfile;
  currentStep: number;
  scrollRef: React.RefObject<HTMLElement>;
}

const LAYOUTS: Readonly<Record<string, DemoLayout>> = {
  '/': 'dashboard',
  '/statistics': 'dashboard',
  '/playground': 'conversation',
  '/adapters': 'collection',
  '/dice-rules': 'settings',
  '/replies': 'collection',
  '/decks': 'collection',
  '/groups': 'collection',
  '/players': 'collection',
  '/schedules': 'settings',
  '/roadmap': 'document',
  '/commands': 'collection',
  '/help': 'document',
  '/modules': 'collection',
  '/rules': 'collection',
  '/permissions': 'settings',
  '/settings': 'settings',
  '/ai': 'settings',
  '/ai/chat': 'settings',
  '/ai/npc': 'settings',
  '/ai/polish': 'settings',
  '/ai/translate': 'settings',
  '/notice-settings': 'settings',
  '/webui-settings': 'settings',
  '/about': 'document',
  '/backup': 'settings',
  '/logs': 'collection',
};

function DemoToggle({ enabled = true }: { enabled?: boolean }) {
  return (
    <span className={cn('relative h-6 w-11 rounded-full transition-colors', enabled ? 'bg-primary' : 'bg-muted')}>
      <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm', enabled ? 'right-1' : 'left-1')} />
    </span>
  );
}

function DemoControl({ action, title }: { action: PageTourAction; title: string }) {
  const { t } = useTranslation();

  if (action === 'overview') {
    return (
      <div className="grid grid-cols-3 gap-3">
        {['demo_running', 'demo_connected', 'demo_ready'].map((key, index) => (
          <div key={key} className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">{t(`onboarding.${key}`)}</p>
            <p className="mt-1 text-lg font-semibold">{index === 0 ? '24 h' : index === 1 ? '3' : '100%'}</p>
          </div>
        ))}
      </div>
    );
  }

  if (action === 'inspect') {
    return (
      <div className="flex items-center justify-between rounded-lg border bg-background px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="mt-1 font-medium">{t('onboarding.demo_status_normal')}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <Check className="h-3.5 w-3.5" />{t('onboarding.demo_active')}
        </span>
      </div>
    );
  }

  if (action === 'prepare') {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {['demo_group_chat', 'demo_platform', 'demo_language'].map((key) => (
          <div key={key} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2.5 text-sm">
            <span>{t(`onboarding.${key}`)}</span><ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        ))}
      </div>
    );
  }

  if (action === 'filter') {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2.5 text-sm text-muted-foreground">
        <Search className="h-4 w-4" />
        <span>{t('onboarding.demo_search', { target: title })}</span>
      </div>
    );
  }

  if (action === 'create') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">+ {title}</span>
        <span className="text-xs text-muted-foreground">{t('onboarding.demo_create_hint')}</span>
      </div>
    );
  }

  if (action === 'configure') {
    return (
      <div className="space-y-3 rounded-lg border bg-background p-3">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">{title}</span><DemoToggle />
        </div>
        <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
          <span>{t('onboarding.demo_scope')}</span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">{t('onboarding.demo_global')}<ChevronDown className="h-4 w-4" /></span>
        </div>
      </div>
    );
  }

  if (action === 'manage') {
    return (
      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span>{t('onboarding.demo_name')}</span><span>{t('onboarding.demo_status')}</span><span>{t('onboarding.demo_actions')}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-3 text-sm">
          <span className="font-medium">{t('onboarding.demo_record')}</span>
          <span className="text-emerald-600">{t('onboarding.demo_active')}</span>
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (action === 'switch') {
    return (
      <div className="flex gap-1 border-b">
        <span className="border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary">{title}</span>
        <span className="px-4 py-2 text-sm text-muted-foreground">{t('onboarding.demo_other_tab')}</span>
      </div>
    );
  }

  if (action === 'test') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-lg border bg-background p-2">
          <span className="flex-1 px-2 font-mono text-sm">.r 1d100</span>
          <span className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">{title}</span>
        </div>
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">{t('onboarding.demo_result')}: <strong>1d100 = 42</strong></p>
      </div>
    );
  }

  if (action === 'save') {
    return (
      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-amber-600 dark:text-amber-300">{t('onboarding.demo_unsaved')}</span>
        <span className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{title}</span>
      </div>
    );
  }

  if (action === 'immediate') {
    return (
      <div className="flex items-center justify-between rounded-lg border bg-background px-4 py-3">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('onboarding.demo_immediate_hint')}</p>
        </div>
        <DemoToggle />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <span className="text-sm text-amber-800 dark:text-amber-200">{t('onboarding.demo_danger_hint')}</span>
      <span className="shrink-0 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive">{title}</span>
    </div>
  );
}

function DemoSection({ step, index, active }: { step: PageTourStep; index: number; active: boolean }) {
  const { t } = useTranslation();
  const title = t(step.titleKey);
  const detail = step.descriptionKey ? t(step.descriptionKey) : '';

  return (
    <section
      data-tour-demo-step={index}
      className={cn(
        'min-h-40 rounded-xl border bg-card p-4 shadow-sm transition-colors sm:p-5',
        active && 'border-primary/50 bg-primary/[0.025]',
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-primary">{t(`onboarding.action_labels.${step.action}`)}</p>
          <h2 className="mt-1 text-base font-semibold">{title}</h2>
        </div>
        <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">{index + 1}</span>
      </div>
      <DemoControl action={step.action} title={title} />
      {detail && detail !== step.descriptionKey && (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{detail}</p>
      )}
    </section>
  );
}

function layoutClass(layout: DemoLayout): string {
  if (layout === 'dashboard') return 'grid gap-5 lg:grid-cols-2 [&>section:first-child]:lg:col-span-2';
  if (layout === 'collection') return 'grid gap-5 xl:grid-cols-2 [&>section:first-child]:xl:col-span-2';
  if (layout === 'document') return 'grid gap-5 lg:grid-cols-[1.35fr_1fr] [&>section:first-child]:lg:col-span-2';
  return 'space-y-5';
}

export const TourDemoPage: React.FC<TourDemoPageProps> = ({ currentPath, profile, currentStep, scrollRef }) => {
  const { t } = useTranslation();
  const pageTitle = t(profile.titleKey);
  const layout = LAYOUTS[canonicalTourPath(currentPath)] ?? 'settings';

  return (
    <div className="fixed inset-0 z-[100] bg-background" aria-hidden="true" data-tour-demo-page>
      <div className="flex h-full">
        <aside className="hidden w-56 shrink-0 flex-col border-r bg-muted/20 md:flex">
          <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></span>
            DiceNext
          </div>
          <div className="space-y-2 p-3">
            {[CircleGauge, Activity, Bot, Database, FileText, Settings2].map((Icon, index) => (
              <div key={index} className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm', index === 2 ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground')}>
                <Icon className="h-4 w-4" />
                <span className="h-2.5 rounded-full bg-current opacity-35" style={{ width: `${58 + (index % 3) * 14}px` }} />
              </div>
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 sm:px-6">
            <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-primary" />{t('onboarding.demo_mode')}</div>
            <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary">{t('onboarding.demo_badge')}</span>
          </header>

          <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scroll-smooth md:pr-[452px]">
            <div className="mx-auto max-w-5xl p-4 pb-[45vh] sm:p-6 sm:pb-[45vh]">
              <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
                <div>
                  <p className="text-xs font-medium text-primary">{t('onboarding.demo_scenario')}</p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight">{pageTitle}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{t('onboarding.demo_scenario_body', { page: pageTitle })}</p>
                </div>
                <span className="mt-3 inline-flex shrink-0 items-center gap-2 rounded-lg bg-background px-3 py-2 text-xs shadow-sm sm:mt-0">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />{t('onboarding.demo_instance')}
                </span>
              </div>

              <div className={layoutClass(layout)}>
                {profile.steps.map((step, index) => (
                  <DemoSection key={`${step.titleKey}-${index}`} step={step} index={index} active={index === currentStep} />
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default TourDemoPage;
