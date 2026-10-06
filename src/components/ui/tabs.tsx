import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCloseOnWideScreen } from '@/hooks/use-close-on-wide-screen';

type RootProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>;
const TabsSelection = React.createContext<{ value?: string; select: (value: string) => void } | null>(null);

// The tab bar and narrow-screen select share one value. CSS-only switching
// never calls onValueChange, remounts panels or resets an editing session.
const Tabs = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Root>, RootProps>(
  ({ value: controlledValue, defaultValue, onValueChange, ...props }, ref) => {
    const [localValue, setLocalValue] = React.useState(defaultValue);
    const value = controlledValue ?? localValue;
    const select = (next: string) => {
      if (next === value) return;
      if (controlledValue === undefined) setLocalValue(next);
      onValueChange?.(next);
    };
    return <TabsSelection.Provider value={{ value, select }}>
      <TabsPrimitive.Root {...props} ref={ref} value={value} onValueChange={select} />
    </TabsSelection.Provider>;
  }
);
Tabs.displayName = TabsPrimitive.Root.displayName;

type TriggerProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>;
function tabOptions(children: React.ReactNode): TriggerProps[] {
  const options: TriggerProps[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) options.push(...tabOptions(child.props.children));
    else if (child.type === TabsTrigger && child.props.value) options.push(child.props as TriggerProps);
  });
  return options;
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: 'compact' | 'page'; responsive?: boolean; 'data-tour'?: string }
>(({ className, variant = 'compact', responsive, children, 'data-tour': tourAnchor, ...props }, ref) => {
  const { t } = useTranslation();
  const [selectOpen, setSelectOpen] = React.useState(false);
  useCloseOnWideScreen(() => setSelectOpen(false));
  const selection = React.useContext(TabsSelection);
  const options = tabOptions(children);
  const collapse = !!selection && (responsive ?? options.length >= 3) && options.length > 0;
  const list = <TabsPrimitive.List
    ref={ref}
    data-variant={variant}
    className={cn(
      'group/tabs inline-flex h-auto max-w-full flex-wrap items-center gap-1 rounded-lg p-1 text-muted-foreground',
      variant === 'page'
        ? 'h-[42px] w-fit flex-nowrap justify-start overflow-x-auto overflow-y-hidden rounded-lg border bg-card p-1 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        : 'justify-start bg-muted/70',
      collapse ? 'hidden md:inline-flex' : className
    )}
    {...props}
    data-tour={collapse ? undefined : tourAnchor}
  >{children}</TabsPrimitive.List>;
  if (!collapse || !selection) return list;
  return <div className={cn('min-w-0 w-full max-w-full md:w-fit', className)}
    data-tour={tourAnchor} data-responsive-tabs>
    <div className="md:hidden">
      <Select value={selection.value ?? ''} open={selectOpen} onOpenChange={setSelectOpen} onValueChange={(value) => {
        if (options.some((option) => option.value === value && !option.disabled)) selection.select(value);
      }}>
        <SelectTrigger className="w-full bg-card text-left"
          aria-label={props['aria-label'] ?? t('common.select_tab')}>
          <span className="min-w-0 flex-1 truncate"><SelectValue placeholder={t('common.select_tab')} /></span>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            <span className="flex min-w-0 items-center gap-2 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0">{option.children}</span>
          </SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    {list}
  </div>;
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex min-w-0 max-w-full items-center justify-center gap-2 whitespace-normal break-words rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm [&_svg]:shrink-0 group-data-[variant=page]/tabs:h-full group-data-[variant=page]/tabs:max-w-none group-data-[variant=page]/tabs:shrink-0 group-data-[variant=page]/tabs:whitespace-nowrap group-data-[variant=page]/tabs:rounded-md group-data-[variant=page]/tabs:px-3 group-data-[variant=page]/tabs:py-1 group-data-[variant=page]/tabs:focus-visible:ring-inset group-data-[variant=page]/tabs:focus-visible:ring-offset-0 group-data-[variant=page]/tabs:data-[state=active]:bg-primary/10 group-data-[variant=page]/tabs:data-[state=active]:shadow-none',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 min-w-0 w-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
