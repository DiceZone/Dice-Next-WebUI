import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeatureHelp } from '@/components/ui/feature-help';

interface PageHeaderProps {
  /** Page title (h1). */
  title: React.ReactNode;
  /** Optional one-line description shown under the title. */
  description?: React.ReactNode;
  /** Detailed, read-only help; short page descriptions remain visible. */
  help?: React.ReactNode;
  /** Required when help accompanies a non-text title. */
  helpTitle?: string;
  /** Optional leading icon rendered before the title. */
  icon?: LucideIcon;
  /** Optional action area (buttons) shown on the right. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Standard page header used at the top of every page.
 *
 * Centralises the title typography (`text-2xl font-bold tracking-tight`) and
 * the header row layout so pages stop hand-rolling — and drifting on — their
 * own heading markup. Narrow-screen actions stack below the heading; desktop
 * pages keep their established title and toolbar layout.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, help, helpTitle, icon: Icon, actions, className }) => (
  <div className={cn('v2-page-header flex flex-wrap items-start justify-between gap-x-6 gap-y-4', className)}>
    <div className="min-w-0 flex-1 basis-64">
      <div className="flex items-center gap-2">
        <h1 className="flex min-w-0 items-center gap-3 text-2xl font-semibold leading-snug tracking-tight sm:text-[28px]">
          {Icon && <Icon aria-hidden="true" className="hidden h-6 w-6 shrink-0 text-muted-foreground sm:block" />}
          {title}
        </h1>
        {help && (helpTitle || typeof title === 'string') && <FeatureHelp
          title={helpTitle || (title as string)} description={<div className="whitespace-pre-line">{help}</div>} />}
      </div>
      {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="min-w-0 w-full md:w-auto md:pt-1">{actions}</div>}
  </div>
);

export default PageHeader;
