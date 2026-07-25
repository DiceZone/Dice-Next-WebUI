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
  '/permissions': BanlistPage,   // C#94：URL 更名（页面早已叫「权限设置」）
  '/banlist': BanlistPage,       // 旧地址别名，书签/外链不断
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
};

const DEFAULT_ROUTE = '/';
const NOT_FOUND_ROUTES = new Set<string>();
let notifiedAboutNotFound = false;

export const AppRouter: React.FC = () => {
  const [currentPath, setCurrentPath] = useState(() => {
    // Use hash-based routing
    const hash = window.location.hash.slice(1) || DEFAULT_ROUTE;
    return hash in ROUTES ? hash : DEFAULT_ROUTE;
  });


  const navigate = useCallback((path: string) => {
    const normalizedPath = path in ROUTES ? path : DEFAULT_ROUTE;
    window.location.hash = normalizedPath;
    setCurrentPath(normalizedPath);
  }, []);

  // Listen for hash changes (browser back/forward)
  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) || DEFAULT_ROUTE;
      if (hash in ROUTES) {
        setCurrentPath(hash);
      } else if (!NOT_FOUND_ROUTES.has(hash) && !notifiedAboutNotFound) {
        // Only warn once
        notifiedAboutNotFound = true;
        console.warn(`Unknown route: "${hash}", redirecting to ${DEFAULT_ROUTE}`);
        NOT_FOUND_ROUTES.add(hash);
        window.location.hash = DEFAULT_ROUTE;
        setCurrentPath(DEFAULT_ROUTE);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Set initial hash if not present
    if (!window.location.hash) {
      window.location.hash = DEFAULT_ROUTE;
    }
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const PageComponent = ROUTES[currentPath] || ROUTES[DEFAULT_ROUTE];

  return (
    <Layout currentPath={currentPath} onNavigate={navigate} >
      <PageComponent />
      <Toaster />
    </Layout>
  );
};

export default AppRouter;
