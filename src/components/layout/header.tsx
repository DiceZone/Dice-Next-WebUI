import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { GlobalSettingsSearch } from '@/components/layout/global-settings-search';
import { zustandAppStore } from '@/store/app-store';
import { useSystemUpdateStore } from '@/store/system-update-store';
import { formatVersion, isUpdateBusy } from '@/lib/system-update';
import { CircleHelp, ChevronDown, Sun, Moon, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { changeLanguage, SUPPORTED_LANGUAGES, type LanguageCode } from '@/i18n';
import { navigationTrail } from './sidebar';
import { BrandWordmark } from './brand-wordmark';

interface HeaderProps {
  mobileMenuOpen: boolean;
  onMobileMenuChange: (open: boolean) => void;
  currentPath?: string;
  wsConnected?: boolean;
  onNavigate: (path: string) => void;
  tourAvailable?: boolean;
  onReplayTour?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPath = '/', wsConnected: _ws, onNavigate, tourAvailable = false, onReplayTour, mobileMenuOpen, onMobileMenuChange }) => {
  const { theme, setTheme } = zustandAppStore();
  const { t, i18n } = useTranslation();
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

  const versionButton = <button type="button" data-testid="header-version"
    className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-xs"
    onClick={() => onNavigate('/about?focus=about-update')}
    title={t(updateStatus?.updateAvailable ? 'about.version_new_available' : 'about.version_open')}
    aria-label={`${formatVersion(version)} · ${t(updateStatus?.updateAvailable ? 'about.version_new_available' : 'about.version_open')}`}>
    <span className="whitespace-nowrap font-mono">{formatVersion(version)}</span>
    {updateStatus?.updateAvailable && <><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500 sm:hidden" /><img src="./new.svg" alt="" className="hidden h-3 w-7 shrink-0 sm:block" /></>}
  </button>;

  return (
    <header className="z-20 flex h-14 shrink-0 items-center gap-1 border-b bg-card px-2 sm:h-16 sm:gap-3 sm:px-6 xl:px-9">
      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        {/* Brand precedes the menu trigger on narrow screens. */}
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <img data-testid="header-logo" src="./favicon.svg" alt="Dice!Next" className="h-7 w-7 shrink-0" />
          <span className="hidden sm:inline"><BrandWordmark /></span>
        </div>

        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:h-10 sm:w-10 lg:hidden"
          aria-label={t('v2.toggle_menu')}
          id="mobile-navigation-trigger"
          aria-expanded={mobileMenuOpen}
          onClick={() => onMobileMenuChange(!mobileMenuOpen)}
        >
          <ChevronDown aria-hidden="true" className={`h-5 w-5 transition-transform motion-reduce:transition-none${mobileMenuOpen ? ' rotate-180' : ''}`} />
        </Button>

        {/* Page title placeholder — can be overridden by children if needed */}
        <span className="hidden items-center gap-2 text-xs text-muted-foreground 2xl:inline-flex">
          {navigationTrail(currentPath).map((key, index) => <React.Fragment key={key}>{index > 0 && <span aria-hidden="true" className="text-border">/</span>}<span>{t(key)}</span></React.Fragment>)}
        </span>
      </div>

      <div className="ml-auto shrink-0 lg:hidden">{versionButton}</div>
      <div className="flex min-w-0 shrink-0 justify-end md:flex-1 md:justify-center lg:px-4">
        <GlobalSettingsSearch onNavigate={onNavigate} />
      </div>

      <div className="hidden shrink-0 items-center gap-2 lg:flex">
        {versionButton}

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
      <div className="shrink-0 lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" data-testid="header-more" aria-label={t('common.more_actions')}>
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onSelect={toggleTheme}>{theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}{t('header.toggle_theme')}</DropdownMenuItem>
            {tourAvailable && <DropdownMenuItem onSelect={onReplayTour}><CircleHelp className="mr-2 h-4 w-4" />{t('onboarding.replay')}</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('language.label')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={i18n.language} onValueChange={(value) => changeLanguage(value as LanguageCode)}>
              {SUPPORTED_LANGUAGES.map((language) => <DropdownMenuRadioItem key={language.code} value={language.code}>{language.label}</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
