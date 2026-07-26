import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** Page title (h1). */
  title: React.ReactNode;
  /** Optional one-line description shown under the title. */
  description?: React.ReactNode;
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
 * own heading markup. Styling is unchanged from the established baseline pages.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, icon: Icon, actions, className }) => (
  <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
    <div>
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        {Icon && <Icon className="h-5 w-5" />}
        {title}
      </h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    {actions}
  </div>
);

export default PageHeader;
