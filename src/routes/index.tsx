import React, { Suspense } from 'react';
import { createHashHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider, redirect, useBlocker, useLocation, useNavigate } from '@tanstack/react-router';
import { Layout } from '@/components/layout/layout';
import { Toaster } from '@/components/ui/toaster';
import { PageSkeleton } from '@/components/layout/page-skeleton';
import { PageError } from '@/components/layout/page-error';
import { confirmPageLeave } from '@/lib/navigation-guard';
import { createNavigationBlocker } from '@/lib/safe-navigation';
import { resolveSettingsRoute } from '@/lib/cloud-settings';
import manifest from './route-manifest.json';

const modules = import.meta.glob<Record<string, React.ComponentType>>('../pages/*-page.tsx');
const pages = new Map<string, React.LazyExoticComponent<React.ComponentType>>();
function getPage(file: string, component: string) {
  if (!pages.has(file)) pages.set(file, React.lazy(async () => {
    const module = await modules[`../pages/${file}.tsx`]();
    return { default: module[component] };
  }));
  return pages.get(file)!;
}

// Keep scope IDs such as "00123" as strings, not JSON-coerced numbers.
function parseSearch(search: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(search));
}
function stringifySearch(search: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) if (value !== undefined) params.set(key, String(value));
  return params.size ? '?' + params.toString() : '';
}
const navigationBlocker = createNavigationBlocker(confirmPageLeave);
function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  useBlocker({ shouldBlockFn: navigationBlocker, enableBeforeUnload: false });
  const go = React.useCallback((destination: string) => {
    if (!destination.startsWith('/') || destination.startsWith('//')) return;
    const url = new URL(destination, 'https://panel.invalid');
    const resolved = resolveSettingsRoute(url.pathname, url.search.slice(1));
    void navigate({ to: resolved.path, search: parseSearch(resolved.query) });
  }, [navigate]);
  React.useEffect(() => {
    const onNavigate = (event: Event) => go(String((event as CustomEvent).detail || ''));
    const onAnchor = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#/"]') : null;
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
      event.preventDefault(); go(anchor.getAttribute('href')!.slice(1));
    };
    window.addEventListener('panel:navigate', onNavigate);
    document.addEventListener('click', onAnchor);
    return () => { window.removeEventListener('panel:navigate', onNavigate); document.removeEventListener('click', onAnchor); };
  }, [go]);
  return <Layout currentPath={location.pathname} onNavigate={go}
    searchTarget={String(location.search.focus || '') || undefined}>
    <Suspense fallback={<PageSkeleton />}><Outlet /></Suspense>
    <Toaster />
  </Layout>;
}
function NotFoundPage() {
  const navigate = useNavigate();
  React.useEffect(() => { void navigate({ to: '/', replace: true }); }, [navigate]);
  return <PageSkeleton />;
}
const root = createRootRoute({ component: RootLayout, notFoundComponent: NotFoundPage,
  beforeLoad: ({ location }) => {
    const normalized = resolveSettingsRoute(location.pathname, location.searchStr.slice(1));
    if (normalized.path !== location.pathname) throw redirect({ to: normalized.path,
      search: parseSearch(normalized.query), replace: true });
  } });
const routes = manifest.map(({ path, file, component }) => {
  const Page = getPage(file, component);
  return createRoute({ getParentRoute: () => root, path,
    validateSearch: (value) => value as Record<string, string>,
    component: () => <Page /> });
});
function makeRouter() {
  const history = createHashHistory();
  const raw = window.location.hash.slice(1) || '/';
  const url = new URL(raw.startsWith('/') ? raw : '/', 'https://panel.invalid');
  const normalized = resolveSettingsRoute(url.pathname, url.search.slice(1));
  const path = manifest.some((item) => item.path === normalized.path) ? normalized.path : '/';
  const href = path + (normalized.query ? '?' + normalized.query : '');
  if (raw !== href) history.replace(href, undefined, { ignoreBlocker: true });
  return createRouter({ routeTree: root.addChildren(routes), history, parseSearch, stringifySearch, defaultErrorComponent: PageError,
    defaultPreload: false, defaultPendingComponent: PageSkeleton, defaultPendingMinMs: 0 });
}
let panelRouter: ReturnType<typeof makeRouter> | undefined;
export const AppRouter: React.FC = () => {
  // StrictMode replays effects: destroying history in an effect cleanup would
  // permanently remove hash/Back listeners on the immediately remounted view.
  const [router] = React.useState(() => panelRouter ??= makeRouter());
  return <RouterProvider router={router} />;
};
if (import.meta.hot) import.meta.hot.dispose(() => { panelRouter?.history.destroy(); });
export default AppRouter;
