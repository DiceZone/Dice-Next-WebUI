import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { zustandAppStore } from '@/store/app-store';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { BrandWordmark } from './brand-wordmark';
import {
  LayoutDashboard, PlugZap, MessageSquareReply, MessageSquareText, PanelsTopLeft, FolderKanban, FolderOpen, Boxes,
  Settings, Info, ChevronLeft, ChevronDown, FlaskConical, Users, UserCog,
  Map, BookText, Clock, Scroll, ShieldBan, Database, Puzzle, SlidersHorizontal,
  Monitor, HelpCircle, Archive, Sparkles, Wand2, Languages, Cpu, MessageCircle, Drama, Bell, BarChart3, Cloud, X,
} from 'lucide-react';

type Icon = React.ComponentType<{ className?: string }>;
interface Leaf { labelKey: string; path: string; icon: Icon; }
interface Group { labelKey: string; icon: Icon; children: Leaf[]; }
type Node = Leaf | Group;
const isGroup = (n: Node): n is Group => 'children' in n;

const NAV: Node[] = [
  { labelKey: 'nav.dashboard', path: '/', icon: LayoutDashboard },
  { labelKey: 'nav.statistics', path: '/statistics', icon: BarChart3 },
  { labelKey: 'nav.playground', path: '/playground', icon: FlaskConical },
  { labelKey: 'nav.adapters', path: '/adapters', icon: PlugZap },
  { labelKey: 'nav.replies', icon: MessageSquareReply, children: [
    { labelKey: 'nav.custom_replies', path: '/replies', icon: MessageSquareText },
    { labelKey: 'qq_editor.title', path: '/qq-official', icon: PanelsTopLeft },
  ] },
  { labelKey: 'nav.commands', path: '/commands', icon: BookText },
  { labelKey: 'nav.help', path: '/help', icon: HelpCircle },
  { labelKey: 'nav.ext_mgmt', icon: Boxes, children: [
    { labelKey: 'nav.modules', path: '/modules', icon: Puzzle },
    { labelKey: 'nav.rules', path: '/rules', icon: Scroll },
    { labelKey: 'nav.decks', path: '/decks', icon: FolderKanban },
  ] },
  { labelKey: 'nav.data_mgmt', icon: Database, children: [
    { labelKey: 'image_resources.title', path: '/files', icon: FolderOpen },
    { labelKey: 'nav.groups', path: '/groups', icon: Users },
    { labelKey: 'nav.players', path: '/players', icon: UserCog },
    { labelKey: 'nav.logs', path: '/logs', icon: Scroll },
    { labelKey: 'nav.banlist', path: '/permissions', icon: ShieldBan },   // C#94：URL 更名
  ] },
  { labelKey: 'nav.ai', icon: Sparkles, children: [
    { labelKey: 'nav.ai_models', path: '/ai', icon: Cpu },
    { labelKey: 'nav.ai_chat', path: '/ai/chat', icon: MessageCircle },
    { labelKey: 'nav.ai_npc', path: '/ai/npc', icon: Drama },
    { labelKey: 'nav.ai_polish', path: '/ai/polish', icon: Wand2 },
    { labelKey: 'nav.ai_translate', path: '/ai/translate', icon: Languages },
  ] },
  { labelKey: 'nav.system', icon: Settings, children: [
    { labelKey: 'nav.settings', path: '/settings', icon: SlidersHorizontal },
    { labelKey: 'cloud.title', path: '/cloud-services', icon: Cloud },
    { labelKey: 'mcp.title', path: '/mcp', icon: PlugZap },
    { labelKey: 'nav.notice', path: '/notice-settings', icon: Bell },
    { labelKey: 'nav.webui', path: '/webui-settings', icon: Monitor },
    { labelKey: 'nav.schedules', path: '/schedules', icon: Clock },
    { labelKey: 'nav.backup', path: '/backup', icon: Archive },
  ] },
  { labelKey: 'nav.roadmap', path: '/roadmap', icon: Map },
  { labelKey: 'nav.about', path: '/about', icon: Info },
];

// 精确匹配（路由表均为精确键；/ai 与 /ai/polish 等前缀关系不能用 startsWith，否则串亮）。
const isActivePath = (path: string, current: string) => current === path;

