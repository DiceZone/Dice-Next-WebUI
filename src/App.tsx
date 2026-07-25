import React from 'react';
import { useTranslation } from 'react-i18next';
import { zustandAppStore } from '@/store/app-store';
import { AppRouter } from '@/routes';
import { AuthGate } from '@/components/auth-gate';

/**
 * Root application component.
 *
 * Provides:
 * - Zustand store initialization (via app store)
 * - TanStack-style hash-based router (via AppRouter)
 * - Toast provider (via Toaster in AppRouter)
 * - Full layout with sidebar, header, and content area
 */

export const App: React.FC = () => {
  const { initialized, initialize } = zustandAppStore();
  const { t } = useTranslation();

  // Initialize app state on mount
  React.useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  if (!initialized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <div className="animate-fade-in text-center">
          <h1 className="mb-2 text-4xl font-bold tracking-tight text-brand-600">
            🎲 Dice!Next
          </h1>
          <p className="text-lg text-muted-foreground">{t('app.initializing')}</p>
        </div>
      </div>
    );
  }

  return (
    <AuthGate>
      <AppRouter />
    </AuthGate>
  );
};

export default App;
