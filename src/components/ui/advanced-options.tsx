import React from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Responsive defaults, not responsive coercion: an explicit user choice wins
 * until the next editing session. Hidden controls stay mounted with their data. */
export function AdvancedOptions({ title, description, sessionOpen = true, revealToken = 0, children, className }: {
  title: string; description?: string; sessionOpen?: boolean; revealToken?: number;
  children: React.ReactNode; className?: string;
}) {
  const id = React.useId();
  const [wide, setWide] = React.useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [choice, setChoice] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  React.useEffect(() => { if (sessionOpen) setChoice(null); }, [sessionOpen]);
  React.useEffect(() => { if (revealToken) setChoice(true); }, [revealToken]);
  const expanded = choice ?? wide;
  return <section className={cn('self-start overflow-hidden rounded-xl border bg-muted/20', className)}>
    <button type="button" id={`${id}-trigger`} aria-expanded={expanded} aria-controls={id}
      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      onClick={() => setChoice(!expanded)}>
      <SlidersHorizontal className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{title}</span>{description && <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span>}</span>
      <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none', expanded && 'rotate-180')} />
    </button>
    <div id={id} role="region" aria-labelledby={`${id}-trigger`} hidden={!expanded} className="border-t p-4">
      {children}
    </div>
  </section>;
}
