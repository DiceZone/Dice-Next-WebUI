import React from 'react';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { zustandAppStore } from '@/store/app-store';

interface LayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
  wsConnected?: boolean;
  searchTarget?: string;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentPath,
  onNavigate,
  wsConnected = false,
  searchTarget,
}) => {
  const { sidebarCollapsed } = zustandAppStore();

  React.useEffect(() => {
    if (!searchTarget) return;
    let attempts = 0;
    let retryTimer: number | undefined;
    let highlightTimer: number | undefined;

    const locate = () => {
      const target = Array.from(document.querySelectorAll<HTMLElement>('[data-setting-anchor]'))
        .find((element) => element.dataset.settingAnchor === searchTarget);
      if (!target) {
        if (attempts++ < 30) retryTimer = window.setTimeout(locate, 100);
        return;
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.remove('settings-search-highlight');
      void target.offsetWidth;
      target.classList.add('settings-search-highlight');
      highlightTimer = window.setTimeout(() => target.classList.remove('settings-search-highlight'), 2600);
    };

    retryTimer = window.setTimeout(locate, 40);
    return () => {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (highlightTimer !== undefined) window.clearTimeout(highlightTimer);
    };
  }, [currentPath, searchTarget]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar currentPath={currentPath} onNavigate={onNavigate} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header wsConnected={wsConnected} onNavigate={onNavigate} />
        <main
          className={cn(
            'flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6',
            sidebarCollapsed ? 'lg:ml-0' : 'ml-0'
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
