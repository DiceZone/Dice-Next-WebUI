import React from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal, Users, MessageSquare, Image, ShieldCheck, Wrench } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useTourActive } from '@/components/onboarding/tour-data';

const sections = [
  ['basic', 'settings.sec_basic', SlidersHorizontal],
  ['groups', 'settings.sec_group_services', Users],
  ['reply', 'settings.sec_reply', MessageSquare],
  ['media', 'settings.sec_data', Image],
  ['security', 'settings.sec_security', ShieldCheck],
  ['advanced', 'ui_refresh.advanced', Wrench],
] as const;

// Panels stay mounted: changing categories must not discard unsaved settings.
// Search and onboarding share this reveal event so neither points at hidden UI.
export function SettingsWorkspace({ children, scope }: { children: React.ReactNode; scope: React.ReactNode }) {
  const { t } = useTranslation();
  const touring = useTourActive();
  const [liveActive, setLiveActive] = React.useState('basic');
  const [tourActive, setTourActive] = React.useState('basic');
  const active = touring ? tourActive : liveActive;
  const setActive = touring ? setTourActive : setLiveActive;
  const root = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const reveal = (event: Event) => {
      const target = (event as CustomEvent<HTMLElement>).detail;
      if (!target || !root.current?.contains(target)) return;
      const panel = target.closest<HTMLElement>('[data-settings-panel]');
      if (panel?.dataset.settingsPanel) setActive(panel.dataset.settingsPanel);
    };
    window.addEventListener('settings:reveal', reveal);
    return () => window.removeEventListener('settings:reveal', reveal);
  }, [setActive]);
  return <div ref={root}>
    <Tabs value={active} onValueChange={(value) => {
      setActive(value);
      root.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }} className="space-y-5">
      <TabsList variant="page" className="sticky top-0 z-20" aria-label={t('settings.title')}>
        {sections.map(([value, label, Icon]) => <TabsTrigger key={value} value={value}>
          <Icon className="h-4 w-4 shrink-0" />{t(label)}
        </TabsTrigger>)}
      </TabsList>
      {scope}
      {children}
    </Tabs>
  </div>;
}

export function SettingsPanel({ value, children }: { value: string; children: React.ReactNode }) {
  return <TabsContent value={value} forceMount data-settings-panel={value}
    className="space-y-5 data-[state=inactive]:hidden focus-visible:ring-0">{children}</TabsContent>;
}
