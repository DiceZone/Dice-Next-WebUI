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
  <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 shrink-0" />}
          {title}
        </h1>
        {help && (helpTitle || typeof title === 'string') && <FeatureHelp
          title={helpTitle || (title as string)} description={<div className="whitespace-pre-line">{help}</div>} />}
      </div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="min-w-0 w-full md:w-auto">{actions}</div>}
  </div>
);

export default PageHeader;
