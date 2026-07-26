import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { AdapterStatus } from '@/types/adapter';

interface ConnectionStatusProps {
  status: AdapterStatus;
  className?: string;
}

// Colour + pulse per status; the human label comes from i18n (adapters.conn_*).
const STATUS_MAP: Record<AdapterStatus, { color: string; labelKey: string; pulse: boolean }> = {
  connected: { color: 'bg-green-500', labelKey: 'adapters.conn_connected', pulse: true },
  connecting: { color: 'bg-yellow-500', labelKey: 'adapters.conn_connecting', pulse: true },
  error: { color: 'bg-red-500', labelKey: 'adapters.conn_error', pulse: false },
  disconnected: { color: 'bg-gray-400', labelKey: 'adapters.conn_disconnected', pulse: false },
  timeout: { color: 'bg-orange-500', labelKey: 'adapters.conn_timeout', pulse: false },
};

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ status, className }) => {
  const { t } = useTranslation();
  const { color, labelKey, pulse } = STATUS_MAP[status];
  const label = t(labelKey);

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
