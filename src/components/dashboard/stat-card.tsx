import React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  trend?: {
    value: string;
    positive: boolean;
  };
  /** When set, the whole card is a button that opens the related page. */
  onOpen?: () => void;
  /** Accessible description of where the card leads, e.g. "打开平台连接". */
  openLabel?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, trend, onOpen, openLabel }) => {
  const Root = onOpen ? 'button' : 'div';
  return (
    <Root {...(onOpen ? { type: 'button' as const, onClick: onOpen, title: openLabel, 'aria-label': `${label}：${value}${openLabel ? ` · ${openLabel}` : ''}` } : {})}
      className={cn('v2-metric rounded-xl border bg-card text-left', onOpen
        && 'w-full cursor-pointer transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
        <Icon className="hidden h-4 w-4 shrink-0 sm:block" /><span>{label}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="v2-metric-value">{value}</p>
        {trend && <span className={cn('text-xs font-medium', trend.positive ? 'text-green-600' : 'text-red-600')}>
          {trend.positive ? '↑' : '↓'} {trend.value}
        </span>}
      </div>
    </Root>
  );
};

export default StatCard;
