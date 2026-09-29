import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: 'compact' | 'page' }
>(({ className, variant = 'compact', ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    data-variant={variant}
    className={cn(
      'group/tabs inline-flex h-auto max-w-full flex-wrap items-center gap-1 rounded-lg p-1 text-muted-foreground',
      variant === 'page'
        ? 'h-[42px] w-fit flex-nowrap justify-start overflow-x-auto overflow-y-hidden rounded-lg border bg-card p-1 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        : 'justify-start bg-muted/70',
      className
    )}
    {...props}
  />
));
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