export function navigationTrail(path: string): string[] {
  for (const node of NAV) {
    if (isGroup(node)) {
      const child = node.children.find((item) => item.path === path);
      if (child) return [node.labelKey, child.labelKey];
    } else if (node.path === path) return [node.labelKey];
  }
  return [];
}

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  mobileMenuOpen: boolean;
  onMobileMenuChange: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate, mobileMenuOpen, onMobileMenuChange }) => {
  const { sidebarCollapsed, setSidebarCollapsed } = zustandAppStore();
  const { t } = useTranslation();
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const update = () => { setMobile(media.matches); if (!media.matches) onMobileMenuChange(false); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [onMobileMenuChange]);
  // 默认展开包含当前路由的分组。
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => {
    const active = NAV.find((n) => isGroup(n) && n.children.some((c) => isActivePath(c.path, currentPath)));
    return active && isGroup(active) ? active.labelKey : null;
  });
  // Links from search and adapter shortcuts should reveal the new parent group.
  // Users can still manually collapse it until the route changes again.
  useEffect(() => {
    const active = NAV.find((node) => isGroup(node) && node.children.some((child) => child.path === currentPath));
    if (active && isGroup(active)) setExpandedGroup(active.labelKey);
  }, [currentPath]);

  const go = (path: string) => {
    onNavigate(path);
    if (window.innerWidth < 1024) onMobileMenuChange(false);
  };

  const leafBtn = (item: Leaf, indent = false) => (
    <button key={item.path} onClick={() => go(item.path)} aria-current={isActivePath(item.path, currentPath) ? 'page' : undefined}
      className={cn(
        'v2-nav-item flex w-full items-center gap-3 px-3 py-2 text-[13px] transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-[current=page]:text-primary aria-[current=page]:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        indent && !sidebarCollapsed && 'pl-7',
        sidebarCollapsed && 'lg:justify-center lg:px-2')}
      title={sidebarCollapsed ? t(item.labelKey) : undefined}>
      <item.icon className="h-[18px] w-[18px] shrink-0" />
      {!sidebarCollapsed && <span className="truncate">{t(item.labelKey)}</span>}
    </button>
  );

  return (
    <>
      <DialogPrimitive.Root open={mobile && mobileMenuOpen} onOpenChange={onMobileMenuChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
          <DialogPrimitive.Content aria-describedby={undefined}
            onCloseAutoFocus={(event) => { event.preventDefault(); document.getElementById('mobile-navigation-trigger')?.focus(); }}
            className="v2-mobile-menu fixed inset-0 z-50 flex h-dvh w-full flex-col bg-card outline-none">
            <div className="flex shrink-0 items-center justify-between border-b px-5 py-3 pt-[max(.75rem,env(safe-area-inset-top))]">
              <DialogPrimitive.Title className="flex items-center gap-2"><img src="./favicon.svg" alt="" className="h-7 w-7" /><BrandWordmark /><span className="sr-only">{t('header.panel_title')}</span></DialogPrimitive.Title>
              <DialogPrimitive.Close asChild><Button variant="ghost" size="icon" aria-label={t('common.close')}><X className="h-5 w-5" /></Button></DialogPrimitive.Close>
            </div>
            <nav aria-label={t('header.panel_title')} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {[
                { labelKey: 'v2.navigation.workspace', children: NAV.filter((node): node is Leaf => !isGroup(node) && !['/roadmap', '/about'].includes(node.path)) },
                ...NAV.filter(isGroup),
                { labelKey: 'v2.navigation.manage', children: NAV.filter((node): node is Leaf => !isGroup(node) && ['/roadmap', '/about'].includes(node.path)) },
              ].map((group) => <section key={group.labelKey}>
                <h2 className="mb-2 px-2 text-xs font-medium text-muted-foreground">{t(group.labelKey)}</h2>
                <div className="grid grid-cols-2 gap-2">
                  {group.children.map((item) => <button key={item.path} onClick={() => go(item.path)}
                    aria-current={isActivePath(item.path, currentPath) ? 'page' : undefined}
                    className="v2-nav-item group flex min-h-11 min-w-0 items-center gap-3 bg-muted/50 px-3 py-3 text-left text-sm hover:bg-accent aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    <item.icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground group-aria-[current=page]:text-primary" /><span className="min-w-0 break-words">{t(item.labelKey)}</span>
                  </button>)}
                </div>
              </section>)}
            </nav>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <aside className={cn(
        'v2-sidebar relative z-40 hidden h-full shrink-0 flex-col overflow-hidden border-r bg-card transition-[width] duration-200 motion-reduce:transition-none lg:flex',
        sidebarCollapsed ? 'w-[64px]' : 'w-[232px]')}>
        {/* Brand */}
        <div className={cn('flex h-16 shrink-0 items-center px-4', sidebarCollapsed ? 'justify-center' : 'justify-between')}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <img src="./favicon.svg" alt="" className="h-7 w-7" />
              <BrandWordmark />
            </div>
          )}
          <Button variant="ghost" size="icon" aria-label={t('v2.toggle_menu')} className="hidden h-7 w-7 lg:flex" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <ChevronLeft className={cn('h-4 w-4 transition-transform', sidebarCollapsed && 'rotate-180')} />
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1 pb-3">
          <nav aria-label={t('header.panel_title')} className="space-y-0.5 px-3">
            {!sidebarCollapsed && <p className="v2-section-label">{t('v2.navigation.monitor')}</p>}
            {NAV.filter((n) => isGroup(n) || !['/roadmap', '/about'].includes(n.path)).map((n) => {
              if (!isGroup(n)) return <React.Fragment key={n.path}>
                {!sidebarCollapsed && n.path === '/adapters' && <p className="v2-section-label">{t('v2.navigation.workspace')}</p>}
                {leafBtn(n)}
              </React.Fragment>;
              // 折叠态(图标栏)：组无标题，直接平铺子项图标。
              if (sidebarCollapsed) return <React.Fragment key={n.labelKey}>{n.children.map((c) => leafBtn(c))}</React.Fragment>;
              const open = expandedGroup === n.labelKey;
              const childActive = n.children.some((c) => isActivePath(c.path, currentPath));
              return (
                <div key={n.labelKey}>
                  {n.labelKey === 'nav.ext_mgmt' && <p className="v2-section-label">{t('v2.navigation.manage')}</p>}
                  <button aria-expanded={open} onClick={() => setExpandedGroup((current) => current === n.labelKey ? null : n.labelKey)}
                    className={cn('v2-nav-item flex w-full items-center gap-3 px-3 py-2 text-[13px] transition-colors',
                      childActive ? 'text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}>
                    <n.icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="flex-1 truncate text-left">{t(n.labelKey)}</span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
                  </button>
                  {open && <div className="my-1 space-y-0.5">{n.children.map((c) => leafBtn(c, true))}</div>}
                </div>
              );
            })}
          </nav>
        </ScrollArea>
        <div className="shrink-0 space-y-0.5 border-t p-3">
          {NAV.filter((node): node is Leaf => !isGroup(node) && ['/roadmap', '/about'].includes(node.path)).map((node) => leafBtn(node))}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
