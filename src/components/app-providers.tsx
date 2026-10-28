import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { panelQueryClient } from '@/lib/query-client';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={panelQueryClient}>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.16 }}>
        {children}
      </MotionConfig>
    </QueryClientProvider>
  );
}
