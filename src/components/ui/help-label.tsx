import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { FeatureHelp } from '@/components/ui/feature-help';
import { cn } from '@/lib/utils';

/** Keep the clickable help beside the label, never inside its click target. */
export function HelpLabel({ title, description, htmlFor, className, labelClassName }: {
  title: string; description: ReactNode; htmlFor?: string;
  className?: string; labelClassName?: string;
}) {
  return <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
    <Label htmlFor={htmlFor} className={cn('min-w-0', labelClassName)}>{title}</Label>
    <FeatureHelp title={title} description={description} />
  </div>;
}
