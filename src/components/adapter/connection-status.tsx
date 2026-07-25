import React from 'react';
import { cn } from '@/lib/utils';
import type { AdapterStatus } from '@/types/adapter';

interface ConnectionStatusProps {
  status: AdapterStatus;
  className?: string;
}

const STATUS_MAP: Record<AdapterStatus, { color: string; label: string; pulse: boolean }> = {
  connected: { color: 'bg-green-500', label: '已连接', pulse: true },
  connecting: { color: 'bg-yellow-500', label: '连接中', pulse: true },
  error: { color: 'bg-red-500', label: '错误', pulse: false },
  disconnected: { color: 'bg-gray-400', label: '已断开', pulse: false },
  timeout: { color: 'bg-orange-500', label: '连接超时', pulse: false },
};

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ status, className }) => {
  const { color, label, pulse } = STATUS_MAP[status];

  return (
    <span className={cn('relative flex h-3 w-3', className)} title={label}>
      <span
        className={cn(
          'absolute inline-flex h-full w-full rounded-full opacity-75',
          color,
          pulse && 'animate-ping'
        )}
      />
      <span className={cn('relative inline-flex h-3 w-3 rounded-full', color)} />
    </span>
  );
};

export default ConnectionStatus;
