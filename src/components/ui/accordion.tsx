import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface AccordionItemContextValue {
  value: string;
  expanded: boolean;
  onToggle: (value: string) => void;
}

const AccordionContext = React.createContext<{
  expandedValues: Set<string>;
  type: 'single' | 'multiple';
  onValueChange: (value: string) => void;
} | null>(null);

const AccordionItemContext = React.createContext<AccordionItemContextValue | null>(null);

interface AccordionProps {
  type: 'single' | 'multiple';
  collapsible?: boolean;
  defaultValue?: string[];
  value?: string[];
  onValueChange?: (value: string[]) => void;
  className?: string;
  children: React.ReactNode;
}

function Accordion({
  type,
  collapsible = false,
  defaultValue = [],
  value: controlledValue,
  onValueChange,
  className,
  children,
}: AccordionProps) {
  const [internalValue, setInternalValue] = React.useState<Set<string>>(new Set(defaultValue));
  const isControlled = controlledValue !== undefined;
  const expandedSet = isControlled ? new Set(controlledValue) : internalValue;

  const handleValueChange = React.useCallback(
    (itemValue: string) => {
      const next = new Set(expandedSet);
      if (next.has(itemValue)) {
        if (collapsible || type === 'multiple') {
          next.delete(itemValue);
        }
        // In 'single' mode without collapsible, don't collapse
      } else {
        if (type === 'single') {
          next.clear();
        }
        next.add(itemValue);
      }

      const nextArray = Array.from(next);
      if (!isControlled) {
        setInternalValue(next);
      }
      onValueChange?.(nextArray);
    },
    [expandedSet, type, collapsible, isControlled, onValueChange]
  );

  return (
    <AccordionContext.Provider
      value={{ expandedValues: expandedSet, type, onValueChange: handleValueChange }}
    >
      <div className={cn('space-y-1', className)}>{children}</div>
    </AccordionContext.Provider>
  );
}
Accordion.displayName = 'Accordion';

interface AccordionItemProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

function AccordionItem({ value, className, children }: AccordionItemProps) {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) throw new Error('AccordionItem must be used within Accordion');
  const expanded = ctx.expandedValues.has(value);

  return (
    <AccordionItemContext.Provider value={{ value, expanded, onToggle: ctx.onValueChange }}>
      <div
        className={cn('rounded-md border', className)}
        data-state={expanded ? 'open' : 'closed'}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}
AccordionItem.displayName = 'AccordionItem';

interface AccordionTriggerProps {
  className?: string;
  children: React.ReactNode;
}

function AccordionTrigger({ className, children }: AccordionTriggerProps) {
  const itemCtx = React.useContext(AccordionItemContext);
  if (!itemCtx) throw new Error('AccordionTrigger must be used within AccordionItem');

  return (
    <button
      type="button"
      className={cn(
        'flex flex-1 items-center justify-between px-4 py-3 text-sm font-medium transition-all hover:bg-muted/50 [&[data-state=open]>svg]:rotate-180',
        className
      )}
      data-state={itemCtx.expanded ? 'open' : 'closed'}
      onClick={() => itemCtx.onToggle(itemCtx.value)}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
    </button>
  );
}
AccordionTrigger.displayName = 'AccordionTrigger';

interface AccordionContentProps {
  className?: string;
  children: React.ReactNode;
}

function AccordionContent({ className, children }: AccordionContentProps) {
  const itemCtx = React.useContext(AccordionItemContext);
  if (!itemCtx) throw new Error('AccordionContent must be used within AccordionItem');

  const contentRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (contentRef.current) {
      setHeight(itemCtx.expanded ? contentRef.current.scrollHeight : 0);
    }
  }, [itemCtx.expanded]);

  return (
    <div
      ref={contentRef}
      className={cn('overflow-hidden transition-all duration-200', className)}
      style={{ height: height ?? undefined }}
      data-state={itemCtx.expanded ? 'open' : 'closed'}
    >
      <div className="px-4 pb-4 pt-0">{children}</div>
    </div>
  );
}
AccordionContent.displayName = 'AccordionContent';

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
