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
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentPath,
  onNavigate,
  wsConnected = false,
}) => {
  const { sidebarCollapsed } = zustandAppStore();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar currentPath={currentPath} onNavigate={onNavigate} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header wsConnected={wsConnected} />
        <main
          className={cn(
            'flex-1 overflow-auto p-4 md:p-6',
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
