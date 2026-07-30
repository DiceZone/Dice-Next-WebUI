import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { zustandAppStore } from '@/store/app-store';
import {
  LayoutDashboard, PlugZap, MessageSquareReply, FolderKanban, Boxes,
  Settings, Info, ChevronLeft, ChevronDown, FlaskConical, Users, UserCog,
  Map, BookText, Clock, Scroll, ShieldBan, Database, Puzzle, SlidersHorizontal,
  Monitor, HelpCircle, Archive, Sparkles, Wand2, Languages, Cpu, MessageCircle, Drama, Bell, BarChart3,
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
  { labelKey: 'nav.replies', path: '/replies', icon: MessageSquareReply },
  { labelKey: 'nav.commands', path: '/commands', icon: BookText },
  { labelKey: 'nav.help', path: '/help', icon: HelpCircle },
  { labelKey: 'nav.ext_mgmt', icon: Boxes, children: [
    { labelKey: 'nav.modules', path: '/modules', icon: Puzzle },
    { labelKey: 'nav.rules', path: '/rules', icon: Scroll },
    { labelKey: 'nav.decks', path: '/decks', icon: FolderKanban },
  ] },
  { labelKey: 'nav.data_mgmt', icon: Database, children: [
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

interface SidebarProps { currentPath: string; onNavigate: (path: string) => void; }

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { sidebarCollapsed, setSidebarCollapsed } = zustandAppStore();
  const { t } = useTranslation();
  // 默认展开包含当前路由的分组。
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const n of NAV) if (isGroup(n) && n.children.some((c) => isActivePath(c.path, currentPath))) init[n.labelKey] = true;
    return init;
  });

  const go = (path: string) => {
    onNavigate(path);
    if (window.innerWidth < 1024) setSidebarCollapsed(true);
  };

  const leafBtn = (item: Leaf, indent = false) => (
    <button key={item.path} onClick={() => go(item.path)}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActivePath(item.path, currentPath) ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        indent && !sidebarCollapsed && 'pl-9',
        sidebarCollapsed && 'lg:justify-center lg:px-2')}
      title={sidebarCollapsed ? t(item.labelKey) : undefined}>
      <item.icon className="h-5 w-5 shrink-0" />
      {!sidebarCollapsed && <span className="truncate">{t(item.labelKey)}</span>}
    </button>
  );

  return (
    <>
      {!sidebarCollapsed && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarCollapsed(true)} />
      )}
      <aside className={cn(
        'fixed left-0 top-0 z-40 flex h-full flex-col border-r bg-background transition-all duration-300 lg:relative',
        sidebarCollapsed ? 'w-0 -translate-x-full lg:w-16 lg:translate-x-0' : 'w-64 translate-x-0')}>
        {/* Brand */}
        <div className={cn('flex h-14 items-center border-b px-3', sidebarCollapsed ? 'justify-center' : 'justify-between')}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <img src="/favicon.svg" alt="Dice!Next" className="h-7 w-7" />
              <span className="text-lg font-bold tracking-tight text-brand-600 whitespace-nowrap">Dice!Next</span>
            </div>
          )}
          <Button variant="ghost" size="icon" className="hidden lg:flex" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <ChevronLeft className={cn('h-4 w-4 transition-transform', sidebarCollapsed && 'rotate-180')} />
          </Button>
        </div>

        <ScrollArea className="flex-1 py-2">
          <nav className="space-y-1 px-2">
            {NAV.map((n) => {
              if (!isGroup(n)) return leafBtn(n);
              // 折叠态(图标栏)：组无标题，直接平铺子项图标。
              if (sidebarCollapsed) return <React.Fragment key={n.labelKey}>{n.children.map((c) => leafBtn(c))}</React.Fragment>;
              const open = !!expanded[n.labelKey];
              const childActive = n.children.some((c) => isActivePath(c.path, currentPath));
              return (
                <div key={n.labelKey}>
                  <button onClick={() => setExpanded((s) => ({ ...s, [n.labelKey]: !open }))}
                    className={cn('flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      childActive ? 'text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}>
                    <n.icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1 truncate text-left">{t(n.labelKey)}</span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
                  </button>
                  {open && <div className="mt-1 space-y-1">{n.children.map((c) => leafBtn(c, true))}</div>}
                </div>
              );
            })}
          </nav>
        </ScrollArea>

        {!sidebarCollapsed && (
          <div className="border-t p-3"><p className="text-xs text-muted-foreground text-center">v3.0.0 — Dice!Next</p></div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
