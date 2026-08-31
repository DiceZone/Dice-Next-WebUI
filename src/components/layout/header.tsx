import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { GlobalSettingsSearch } from '@/components/layout/global-settings-search';
import { zustandAppStore } from '@/store/app-store';
import { Menu, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  wsConnected?: boolean;
  onNavigate: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ wsConnected: _ws, onNavigate }) => {
  const { sidebarCollapsed, setSidebarCollapsed, theme, setTheme } = zustandAppStore();
  const { t } = useTranslation();
  const [apiOnline, setApiOnline] = useState(false);

  useEffect(() => {
    const check = () => {
      fetch('/api/system/status')
        .then((r) => r.json())
        .then((d) => setApiOnline(d.code === 0))
        .catch(() => setApiOnline(false));
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Apply dark class to html element
  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // system — follow OS preference
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme]);

  return (
    <header className="flex h-14 items-center border-b bg-background px-3 md:px-4">
      <div className="flex shrink-0 items-center gap-3">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Brand (mobile-only) */}
        <div className="flex items-center gap-2 lg:hidden">
          <span className="text-base font-bold text-brand-600">Dice!Next</span>
        </div>

        {/* Page title placeholder — can be overridden by children if needed */}
        <span className="hidden text-sm font-medium text-muted-foreground xl:inline">
          {t('header.panel_title')}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 justify-center px-1 sm:px-3 md:px-4">
        <GlobalSettingsSearch onNavigate={onNavigate} />
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {/* Connection status indicator */}
        <div className="hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs sm:flex">
          <span
            className={cn(
              'inline-block h-2 w-2 rounded-full',
              apiOnline
                ? 'bg-green-500 animate-pulse'
                : 'bg-gray-400'
            )}
          />
          <span className="text-muted-foreground">
            {apiOnline ? t('header.connected') : t('header.disconnected')}
          </span>
        </div>

        {/* Language switcher */}
        <LanguageSwitcher />

        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} title={t('header.toggle_theme')}>
          {theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
      </div>
    </header>
  );
};

export default Header;
