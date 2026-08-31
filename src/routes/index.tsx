import React, { useState, useCallback } from 'react';
import { Layout } from '@/components/layout/layout';
import { Toaster } from '@/components/ui/toaster';
import { DashboardPage } from '@/pages/dashboard-page';
import { AdaptersPage } from '@/pages/adapters-page';
import { DiceRulesPage } from '@/pages/dice-rules-page';
import { RepliesPage } from '@/pages/replies-page';
import { DecksPage } from '@/pages/decks-page';
import { GroupsPage } from '@/pages/groups-page';
import { PlayersPage } from '@/pages/players-page';
import { RoadmapPage } from '@/pages/roadmap-page';
import { CommandsPage } from '@/pages/commands-page';
import { HelpDocsPage } from '@/pages/help-docs-page';
import { ModulesPage } from '@/pages/modules-page';
import { RulesPage } from '@/pages/rules-page';
import { BanlistPage } from '@/pages/banlist-page';
import { SettingsPage } from '@/pages/settings-page';
import { WebuiSettingsPage } from '@/pages/webui-settings-page';
import { NoticeSettingsPage } from '@/pages/notice-settings-page';
import { AiPage } from '@/pages/ai-page';
import { SchedulesPage } from '@/pages/schedules-page';
import { PlaygroundPage } from '@/pages/playground-page';
import { AboutPage } from '@/pages/about-page';
import { BackupPage } from '@/pages/backup-page';
import { LogsPage } from '@/pages/logs-page';
import { StatisticsPage } from '@/pages/statistics-page';

/**
 * Route configuration and page component map.
 *
 * Uses a simple hash-based router since the app communicates
 * via WebSocket proxy. This avoids server-side routing complications.
 */
const ROUTES: Record<string, React.ComponentType> = {
  '/': DashboardPage,
  '/playground': PlaygroundPage,
  '/adapters': AdaptersPage,
  '/dice-rules': DiceRulesPage,
  '/replies': RepliesPage,
  '/decks': DecksPage,
  '/groups': GroupsPage,
  '/players': PlayersPage,
  '/schedules': SchedulesPage,
  '/roadmap': RoadmapPage,
  '/commands': CommandsPage,
  '/help': HelpDocsPage,
  '/modules': ModulesPage,
  '/rules': RulesPage,
  '/permissions': BanlistPage,
  '/banlist': BanlistPage,
  '/settings': SettingsPage,
  '/ai': AiPage,
  '/ai/chat': AiPage,
  '/ai/npc': AiPage,
  '/ai/polish': AiPage,
  '/ai/translate': AiPage,
  '/notice-settings': NoticeSettingsPage,
  '/webui-settings': WebuiSettingsPage,
  '/about': AboutPage,
  '/backup': BackupPage,
  '/logs': LogsPage,
  '/statistics': StatisticsPage,
};

const DEFAULT_ROUTE = '/';
const NOT_FOUND_ROUTES = new Set<string>();
let notifiedAboutNotFound = false;

interface RouteLocation {
  path: string;
  query: string;
  raw: string;
}

const parseRoute = (value: string): RouteLocation => {
  const source = value || DEFAULT_ROUTE;
  const queryAt = source.indexOf('?');
  const path = (queryAt >= 0 ? source.slice(0, queryAt) : source) || DEFAULT_ROUTE;
  const query = queryAt >= 0 ? source.slice(queryAt + 1) : '';
  return { path, query, raw: query ? `${path}?${query}` : path };
};

const readHashRoute = () => parseRoute(window.location.hash.slice(1) || DEFAULT_ROUTE);

export const AppRouter: React.FC = () => {
  const [location, setLocation] = useState<RouteLocation>(() => {
    const initial = readHashRoute();
    return initial.path in ROUTES ? initial : parseRoute(DEFAULT_ROUTE);
  });

  const navigate = useCallback((destination: string) => {
    const requested = parseRoute(destination);
    const next = requested.path in ROUTES ? requested : parseRoute(DEFAULT_ROUTE);
    if (window.location.hash.slice(1) !== next.raw) window.location.hash = next.raw;
    setLocation((current) => current.raw === next.raw ? current : next);
  }, []);

  React.useEffect(() => {
    const handleHashChange = () => {
      const next = readHashRoute();
      if (next.path in ROUTES) {
        setLocation(next);
      } else if (!NOT_FOUND_ROUTES.has(next.path) && !notifiedAboutNotFound) {
        notifiedAboutNotFound = true;
        console.warn(`Unknown route: "${next.path}", redirecting to ${DEFAULT_ROUTE}`);
        NOT_FOUND_ROUTES.add(next.path);
        const fallback = parseRoute(DEFAULT_ROUTE);
        window.location.hash = fallback.raw;
        setLocation(fallback);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    if (!window.location.hash) window.location.hash = DEFAULT_ROUTE;
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const PageComponent = ROUTES[location.path] || ROUTES[DEFAULT_ROUTE];
  const searchTarget = new URLSearchParams(location.query).get('focus') || undefined;

  return (
    <Layout currentPath={location.path} onNavigate={navigate} searchTarget={searchTarget}>
      <PageComponent key={location.raw} />
      <Toaster />
    </Layout>
  );
};

export default AppRouter;
