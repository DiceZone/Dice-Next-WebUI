import * as React from 'react';
import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Centered spinner for the loading phase of a page or section. */
export const LoadingState: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('flex justify-center py-16', className)}>
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

interface EmptyStateProps {
  /** Optional icon shown in a muted circle above the text. */
  icon?: LucideIcon;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Optional call-to-action (e.g. an "add" button). */
  action?: React.ReactNode;
  className?: string;
}

/** Standard "nothing here yet" placeholder. */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, className }) => (
  <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
    {Icon && (
      <div className="mb-4 rounded-full bg-muted p-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
    )}
    {title && <h3 className="text-lg font-semibold mb-1">{title}</h3>}
    {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
    {action}
  </div>
);
