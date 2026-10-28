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
}

export const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, trend }) => {
  return (
    <div className="v2-metric rounded-xl border bg-card">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
        <Icon className="hidden h-4 w-4 shrink-0 sm:block" /><span>{label}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="v2-metric-value">{value}</p>
        {trend && <span className={cn('text-xs font-medium', trend.positive ? 'text-green-600' : 'text-red-600')}>
          {trend.positive ? '↑' : '↓'} {trend.value}
        </span>}
      </div>
    </div>
  );
};

export default StatCard;
