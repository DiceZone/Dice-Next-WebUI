import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { GlobalSettingsSearch } from '@/components/layout/global-settings-search';
import { zustandAppStore } from '@/store/app-store';
import { useSystemUpdateStore } from '@/store/system-update-store';
import { formatVersion, isUpdateBusy } from '@/lib/system-update';
import { CircleHelp, Menu, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  wsConnected?: boolean;
  onNavigate: (path: string) => void;
  tourAvailable?: boolean;
  onReplayTour?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ wsConnected: _ws, onNavigate, tourAvailable = false, onReplayTour }) => {
  const { sidebarCollapsed, setSidebarCollapsed, theme, setTheme } = zustandAppStore();
  const { t } = useTranslation();
  const version = useSystemUpdateStore((state) => state.version);
  const updateStatus = useSystemUpdateStore((state) => state.status);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    void useSystemUpdateStore.getState().loadVersion();
    const poll = async () => {
      try { await useSystemUpdateStore.getState().refresh(); } catch { /* Try on the next poll. */ }
      if (!stopped) {
        const phase = useSystemUpdateStore.getState().status?.phase ?? 'idle';
        timer = setTimeout(() => void poll(), isUpdateBusy(phase) ? 3000 : 30000);
      }
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
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
    <header className="flex h-14 items-center border-b bg-background px-2 sm:px-3 md:px-4">
      <div className="flex shrink-0 items-center gap-3">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:h-10 sm:w-10 lg:hidden"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Brand (mobile-only) */}
        <div className="hidden items-center gap-2 sm:flex lg:hidden">
          <span className="text-base font-bold text-brand-600">Dice!Next</span>
        </div>

        {/* Page title placeholder — can be overridden by children if needed */}
        <span className="hidden text-sm font-medium text-muted-foreground xl:inline">
          {t('header.panel_title')}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 justify-center sm:px-3 md:px-4">
        <GlobalSettingsSearch onNavigate={onNavigate} />
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <button
          type="button"
          className="inline-flex h-8 max-w-[132px] items-center gap-1 rounded-sm px-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-none sm:gap-1.5 sm:px-2 sm:text-xs"
          onClick={() => onNavigate('/about?focus=about-update')}
          title={`${formatVersion(version)} · ${t(updateStatus?.updateAvailable ? 'about.version_new_available' : 'about.version_open')}`}
          aria-label={`${formatVersion(version)} · ${t(updateStatus?.updateAvailable ? 'about.version_new_available' : 'about.version_open')}`}
        >
          <span className="min-w-0 truncate font-mono">{formatVersion(version)}</span>
          {updateStatus?.updateAvailable && <img src="/new.svg" alt="" className="h-3 w-6 shrink-0 sm:h-3.5 sm:w-8" />}
        </button>

        {/* Language switcher */}
        <LanguageSwitcher />

        {/* The tour only auto-opens once, but remains available on demand. */}
        {tourAvailable && (
          <Button
            data-tour="replay"
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:h-10 sm:w-10"
            onClick={onReplayTour}
            title={t('onboarding.replay')}
            aria-label={t('onboarding.replay')}
          >
            <CircleHelp className="h-5 w-5" />
          </Button>
        )}

        {/* Theme toggle */}
        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={toggleTheme} title={t('header.toggle_theme')}>
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
