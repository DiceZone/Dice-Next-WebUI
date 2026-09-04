import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  RefreshCw, Loader2, Users, Users2, Search, LogOut, ArrowLeft, X, Tag,
  Power, PowerOff, ShieldBan, Settings2, MessagesSquare, Send, Blocks, Moon,
  LayoutGrid, Table2, ChevronLeft, ChevronRight, ScrollText, Trash2, Download, Upload,
  ShieldCheck, UserPlus, Play,
  ChevronDown, Pencil, Image as ImageIcon, Smile, Plus, Sparkles, FolderOpen, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlatformIcon, platformLabel } from '@/components/platform-icon';
import { LogActionButtons } from '@/components/log-action-buttons';
import type { ActivePersonaInfo, PersonaTemplate } from '@/types/persona';

interface GroupAccount {
  adapterId: string; adapterName: string; loginId: string; platform: string; endpointId: string;
  loginName?: string; appId?: string;
  connected: boolean; enabled: boolean; ai_enabled?: boolean; locked: boolean; card: string;
  activeLog: boolean; activeLogId?: string; activeLogName?: string; observers: number;
  botRole: string; memberCount: number; inviter?: string; locale?: string; left?: boolean;
  welcome?: string; welcome_delay?: string; welcome_cooldown?: string;
}
interface Group {
  platform: string; groupId: string; name: string;
  enabled: boolean; ai_enabled?: boolean; locked: boolean; card: string; remark: string;
  activeLog: boolean; observers: number; botRole: string; memberCount: number;
  inviter?: string;   // C#47: 群邀请人（视同群管理）
  locale?: string;    // C#49: 本群回复语言覆盖（空=默认）
  welcome?: string; welcome_delay?: string; welcome_cooldown?: string;
  welcome_min_delay?: number; welcome_min_cooldown?: number;  // C#76: global minimums
  left?: boolean;     // C#62: 已退群（记录保留）
  bindings?: { adapterType: string; adapterAccount: string; endpointId: string }[];
  accounts?: GroupAccount[];
}
interface Member { userId: string; nickname: string; card: string; role: string; title: string; }
interface ChatLine { id: number; sender: string; userId?: string; content: string; self: boolean; time: number; recalled?: boolean; msgId?: string; }

const tagsOf = (g: Group) => g.remark.split(',').map((s) => s.trim()).filter(Boolean);
const primaryAccount = (g: Group) => g.accounts?.find((a) => a.connected && !a.left) || g.accounts?.[0];
const accountPayload = (g: Group) => {
  const a = primaryAccount(g);
  return a ? { adapterId: a.adapterId, endpointId: a.endpointId } : {};
};

function roleLabel(t: (k: string) => string, role: string) {
  return role === 'owner' ? t('groups.role_owner') : role === 'admin' ? t('groups.role_admin')
    : role === 'member' ? t('groups.role_member') : t('groups.role_unknown');
}

async function jget<T>(path: string): Promise<T> {
  const r = await fetch('/api' + path);
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.message);
  return j.data as T;
}
async function jsend(method: string, path: string, body?: unknown) {
  const r = await fetch('/api' + path, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(j.message);
  return j.data;
}

const GroupAvatar: React.FC<{ groupId: string; platform: string }> = ({ groupId, platform }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = platform === 'onebot_v11' && !imgFailed;
  return (
    <div className="h-11 w-11 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 overflow-hidden">
      {showImg ? (
        <img
          src={`https://p.qlogo.cn/gh/${groupId}/${groupId}/100`}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <Users2 className="h-5 w-5" />
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ g: Group; t: (k: string) => string }> = ({ g, t }) => {
  // C#62: 指令退群/网页退群后（记录保留）→ 已退群
  if (g.left) return <Badge variant="outline" className="rounded h-5 px-2 py-0 text-[11px] leading-5 whitespace-nowrap shrink-0 text-muted-foreground">{t('groups.status_left')}</Badge>;
  if (g.locked) return <Badge variant="destructive" className="rounded h-5 px-2 py-0 text-[11px] leading-5 whitespace-nowrap shrink-0">{t('groups.status_locked')}</Badge>;
  if (!g.enabled) return <Badge variant="secondary" className="rounded h-5 px-2 py-0 text-[11px] leading-5 whitespace-nowrap shrink-0">{t('groups.status_off')}</Badge>;
  return <Badge variant="success" className="rounded h-5 px-2 py-0 text-[11px] leading-5 whitespace-nowrap shrink-0">{t('groups.status_on')}</Badge>;
};

const Pager: React.FC<{ page: number; pages: number; onPage: (p: number) => void }> = ({ page, pages, onPage }) =>
  pages <= 1 ? null : (
    <div className="flex items-center justify-center gap-3 pt-3">
      <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
      <span className="text-sm text-muted-foreground">{page} / {pages}</span>
      <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
    </div>
  );

export const GroupsPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const dlg = useDialogs(t);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Group | null>(null);
  const [view, setView] = useState<'card' | 'table'>('card');
  const [page, setPage] = useState(1);
  const welcomeRef = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<'active' | 'archived'>('active');

  const pageSize = view === 'card' ? 12 : 15;

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await jget<Group[]>('/groups');
      setGroups(data || []);
      setSelected((cur) => cur ? (data || []).find((g) => g.groupId === cur.groupId) || cur : cur);
    } catch { toast({ title: t('common.load_fail'), variant: 'destructive' }); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { void fetchGroups(); }, [fetchGroups]);

  const put = async (g: Group, body: Record<string, unknown>, silent = false) => {
    try {
      await jsend('PUT', `/groups/${g.platform}/${g.groupId}`, { ...body, ...accountPayload(g) });
      if (!silent) toast({ title: t('common.save_success') });
      await fetchGroups();
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };

  const toggleLock = async (g: Group) => {
    if (g.locked) { void put(g, { locked: false }); return; }
    if (await dlg.confirm({ title: t('groups.lock'), description: t('groups.lock_confirm', { name: g.name }), destructive: true, confirmText: t('groups.lock') }))
      void put(g, { locked: true });
  };
  const toggleBot = (g: Group) => void put(g, { enabled: !g.enabled });

  const addTag = async (g: Group) => {
    const v = await dlg.prompt({ title: t('groups.add_remark'), placeholder: t('groups.remark_prompt') });
    if (v && v.trim()) void put(g, { remark: [...tagsOf(g), v.trim()].join(',') }, true);
  };
  const removeTag = (g: Group, tag: string) => void put(g, { remark: tagsOf(g).filter((x) => x !== tag).join(',') }, true);

  // Groups are auto-discovered from the bot's joined-group list, so there's no
  // manual "add" — this box filters the list by name / group id / remark tag.
  const q = search.trim().toLowerCase();
  const matched = q
    ? groups.filter((g) => g.name.toLowerCase().includes(q) || g.groupId.includes(q) || g.remark.toLowerCase().includes(q))
    : groups;
  const activeGroups = matched.filter((g) => !g.left);
  const archivedGroups = matched.filter((g) => g.left);
  const list = tab === 'active' ? activeGroups : archivedGroups;
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const curPage = Math.min(page, pages);
  const shown = list.slice((curPage - 1) * pageSize, curPage * pageSize);

  // ── tag chips + add button (shared by card & table) ──
  const Tags: React.FC<{ g: Group; compact?: boolean }> = ({ g, compact }) => (
    <div className="flex flex-wrap items-center gap-1">
      {tagsOf(g).map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {tag}
          <button onClick={() => removeTag(g, tag)} className="hover:text-foreground"><X className="h-3 w-3" /></button>
        </span>
      ))}
      <button onClick={() => addTag(g)}
        className="inline-flex items-center gap-1 rounded border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
        <Tag className="h-3 w-3" />{!compact && t('groups.add_remark')}
      </button>
    </div>
  );

  // ── per-group action buttons (compact) ──
  const Actions: React.FC<{ g: Group; col?: boolean }> = ({ g, col }) => (
    <div className={col ? 'flex flex-col gap-1.5 shrink-0' : 'flex items-center gap-1.5'}>
      {!g.left && (g.locked ? (
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50" onClick={() => toggleLock(g)}>
          <Power className="mr-1 h-3.5 w-3.5" />{t('groups.unlock')}
        </Button>
      ) : (
        <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => toggleLock(g)}>
          <ShieldBan className="mr-1 h-3.5 w-3.5" />{t('groups.lock')}
        </Button>
      ))}
      {!g.left && (
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={g.locked} onClick={() => toggleBot(g)}>
          {g.enabled ? <><PowerOff className="mr-1 h-3.5 w-3.5" />{t('groups.bot_off')}</>
            : <><Power className="mr-1 h-3.5 w-3.5 text-emerald-500" />{t('groups.bot_on')}</>}
        </Button>
      )}

      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelected(g)}>
        <Settings2 className="mr-1 h-3.5 w-3.5" />{t('groups.manage')}
      </Button>
    </div>
  );

  if (selected) {
    return <>{dlg.node}<GroupDetail group={selected} dlg={dlg} onBack={() => setSelected(null)} onChanged={fetchGroups} welcomeRef={welcomeRef} /></>;
  }

  return (
    <>
      {dlg.node}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Users className="h-5 w-5" />{t('groups.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('groups.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9" title={view === 'card' ? t('groups.view_table') : t('groups.view_card')}
              onClick={() => setView(view === 'card' ? 'table' : 'card')}>
              {view === 'card' ? <Table2 className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchGroups} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1 min-w-[12rem]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder={t('groups.search_placeholder')} value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <div className="flex gap-1 border-b">
            <button onClick={() => { setTab('active'); setPage(1); }}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm border-b-2 -mb-px transition-colors', tab === 'active' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              <Users2 className="h-4 w-4" />{t('groups.tab_active')}<span className="text-xs text-muted-foreground">{activeGroups.length}</span>
            </button>
            <button onClick={() => { setTab('archived'); setPage(1); }}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm border-b-2 -mb-px transition-colors', tab === 'archived' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              <LogOut className="h-4 w-4" />{t('groups.tab_archived')}<span className="text-xs text-muted-foreground">{archivedGroups.length}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Users className="h-12 w-12 mb-3" />
            <p className="text-lg mb-1">{t('groups.empty')}</p>
            <p className="text-sm">{t('groups.empty_hint')}</p>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            {tab === 'archived' ? <LogOut className="h-12 w-12 mb-3" /> : <Search className="h-12 w-12 mb-3" />}
            <p className="text-lg mb-1">{tab === 'archived' ? t('groups.archived_empty') : t('groups.no_match')}</p>
          </div>
        ) : view === 'card' ? (
          <>
            {/* C#105：卡片最小 400px，自动按容器宽度减列，防止挤压内部元素（min() 防窄屏溢出） */}
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(400px,100%),1fr))]">
              {shown.map((g) => (
                <div key={`${g.platform}/${g.groupId}`} className="rounded-lg border p-4 flex justify-between gap-3 min-h-[132px]">
                  <div className="flex flex-col justify-between min-w-0 flex-1">
                    <div>
                      <div className="flex items-start gap-2">
                        <GroupAvatar groupId={g.groupId} platform={g.platform} />
                        {/* C#105：flex-1+min-w-0 给出确定宽度，超长群名 truncate 成省略号 */}
                        <div className="min-w-0 flex-1">
                          <button onClick={() => setSelected(g)} className="font-medium text-left hover:text-primary transition-colors truncate block max-w-full">{g.name}</button>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <StatusBadge g={g} t={t} />
                            <span className="inline-flex min-w-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                              <PlatformIcon platform={g.platform} />
                              <span className="truncate font-mono text-muted-foreground">{g.groupId}</span>
                            </span>
                            {(g.accounts?.length || 0) > 1 && <Badge variant="outline" className="text-[10px]">{t('groups.account_count', { count: g.accounts!.length })}</Badge>}
                            {g.activeLog && <Badge variant="secondary" className="text-[10px]">{t('groups.recording')}</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>{t('groups.members_label')}: {g.memberCount || '—'}</span>
                        <span>{t('groups.perm_label')}: {roleLabel(t, g.botRole)}</span>
                        {g.observers > 0 && <span>{t('groups.observers_label')}: {g.observers}</span>}
                      </div>
                    </div>
                    <div className="mt-2"><Tags g={g} /></div>
                  </div>
                  <Actions g={g} col />
                </div>
              ))}
            </div>
            <Pager page={curPage} pages={pages} onPage={setPage} />
          </>
        ) : (
          <>
            <div className="rounded-lg border overflow-x-auto">
              <table className="rt w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium p-2.5 w-24">{t('groups.col_status')}</th>
                    <th className="text-left font-medium p-2.5 w-10">{t('groups.col_avatar')}</th>
                    <th className="text-left font-medium p-2.5">{t('groups.col_group')}</th>
                    <th className="text-left font-medium p-2.5 w-16">{t('groups.members_label')}</th>
                    <th className="text-left font-medium p-2.5 w-20">{t('groups.perm_label')}</th>
                    <th className="text-right font-medium p-2.5">{t('groups.col_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((g) => (
                    <tr key={`${g.platform}/${g.groupId}`} className="border-t hover:bg-muted/30">
                      <td data-label={t('groups.col_status')} className="p-2.5"><StatusBadge g={g} t={t} /></td>
                      <td data-label={t('groups.col_avatar')} className="p-2.5"><div className="h-8 w-8 rounded-md overflow-hidden bg-muted shrink-0">
                        {g.platform === 'onebot_v11' ? <img src={`https://p.qlogo.cn/gh/${g.groupId}/${g.groupId}/100`} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <Users2 className="h-5 w-5 m-1.5 text-muted-foreground" />}
                      </div></td>
                      <td data-label={t('groups.col_group')} className="p-2.5">
                        <button onClick={() => setSelected(g)} className="font-medium hover:text-primary transition-colors">{g.name}</button>
                        <div className="mt-1"><Tags g={g} compact /></div>
                      </td>
                      <td data-label={t('groups.members_label')} className="p-2.5">{g.memberCount || '—'}</td>
                      <td data-label={t('groups.perm_label')} className="p-2.5">{roleLabel(t, g.botRole)}</td>
                      <td data-label={t('common.actions')} className="p-2.5"><div className="flex flex-wrap justify-end"><Actions g={g} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={curPage} pages={pages} onPage={setPage} />
          </>
        )}
      </div>
    </>
  );
};

// ─── Detail view: 功能管理 / 人员管理 / 模拟聊天 ────────────────
const GroupDetail: React.FC<{ group: Group; dlg: any; onBack: () => void; onChanged: () => void; welcomeRef: React.RefObject<HTMLTextAreaElement> }> = ({ group, dlg, onBack, onChanged, welcomeRef }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [tab, setTab] = useState<'function' | 'plugins' | 'members' | 'qqadmin' | 'logs' | 'chat' | 'ai' | 'files'>('function');
  const accounts = group.accounts?.length ? group.accounts : [{
    adapterId: '', adapterName: '', loginId: '', platform: group.platform, endpointId: group.groupId,
    connected: false, enabled: group.enabled, ai_enabled: group.ai_enabled, locked: group.locked,
    card: group.card, activeLog: group.activeLog, observers: group.observers, botRole: group.botRole,
    memberCount: group.memberCount, inviter: group.inviter, locale: group.locale, left: group.left,
    welcome: group.welcome, welcome_delay: group.welcome_delay, welcome_cooldown: group.welcome_cooldown,
  } satisfies GroupAccount];
  const [accountId, setAccountId] = useState(() => (accounts.find((a) => a.connected && !a.left) || accounts[0]).adapterId);
  const account = accounts.find((a) => a.adapterId === accountId) || accounts[0];
  const activeGroup: Group = { ...group, ...account, platform: account.platform, accounts: group.accounts };
  const base = `/groups/${activeGroup.platform}/${group.groupId}`;
  const scopedBody = { adapterId: account.adapterId, endpointId: account.endpointId };
  // 平台能力位：按能力隐藏该平台不支持的 tab（成员列表/群文件），取不到时全显示。
  const [caps, setCaps] = useState<Record<string, Record<string, boolean>> | null>(null);
  useEffect(() => {
    fetch('/api/platform-caps').then((r) => r.json())
      .then((j) => setCaps(j.data || {})).catch(() => setCaps(null));
  }, []);
  const pcaps = caps?.[activeGroup.platform];
  const tabVisible = (k: string) => {
    if (!pcaps) return true;
    if (k === 'members') return pcaps.member_list !== false;
    if (k === 'files') return pcaps.group_file !== false;
    if (k === 'qqadmin') return pcaps.qq_group_admin === true;
    return true;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <GroupAvatar groupId={group.groupId} platform={activeGroup.platform} />
        <div>
          <h1 className="text-xl font-bold tracking-tight leading-tight">{group.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <StatusBadge g={activeGroup} t={t} />
            <span className="inline-flex min-w-0 items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
              <PlatformIcon platform={activeGroup.platform} />
              <span className="truncate font-mono text-muted-foreground">{group.groupId}</span>
            </span>
            {group.bindings && group.bindings.length > 0 && (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>已绑定：</span>
                {group.bindings.map((b) => (
                  <span key={`${b.adapterType}:${b.adapterAccount}:${b.endpointId}`} className="inline-flex items-center gap-1">
                    <PlatformIcon platform={b.adapterType} className="h-3.5 w-3.5" />
                    {platformLabel(b.adapterType)} {b.adapterAccount}:{b.endpointId}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/20 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">{t('groups.account_scope')}</div>
          <p className="text-xs text-muted-foreground">{t('groups.account_scope_hint')}</p>
        </div>
        <Select value={account.adapterId || '__legacy__'} onValueChange={(v) => setAccountId(v === '__legacy__' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-[320px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {accounts.map((a) => {
              const idPart = a.platform === 'qq_official' ? (a.appId || a.loginId) : a.loginId;
              const nick = a.loginName || a.adapterName || platformLabel(a.platform);
              return (
              <SelectItem key={a.adapterId || '__legacy__'} value={a.adapterId || '__legacy__'} className="pr-2">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <PlatformIcon platform={a.platform} className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{nick}{idPart ? `(${idPart})` : ''}</span>
                </span>
              </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-1 border-b">
        {([['function', Settings2, t('groups.tab_function')], ['ai', Sparkles, t('groups.tab_ai')], ['plugins', Blocks, t('groups.tab_plugins')], ['members', Users, t('groups.tab_members')], ['qqadmin', ShieldCheck, '官方群管'], ['logs', ScrollText, t('groups.tab_logs')], ['files', FolderOpen, t('groups.tab_files')], ['chat', MessagesSquare, t('groups.tab_chat')]] as const).filter(([k]) => tabVisible(k)).map(([k, Icon, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {tab === 'function' && <FunctionTab group={activeGroup} base={base} scopedBody={scopedBody} onChanged={onChanged} onBack={onBack} goChat={() => setTab('chat')} t={t} toast={toast} dlg={dlg} welcomeRef={welcomeRef} />}
      {tab === 'ai' && <AiGroupTab group={activeGroup} base={base} scopedBody={scopedBody} onChanged={onChanged} t={t} toast={toast} dlg={dlg} />}
      {tab === 'plugins' && <PluginsTab group={activeGroup} adapterId={account.adapterId} t={t} toast={toast} />}
      {tab === 'members' && <MembersTab base={base} adapterId={account.adapterId} endpointId={account.endpointId} t={t} toast={toast} dlg={dlg} />}
      {tab === 'qqadmin' && <QQOfficialAdminTab base={base} adapterId={account.adapterId} endpointId={account.endpointId} toast={toast} dlg={dlg} />}
      {tab === 'logs' && <LogsTab group={group} t={t} toast={toast} dlg={dlg} />}
      {tab === 'files' && <FilesTab base={base} t={t} toast={toast} />}
      {tab === 'chat' && <ChatTab base={base} platform={group.platform} t={t} toast={toast}
        channelKey={`${account.platform}:${account.adapterId}`}
        channels={accounts.map((a) => ({
          key: `${a.platform}:${a.adapterId}`, platform: a.platform, adapterAccount: a.adapterId,
          endpointId: a.endpointId,
          base: `/groups/${encodeURIComponent(a.platform)}/${encodeURIComponent(group.groupId)}`,
          label: (() => {
            const idPart = a.platform === 'qq_official' ? (a.appId || a.loginId) : a.loginId;
            const nick = a.loginName || a.adapterName || platformLabel(a.platform);
            return `${nick}${idPart ? `(${idPart})` : ''}`;
          })(),
        }))} />}
    </div>
  );
};

// ── 插件分群启停（C#27 地基）──
// C#84：分群「人工智能」选项卡 —— 本群 AI 开关 + 群记忆（摘要/事实）查看与清空。
interface GMemItem { content: string; }
const AiGroupTab: React.FC<any> = ({ group, base, scopedBody, onChanged, t, toast, dlg }) => {
  const [aiOn, setAiOn] = useState(group.ai_enabled !== false);
  const [summaries, setSummaries] = useState<GMemItem[]>([]);
  const [facts, setFacts] = useState<GMemItem[]>([]);
  const [busy, setBusy] = useState(false);
  const scopeId = `${group.platform}:${group.groupId}`;
  const toggle = async (v: boolean) => {
    setAiOn(v);
    try { await jsend('PUT', base, { ai_enabled: v, ...scopedBody }); onChanged(); }
    catch (e) { setAiOn(!v); toast({ title: String(e), variant: 'destructive' }); }
  };
  const loadMem = useCallback(async () => {
    setBusy(true);
    try {
      const s = await jsend('GET', `/system/ai/memory?kind=summary&scope_id=${encodeURIComponent(scopeId)}`);
      const f = await jsend('GET', `/system/ai/memory?kind=fact&scope_id=${encodeURIComponent(scopeId)}`);
      setSummaries(s?.items || []); setFacts(f?.items || []);
    } catch (e) { toast({ title: String(e), variant: 'destructive' }); }
    finally { setBusy(false); }
  }, [scopeId, toast]);
  const clearMem = async () => {
    if (!(await dlg.confirm({ title: t('groups.ai_clear'), description: t('groups.ai_clear_confirm', { name: group.name }), destructive: true, confirmText: t('groups.ai_clear') }))) return;
    setBusy(true);
    try { await jsend('DELETE', `/system/ai/memory?scope_id=${encodeURIComponent(scopeId)}`); setSummaries([]); setFacts([]); toast({ title: t('common.save_success') }); }
    catch (e) { toast({ title: String(e), variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  useEffect(() => { loadMem(); }, [loadMem]);
  const empty = summaries.length === 0 && facts.length === 0;
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between rounded-md border p-3">
        <div className="pr-4">
          <div className="text-sm font-medium">{t('groups.ai_switch')}</div>
          <p className="text-xs text-muted-foreground mt-0.5">{t('groups.ai_switch_desc')}</p>
        </div>
        <Switch checked={aiOn} onCheckedChange={toggle} />
      </div>
      <div className="rounded-md border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{t('groups.ai_memory')}</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={loadMem}>{t('groups.ai_refresh')}</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" disabled={busy || empty} onClick={clearMem}>{t('groups.ai_clear')}</Button>
          </div>
        </div>
        {empty ? (
          <p className="text-xs text-muted-foreground">{t('groups.ai_no_memory')}</p>
        ) : (
          <div className="space-y-1.5">
            {summaries.map((s, i) => (
              <div key={'s' + i} className="rounded border bg-muted/40 p-2 text-xs whitespace-pre-wrap">
                <span className="font-medium text-muted-foreground mr-1">{t('groups.ai_summary')}:</span>{s.content}
              </div>
            ))}
            {facts.map((f, i) => (
              <div key={'f' + i} className="rounded border bg-muted/40 px-2 py-1 text-xs">{f.content}</div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">{t('groups.ai_memory_note')}</p>
      </div>
    </div>
  );
};

interface GroupPlugin { id: string; name: string; kind: 'js' | 'lua'; enabledGlobal: boolean; enabledInGroup: boolean; }
const PluginsTab: React.FC<any> = ({ group, adapterId, t, toast }) => {
  const [plugins, setPlugins] = useState<GroupPlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ platform: group.platform, group: group.groupId, adapterId: adapterId || '' });
      const d = await jget<{ plugins: GroupPlugin[] }>('/groups/plugins?' + p.toString());
      setPlugins(d.plugins || []);
    } catch (e) { toast({ title: String(e), variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [group.platform, group.groupId, adapterId, toast]);
  useEffect(() => { void load(); }, [load]);

  const toggle = async (pl: GroupPlugin, on: boolean) => {
    setPlugins((arr) => arr.map((x) => (x.id === pl.id ? { ...x, enabledInGroup: on } : x)));   // 乐观更新
    try {
      await jsend('POST', '/groups/plugins/toggle', { platform: group.platform, group: group.groupId, adapterId, pluginId: pl.id, enabled: on });
    } catch (e) {
      setPlugins((arr) => arr.map((x) => (x.id === pl.id ? { ...x, enabledInGroup: !on } : x)));   // 回滚
      toast({ title: String(e), variant: 'destructive' });
    }
  };

  const s = q.trim().toLowerCase();
  const shown = s ? plugins.filter((p) => p.name.toLowerCase().includes(s) || p.id.toLowerCase().includes(s)) : plugins;
  const offCount = plugins.filter((p) => !p.enabledInGroup).length;

  return (
    <div className="space-y-3 max-w-2xl">
      <p className="text-sm text-muted-foreground">{t('groups.plugins_hint')}</p>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="h-9 pl-8" placeholder={t('groups.plugins_search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}
        </Button>
        <span className="text-xs text-muted-foreground">{t('groups.plugins_off_count', { n: offCount })}</span>
      </div>
      <div className="grid gap-1.5">
        {shown.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
            {p.kind === 'lua' ? <Moon className="h-4 w-4 shrink-0 text-blue-500" /> : <Blocks className="h-4 w-4 shrink-0 text-amber-500" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate text-sm font-medium">{p.name}</span>
                {!p.enabledGlobal && <Badge variant="outline" className="text-[10px] shrink-0">{t('groups.plugins_global_off')}</Badge>}
              </div>
              <p className="truncate text-[11px] text-muted-foreground font-mono">{p.id}</p>
            </div>
            <Switch checked={p.enabledInGroup} onCheckedChange={(v) => toggle(p, v)} />
          </div>
        ))}
        {shown.length === 0 && !loading && <p className="py-6 text-center text-sm text-muted-foreground">{t('groups.plugins_empty')}</p>}
      </div>
    </div>
  );
};

// ── 功能管理 ──
const FunctionTab: React.FC<any> = ({ group, base, scopedBody, onChanged, onBack, goChat, t, toast, dlg, welcomeRef }) => {
  const [card, setCard] = useState(group.card || '');
  const [editingCard, setEditingCard] = useState(false);   // C#50: 名片默认只读，点「修改」才编辑
  const [botNick, setBotNick] = useState('');               // 骰娘 QQ 本身昵称（无群名片时展示）
  const [leaveOpen, setLeaveOpen] = useState(false);        // C#50: 退群二次确认弹窗
  const [leaving, setLeaving] = useState(false);
  // C#49: 本群回复语言（空=默认）；下拉项来自后端已加载语言（含自定义翻译文件 C#46）。
  const [locale, setLocale] = useState<string>(group.locale || '');
  const [locales, setLocales] = useState<{ code: string; name: string }[]>([]);
  const [personas, setPersonas] = useState<PersonaTemplate[]>([]);
  const [personaInfo, setPersonaInfo] = useState<ActivePersonaInfo | null>(null);
  const [personaLoading, setPersonaLoading] = useState(true);
  // Bound cross-platform groups may have a logical groupId that differs from
  // the selected adapter's real endpoint. Runtime persona lookup uses the
  // message targetId, so the editor must use that same endpoint here.
  const personaTargetId = group.endpointId || group.groupId;
  useEffect(() => {
    (async () => {
      try { const d = await jget<{ code: string; name: string }[]>('/i18n/locales'); setLocales(d || []); }
      catch { /* ignore */ }
    })();
  }, []);

  const loadPersonaState = useCallback(async () => {
    setPersonaLoading(true);
    try {
      const params = new URLSearchParams({ groupId: personaTargetId, platform: group.platform });
      const [templates, active] = await Promise.all([
        jget<PersonaTemplate[]>('/personas'),
        jget<ActivePersonaInfo>('/personas/active?' + params.toString()),
      ]);
      setPersonas(templates || []);
      setPersonaInfo(active);
    } catch (e) {
      toast({ title: t('groups.persona_load_fail'), description: String(e), variant: 'destructive' });
    } finally {
      setPersonaLoading(false);
    }
  }, [personaTargetId, group.platform, t, toast]);

  useEffect(() => { void loadPersonaState(); }, [loadPersonaState]);

  const setGroupPersona = async (value: string) => {
    setPersonaLoading(true);
    try {
      if (value === '__inherit__') {
        const params = new URLSearchParams({ groupId: personaTargetId, platform: group.platform });
        await jsend('DELETE', '/personas/active?' + params.toString());
      } else {
        const personaId = value === '__off__' ? 0 : Number(value);
        await jsend('POST', `/personas/${personaId}/activate`, {
          groupId: personaTargetId,
          platform: group.platform,
        });
      }
      await loadPersonaState();
      toast({ title: t('groups.persona_saved') });
    } catch (e) {
      toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' });
      setPersonaLoading(false);
    }
  };

  const hasPersonaOverride = personaInfo?.hasGroupOverride === true;
  const personaSelection = !hasPersonaOverride
    ? '__inherit__'
    : personaInfo && personaInfo.activeId > 0 ? String(personaInfo.activeId) : '__off__';
  const effectivePersona = personaInfo && personaInfo.activeId > 0
    ? (personas.find((p) => p.id === personaInfo.activeId)?.name || personaInfo.name || t('persona.global_unknown_name'))
    : t('persona.global_base_name');
  const globalPersona = personaInfo && personaInfo.globalId > 0
    ? (personas.find((p) => p.id === personaInfo.globalId)?.name || t('persona.global_unknown_name'))
    : t('persona.global_base_name');

  // Fetch the bot's own nickname for this platform (fallback display when no group card).
  useEffect(() => {
    (async () => {
      try {
        const list = await jget<any[]>('/adapters');
        const a = (list || []).find((x) => x.platform === group.platform && x.loginName) || (list || []).find((x) => x.loginName);
        if (a?.loginName) setBotNick(a.loginName);
      } catch { /* ignore — fallback stays empty */ }
    })();
  }, [group.platform]);

  const save = async (body: Record<string, unknown>) => {
    try { await jsend('PUT', base, { ...body, ...scopedBody }); toast({ title: t('common.save_success') }); onChanged(); }
    catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };
  const doLeave = async (removeRecord: boolean) => {
    setLeaving(true);
    try {
      await jsend('POST', `${base}/action`, { action: 'leave', ...scopedBody });
      if (removeRecord) await jsend('DELETE', base, scopedBody);
      setLeaveOpen(false); onChanged(); onBack();
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setLeaving(false); }
  };

  return (
    <div className="space-y-4 max-w-xl">
      <div className="space-y-1">
        <label className="text-sm font-medium">{t('groups.bot_card')}</label>
        <p className="text-xs text-muted-foreground">{t('groups.bot_card_hint')}</p>
        {editingCard ? (
          <div className="flex gap-2">
            <Input value={card} onChange={(e) => setCard(e.target.value)} placeholder={botNick || t('groups.bot_card')} autoFocus />
            <Button onClick={() => { void save({ card }); setEditingCard(false); }}>{t('common.save')}</Button>
            <Button variant="ghost" onClick={() => { setCard(group.card || ''); setEditingCard(false); }}>{t('common.cancel')}</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              {group.card
                ? group.card
                : <span className="text-muted-foreground">{botNick || t('groups.card_none')}<span className="ml-1 text-xs">({t('groups.card_uses_nick')})</span></span>}
            </div>
            <Button variant="outline" onClick={() => setEditingCard(true)}><Pencil className="mr-2 h-4 w-4" />{t('common.edit')}</Button>
          </div>
        )}
      </div>
      {/* C#47: 群邀请人（头像 + QQ），其群权限 = 群管理员 */}
      {group.inviter && (
        <div className="space-y-1">
          <label className="text-sm font-medium">{t('groups.inviter')}</label>
          <p className="text-xs text-muted-foreground">{t('groups.inviter_hint')}</p>
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <img src={`https://q1.qlogo.cn/g?b=qq&nk=${group.inviter}&s=100`} alt=""
              className="h-8 w-8 rounded-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span className="text-sm font-mono">{group.inviter}</span>
            <Badge variant="secondary" className="ml-auto text-[10px]">{t('groups.role_admin')}</Badge>
          </div>
        </div>
      )}

      {/* C#49: 本群回复语言（写 locale_settings，热生效） */}
      <div className="space-y-1">
        <label className="text-sm font-medium">{t('groups.group_locale')}</label>
        <p className="text-xs text-muted-foreground">{t('groups.group_locale_hint')}</p>
        <Select value={locale || '__default__'} onValueChange={(v) => {
          const lc = v === '__default__' ? '' : v;
          setLocale(lc); void save({ locale: lc });
        }}>
          <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">{t('groups.locale_default')}</SelectItem>
            {locales.map((l) => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          {t('groups.group_persona')}
        </label>
        <p className="text-xs text-muted-foreground">{t('groups.group_persona_hint')}</p>
        <Select value={personaSelection} onValueChange={(value) => { void setGroupPersona(value); }} disabled={personaLoading || !personaInfo}>
          <SelectTrigger className="h-9 w-full sm:w-80">
            <SelectValue placeholder={personaLoading ? t('common.loading') : t('groups.persona_select')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__inherit__">{t('groups.persona_inherit', { name: globalPersona })}</SelectItem>
            <SelectItem value="__off__">{t('groups.persona_off')}</SelectItem>
            {personas.map((persona) => (
              <SelectItem key={persona.id} value={String(persona.id)}>{persona.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {personaInfo && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{t('groups.persona_effective', { name: effectivePersona })}</span>
            <Badge variant={hasPersonaOverride ? 'secondary' : 'outline'} className="text-[10px]">
              {hasPersonaOverride ? t('groups.persona_source_group') : t('groups.persona_source_global')}
            </Badge>
          </div>
        )}
      </div>


      {/* C#76: Welcome settings */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium">{t('groups.welcome_settings')}</label>
            <p className="text-xs text-muted-foreground">{t('groups.welcome_settings_hint')}</p>
          </div>
          <Switch checked={!!group.welcome} onCheckedChange={(v) => void save({ welcome: v ? t('groups.welcome_default_text') : '' })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('groups.welcome_text')}</Label>
          <Textarea ref={welcomeRef} className="text-sm min-h-[72px] resize-y" value={group.welcome || ''} onChange={(e) => void save({ welcome: e.target.value })} placeholder={t('groups.welcome_text_ph')} />
          <div className="flex flex-wrap gap-1.5">
            {([['{at}','groups.var_at'],['{user}','groups.var_user'],['{nick}','groups.var_nick']] as const).map(([token, label]) => (
              <button key={token} type="button" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted hover:bg-muted/80 transition-colors font-mono" onClick={() => {
                const el = welcomeRef.current; if (!el) return;
                const v = group.welcome || ''
                const s = el.selectionStart ?? v.length
                const nv = v.slice(0, s) + token + v.slice(el.selectionEnd ?? s)
                void save({ welcome: nv })
                requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length) })
              }}>
                <span className="text-primary">{token}</span>
                <span className="text-muted-foreground">{t(label)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-muted-foreground">{t('groups.welcome_delay')}</Label>
            <Input className="h-8 text-sm" type="number" min={group.welcome_min_delay || 0} max={300} value={group.welcome_delay || ''} onChange={(e) => void save({ welcome_delay: e.target.value })} placeholder="0" />
            {(group.welcome_min_delay ?? 0) > 0 && <span className="text-[10px] text-muted-foreground">{t("groups.welcome_min_hint", { min: group.welcome_min_delay })}</span>}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('groups.welcome_cooldown')}</Label>
            <Input className="h-8 text-sm" type="number" min={group.welcome_min_cooldown || 0} max={3600} value={group.welcome_cooldown || ''} onChange={(e) => void save({ welcome_cooldown: e.target.value })} placeholder="0" />
            {(group.welcome_min_cooldown ?? 0) > 0 && <span className="text-[10px] text-muted-foreground">{t("groups.welcome_min_hint", { min: group.welcome_min_cooldown })}</span>}
          </div>
        </div>
      </div>
      <div className="space-y-2 pt-2 border-t">
        <label className="text-sm font-medium">{t('groups.danger_zone')}</label>
        <div className="flex flex-wrap gap-2">
          {/* C#50: 发消息 → 跳转到模拟聊天页 */}
          <Button variant="outline" onClick={() => goChat?.()}><Send className="mr-2 h-4 w-4" />{t('groups.send_message')}</Button>
          {/* C#50: 退群二次确认（两种选项） */}
          <Button variant="outline" onClick={() => setLeaveOpen(true)}><LogOut className="mr-2 h-4 w-4" />{t('groups.leave')}</Button>
          <Button variant="ghost" className="text-muted-foreground" onClick={async () => {
            if (!await dlg.confirm({ title: t('groups.remove'), description: t('groups.remove_confirm', { id: group.groupId }) })) return;
            try { await jsend('DELETE', base, scopedBody); onChanged(); onBack(); } catch (e) { toast({ title: t('common.delete_fail'), description: String(e), variant: 'destructive' }); }
          }}>{t('groups.remove')}</Button>
        </div>
      </div>

      {/* C#50: 退群二次确认弹窗 —— 退群并移除记录 / 仅退群保留记录 */}
      <Dialog open={leaveOpen} onOpenChange={(o) => { if (!leaving) setLeaveOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('groups.leave_title', { name: group.name })}</DialogTitle>
            <DialogDescription>{t('groups.leave_desc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button variant="destructive" disabled={leaving} onClick={() => doLeave(true)} className="w-full">
              <Trash2 className="mr-2 h-4 w-4" />{t('groups.leave_and_remove')}
            </Button>
            <Button variant="outline" disabled={leaving} onClick={() => doLeave(false)} className="w-full">
              <LogOut className="mr-2 h-4 w-4" />{t('groups.leave_keep_record')}
            </Button>
            <Button variant="ghost" disabled={leaving} onClick={() => setLeaveOpen(false)} className="w-full">{t('common.cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── 人员管理 ──
const MembersTab: React.FC<any> = ({ base, adapterId, endpointId, t, toast, dlg }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [botRole, setBotRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ adapterId: adapterId || '', endpointId: endpointId || '' });
      const d = await jget<{ botRole: string; members: Member[] }>(`${base}/members?${query}`);
      setBotRole(d.botRole); setMembers(d.members || []);
      if ((d.members || []).length === 0) {
        setTimeout(async () => {
          try { const d2 = await jget<{ botRole: string; members: Member[] }>(`${base}/members?${query}`); setBotRole(d2.botRole); setMembers(d2.members || []); } catch { /* ignore */ }
        }, 2000);
      }
    } catch (e) { toast({ title: t('common.load_fail'), description: String(e), variant: 'destructive' }); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, adapterId, endpointId]);
  useEffect(() => { void load(); }, [load]);

  const canManage = botRole === 'admin' || botRole === 'owner';
  const isOwner = botRole === 'owner';
  const act = async (userId: string, action: string, extra: Record<string, unknown> = {}) => {
    try { await jsend('POST', `${base}/member-action`, { userId, action, adapterId, endpointId, ...extra }); toast({ title: t('common.save_success') }); }
    catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };
  const filtered = members
    .filter((m) => !filter || m.nickname.includes(filter) || m.card.includes(filter) || m.userId.includes(filter))
    .sort((a, b) => {
      const rank = (r: string) => r === 'owner' ? 0 : r === 'admin' ? 1 : 2;
      const r = rank(a.role) - rank(b.role);
      if (r !== 0) return r;
      return (parseInt(a.userId, 10) || 0) - (parseInt(b.userId, 10) || 0);
    });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const curPage = Math.min(page, pages);
  const shown = filtered.slice((curPage - 1) * pageSize, curPage * pageSize);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t('groups.bot_role')}: <b>{roleLabel(t, botRole)}</b> · {members.length} {t('groups.members_count')}
          {!canManage && <span className="ml-2 text-amber-600">{t('groups.no_perm')}</span>}
        </p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}</Button>
      </div>
      <Input className="max-w-xs" placeholder={t('groups.member_search')} value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} />
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="space-y-1">
            {shown.map((m) => (
              <div key={m.userId} className="flex items-center justify-between gap-2 rounded border p-2.5">
                <div className="min-w-0 flex items-center gap-2">
                  <img
                    src={`https://q1.qlogo.cn/g?b=qq&nk=${m.userId}&s=100`}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover shrink-0 bg-muted"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className={cn(
                    'font-medium truncate',
                    m.role === 'owner' && 'text-amber-600',
                    m.role === 'admin' && 'text-emerald-600',
                  )}>{m.card || m.nickname}</span>
                  <span className="text-xs text-muted-foreground">{m.userId}</span>
                  {m.role === 'owner' && (
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">{t('groups.role_owner')}</span>
                  )}
                  {m.role === 'admin' && (
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">{t('groups.role_admin')}</span>
                  )}
                  {m.title && <Badge variant="secondary">{m.title}</Badge>}
                </div>
                {canManage && m.role !== 'owner' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={async () => { const min = await dlg.prompt({ title: t('groups.act_ban'), description: t('groups.ban_prompt'), defaultValue: '10' }); if (min !== null) void act(m.userId, 'ban', { duration: Math.max(0, parseInt(min) || 0) * 60 }); }}>{t('groups.act_ban')}</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void act(m.userId, 'unban')}>{t('groups.act_unban')}</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={async () => { const c = await dlg.prompt({ title: t('groups.act_card'), description: t('groups.card_prompt'), defaultValue: m.card }); if (c !== null) void act(m.userId, 'card', { card: c }); }}>{t('groups.act_card')}</Button>
                    {isOwner && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={async () => { const ti = await dlg.prompt({ title: t('groups.act_title'), description: t('groups.title_prompt'), defaultValue: m.title }); if (ti !== null) void act(m.userId, 'title', { title: ti }); }}>{t('groups.act_title')}</Button>}
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={async () => { if (await dlg.confirm({ title: t('groups.act_kick'), description: t('groups.kick_confirm'), destructive: true, confirmText: t('groups.act_kick') })) void act(m.userId, 'kick'); }}>{t('groups.act_kick')}</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <Pager page={curPage} pages={pages} onPage={setPage} />
        </>
      )}
    </div>
  );
};

// ── QQ 官方机器人 2.0 群管理（2026-08-10 API）──
interface QQMuteMember { member_openid: string; username?: string; mute_expire_at?: string; union_openid?: string; }
interface QQJoinRequest {
  join_request_id: string; member_openid: string; username?: string; apply_at?: string;
  apply_source?: string; invited_by?: string; risk_tips?: string; bot?: boolean;
  verify_info?: { method?: string; verify_message?: string; review_qa_list?: { question?: string; answer?: string }[] };
}
interface QQJoinStrategy {
  strategy_id: string; group_openids?: string[]; group_ids?: Array<string | number>;
  whitelist_user_count?: number; is_enable?: 'on' | 'off'; expire_at?: string;
  created_at?: string; updated_at?: string; remark?: string;
}
const QQOfficialAdminTab: React.FC<any> = ({ base, adapterId, endpointId, toast, dlg }) => {
  const [section, setSection] = useState<'requests' | 'mute' | 'strategies'>('requests');
  const [loading, setLoading] = useState(false);
  const [muteData, setMuteData] = useState<any>({ global_rule: {}, members: [] });
  const [requests, setRequests] = useState<QQJoinRequest[]>([]);
  const [strategies, setStrategies] = useState<QQJoinStrategy[]>([]);
  const [memberOpenId, setMemberOpenId] = useState('');
  const [muteMinutes, setMuteMinutes] = useState('10');
  const apiPath = `${base}/qq-official-admin`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ section, adapterId: adapterId || '', endpointId: endpointId || '', limit: '100' });
      const d = await jget<any>(`${apiPath}?${q}`);
      if (section === 'mute') setMuteData({ global_rule: d?.global_rule || {}, members: d?.members || [] });
      else if (section === 'requests') setRequests(d?.list || []);
      else setStrategies(d?.strategies || []);
    } catch (e) {
      toast({ title: '加载 QQ 官方群管理数据失败', description: String(e), variant: 'destructive' });
    } finally { setLoading(false); }
  }, [section, adapterId, endpointId, apiPath, toast]);
  useEffect(() => { void load(); }, [load]);

  const post = async (body: Record<string, unknown>, success = '操作成功') => {
    try {
      await jsend('POST', apiPath, { adapterId, endpointId, ...body });
      toast({ title: success });
      await load();
      return true;
    } catch (e) {
      toast({ title: '操作失败', description: String(e), variant: 'destructive' });
      return false;
    }
  };
  const setMute = async () => {
    const minutes = Math.max(1, Number.parseInt(muteMinutes, 10) || 10);
    if (!memberOpenId.trim()) return;
    const expire = new Date(Date.now() + minutes * 60_000).toISOString();
    if (await post({ action: 'setMute', members: [{ op: 'add', member_openid: memberOpenId.trim(), mute_expire_at: expire }] }, '已设置禁言')) setMemberOpenId('');
  };
  const unmute = (id: string) => post({ action: 'setMute', members: [{ op: 'del', member_openid: id, mute_expire_at: '' }] }, '已解除禁言');
  const approve = (r: QQJoinRequest) => post({ action: 'approveJoin', memberOpenId: r.member_openid, joinRequestId: r.join_request_id, op: 'approve' }, '已通过入群申请');
  const decline = async (r: QQJoinRequest) => {
    const reason = await dlg.prompt({ title: '拒绝入群申请', description: '可填写拒绝理由；留空也可拒绝。', defaultValue: '' });
    if (reason === null) return;
    await post({ action: 'approveJoin', memberOpenId: r.member_openid, joinRequestId: r.join_request_id, op: 'decline', rejectReason: reason }, '已拒绝入群申请');
  };
  const createStrategy = async () => {
    const remark = await dlg.prompt({ title: '创建自动审批策略', description: '策略将关联当前官方群；命中白名单 QQ 的申请会自动通过。', defaultValue: '' });
    if (remark === null) return;
    await post({ action: 'createStrategy', body: { group_openids: [endpointId], is_enable: 'on', remark } }, '已创建自动审批策略');
  };
  const editRemark = async (s: QQJoinStrategy) => {
    const remark = await dlg.prompt({ title: '修改策略备注', defaultValue: s.remark || '' });
    if (remark !== null) await post({ action: 'updateStrategy', strategyId: s.strategy_id, body: { remark } });
  };
  const whitelist = async (s: QQJoinStrategy, op: 'add' | 'del') => {
    const value = await dlg.prompt({ title: op === 'add' ? '增加白名单 QQ' : '移除白名单 QQ', description: '可用逗号、空格或换行分隔多个 QQ 号。', defaultValue: '' });
    if (value === null) return;
    const users = value.split(/[\s,，]+/).map((v: string) => v.trim()).filter((v: string) => /^\d+$/.test(v));
    if (!users.length) return;
    await post({ action: 'updateWhitelist', strategyId: s.strategy_id, op, whitelistUsers: users }, '白名单已更新');
  };
  const verifyText = (r: QQJoinRequest) => {
    const v = r.verify_info;
    if (!v) return '无验证信息';
    if (v.verify_message) return v.verify_message;
    const qa = (v.review_qa_list || []).map((x) => `${x.question || '问题'}：${x.answer || '—'}`).join('\n');
    return qa || '无验证信息';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">QQ 官方群管理</div>
          <p className="text-xs text-muted-foreground">机器人必须是群管理员；接口权限和频率限制由 QQ 官方平台控制。</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />刷新</Button>
      </div>
      <div className="flex gap-1 border-b overflow-x-auto">
        {([['requests', UserPlus, '入群申请'], ['mute', ShieldBan, '群禁言'], ['strategies', ShieldCheck, '自动审批策略']] as const).map(([key, Icon, label]) => (
          <button key={key} onClick={() => setSection(key)} className={cn('flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm -mb-px', section === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : section === 'requests' ? (
        <div className="space-y-2">
          {requests.length === 0 ? <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">当前没有待处理的入群申请</div> : requests.map((r) => (
            <div key={r.join_request_id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium">{r.username || '申请人'} <span className="font-mono text-xs text-muted-foreground">{r.member_openid}</span></div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{verifyText(r)}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>{r.apply_source === 'invited' ? '受邀加入' : '主动申请'}</span>
                    {r.apply_at && <span>{new Date(r.apply_at).toLocaleString()}</span>}
                    {r.invited_by && <span>邀请人：{r.invited_by}</span>}
                    {r.risk_tips && <span className="text-amber-600">{r.risk_tips}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => void approve(r)}>通过</Button>
                  <Button size="sm" variant="destructive" onClick={() => void decline(r)}>拒绝</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : section === 'mute' ? (
        <div className="space-y-4">
          <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
            <div className="space-y-1"><Label>成员 OpenID</Label><Input value={memberOpenId} onChange={(e) => setMemberOpenId(e.target.value)} placeholder="member_openid" /></div>
            <div className="space-y-1"><Label>禁言分钟数</Label><Input inputMode="numeric" value={muteMinutes} onChange={(e) => setMuteMinutes(e.target.value.replace(/\D/g, ''))} /></div>
            <Button onClick={() => void setMute()} disabled={!memberOpenId.trim()}>设置禁言</Button>
          </div>
          <div className="rounded-lg border p-3 text-sm">全员禁言模式：<b>{muteData.global_rule?.mode || 'none'}</b></div>
          {(muteData.members as QQMuteMember[]).length === 0 ? <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">当前没有处于禁言中的成员</div> : (
            <div className="rounded-lg border overflow-x-auto"><table className="rt w-full text-sm"><thead className="bg-muted/50"><tr><th className="p-2.5 text-left">成员</th><th className="p-2.5 text-left">OpenID</th><th className="p-2.5 text-left">到期时间</th><th className="p-2.5 text-right">操作</th></tr></thead><tbody>
              {(muteData.members as QQMuteMember[]).map((m) => <tr key={m.member_openid} className="border-t"><td data-label="成员" className="p-2.5">{m.username || '—'}</td><td data-label="OpenID" className="p-2.5 font-mono text-xs">{m.member_openid}</td><td data-label="到期时间" className="p-2.5">{m.mute_expire_at ? new Date(m.mute_expire_at).toLocaleString() : '—'}</td><td data-label="操作" className="p-2.5 text-right"><Button size="sm" variant="outline" onClick={() => void unmute(m.member_openid)}>解除</Button></td></tr>)}
            </tbody></table></div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end"><Button size="sm" onClick={() => void createStrategy()}><Plus className="mr-2 h-4 w-4" />为当前群创建策略</Button></div>
          {strategies.length === 0 ? <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">尚未创建自动审批策略</div> : strategies.map((s) => (
            <div key={s.strategy_id} className="rounded-lg border p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{s.remark || '未命名策略'}</span><Badge variant={s.is_enable === 'on' ? 'success' : 'secondary'}>{s.is_enable === 'on' ? '启用' : '停用'}</Badge></div>
                  <div className="font-mono text-xs text-muted-foreground">{s.strategy_id}</div>
                  <div className="text-xs text-muted-foreground">关联 OpenID 群：{(s.group_openids || []).length} · 关联 QQ 群：{(s.group_ids || []).length} · 白名单约 {s.whitelist_user_count || 0} 个</div>
                  {s.expire_at && <div className="text-xs text-muted-foreground">到期：{new Date(s.expire_at).toLocaleString()}</div>}
                </div>
                <div className="flex max-w-full flex-wrap gap-1.5 sm:justify-end">
                  <Button size="sm" variant="outline" onClick={() => void post({ action: 'updateStrategy', strategyId: s.strategy_id, body: { is_enable: s.is_enable === 'on' ? 'off' : 'on' } })}>{s.is_enable === 'on' ? '停用' : '启用'}</Button>
                  <Button size="sm" variant="outline" onClick={() => void editRemark(s)}><Pencil className="mr-1 h-3.5 w-3.5" />备注</Button>
                  <Button size="sm" variant="outline" onClick={() => void whitelist(s, 'add')}>加白名单</Button>
                  <Button size="sm" variant="outline" onClick={() => void whitelist(s, 'del')}>移出白名单</Button>
                  <Button size="sm" variant="outline" onClick={() => void post({ action: 'executeStrategy', strategyId: s.strategy_id }, '已提交全量扫描任务')}><Play className="mr-1 h-3.5 w-3.5" />执行</Button>
                  <Button size="sm" variant="destructive" onClick={async () => { if (await dlg.confirm({ title: '删除自动审批策略', description: `确定删除「${s.remark || s.strategy_id}」吗？`, destructive: true, confirmText: '删除' })) await post({ action: 'deleteStrategy', strategyId: s.strategy_id }, '策略已删除'); }}><Trash2 className="mr-1 h-3.5 w-3.5" />删除</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
// ── 日志管理 ──
interface LogRow { id: number; name: string; gmId: string; status: number; createdAt: string; lastAt: string; count: number; }
const LogsTab: React.FC<any> = ({ group, t, toast, dlg }) => {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/logs?groupId=${encodeURIComponent(group.groupId)}`);
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      setRows(j.data || []);
    } catch { toast({ title: t('common.load_fail'), variant: 'destructive' }); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.groupId]);
  useEffect(() => { void load(); }, [load]);

  const [uploading, setUploading] = useState<number | null>(null);
  const exportLog = (id: number, format: 'txt' | 'csv' | 'html') => {
    const a = document.createElement('a');
    a.href = `/api/logs/${id}/export?format=${format}`;
    a.click();
  };
  const upload = async (row: LogRow) => {
    setUploading(row.id);
    try {
      const r = await fetch(`/api/logs/${row.id}/upload`, { method: 'POST' });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      const url = j.data?.url || '';
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
      toast({ title: t('groups.log_uploaded'), description: url });
    } catch (e) { toast({ title: t('groups.log_upload_fail'), description: String(e), variant: 'destructive' }); }
    finally { setUploading(null); }
  };
  const del = async (row: LogRow) => {
    if (!(await dlg.confirm({ title: t('common.delete'), description: t('groups.log_confirm_delete', { name: row.name }), destructive: true, confirmText: t('common.delete') }))) return;
    try {
      const r = await fetch(`/api/logs/${row.id}`, { method: 'DELETE' });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      void load();
    } catch (e) { toast({ title: t('common.operation_fail'), description: String(e), variant: 'destructive' }); }
  };

  const fmt = (iso: string) => { if (!iso) return '—'; const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z'); return isNaN(d.getTime()) ? iso : d.toLocaleString(); };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (rows.length === 0) return <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">{t('groups.log_empty')}</div>;

  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="rt w-full text-sm md:min-w-[800px] md:table-fixed">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="text-left font-medium p-2.5">{t('groups.log_name')}</th>
            <th className="text-left font-medium p-2.5 md:w-28">{t('groups.log_creator')}</th>
            <th className="text-left font-medium px-1.5 py-2.5 whitespace-nowrap md:w-36">{t('groups.log_start')}</th>
            <th className="text-left font-medium px-1.5 py-2.5 whitespace-nowrap md:w-36">{t('groups.log_last')}</th>
            <th className="text-left font-medium p-2.5 md:w-16">{t('groups.log_count')}</th>
            <th className="text-center font-medium p-2.5 md:w-56">{t('groups.log_actions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/30">
              <td data-label={t('groups.log_name')} className="p-2.5 font-medium break-words">{r.name}</td>
              <td data-label={t('groups.log_creator')} className="p-2.5 font-mono text-xs break-all">{r.gmId}</td>
              <td data-label={t('groups.log_start')} className="px-1.5 py-2.5 text-muted-foreground text-[11px] whitespace-nowrap">{fmt(r.createdAt)}</td>
              <td data-label={t('groups.log_last')} className="px-1.5 py-2.5 text-muted-foreground text-[11px] whitespace-nowrap">{fmt(r.lastAt)}</td>
              <td data-label={t('groups.log_count')} className="p-2.5">{r.count}</td>
              <td data-label={t('common.actions')} className="p-2.5 md:w-56">
                <LogActionButtons
                  onDownload={(format) => exportLog(r.id, format)}
                  onUpload={() => void upload(r)}
                  onDelete={() => void del(r)}
                  uploading={uploading === r.id}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── 模拟聊天 ──
// 头像（QQ 用 qlogo）+ 用户标识（QQ号/适配器编码）+ 解析消息里的图片(CQ码/[图片:])
// 渲染为缩略图，点击放大。
const ChatAvatar: React.FC<{ userId?: string; sender: string; platform: string; self: boolean }> = ({ userId, sender, platform, self }) => {
  const [broken, setBroken] = useState(false);
  const url = !broken && platform === 'onebot_v11' && userId ? `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=100` : '';
  const initial = (sender || '?').trim().charAt(0).toUpperCase();
  return (
    <div className={`h-9 w-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-medium ${self ? 'bg-primary/15 text-primary' : 'bg-muted-foreground/15 text-muted-foreground'}`}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} /> : <span>{initial}</span>}
    </div>
  );
};

// C#99：文件大小可读化。
const fmtSize = (n: number): string => {
  if (!n || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

// 把一条消息内容（可能含 CQ 码 / [图片:URL]）渲染成文本 + 图片缩略图。
// C#99：[CQ:file,...] 渲染成文件条目，onFile 提供时可点击下载。
const renderMessage = (content: string, onZoom: (src: string) => void,
                       quoteLookup?: (id: string) => { sender: string; excerpt: string } | null,
                       quoteLabel = 'reply',
                       onFile?: (fileId: string, busid: string, name: string) => void,
                       fileLabel = 'download'): React.ReactNode => {
  const re = /\[CQ:image,[^\]]*\]|\[img,[^\]]*\]|\[图片?:[^\]]*\]|\[CQ:at,qq=(\d+)\]|\[CQ:face,[^\]]*\]|\[CQ:reply,id=([^\]]+)\]|\[CQ:file,[^\]]*\]/g;
  const out: React.ReactNode[] = [];
  let last = 0; let m: RegExpExecArray | null; let k = 0;
  const pushText = (s: string) => { if (s) out.push(<span key={`t${k++}`}>{s}</span>); };
  while ((m = re.exec(content)) !== null) {
    pushText(content.slice(last, m.index));
    last = re.lastIndex;
    const tok = m[0];
    // C#59: 引用消息 [CQ:reply,id=…] → 引用气泡（能在当前窗口找到被引消息则显示摘要）
    if (tok.startsWith('[CQ:reply')) {
      const q = m[2] ? quoteLookup?.(m[2].trim()) : null;
      out.push(
        <span key={`q${k++}`} className="mb-1 block rounded border-l-2 border-primary/50 bg-black/5 dark:bg-white/10 px-2 py-0.5 text-xs opacity-80">
          ↩ {q ? `${q.sender}: ${q.excerpt}` : quoteLabel}
        </span>
      );
      continue;
    }
    // C#99：文件消息（群文件上传事件/文件消息段）→ 文件条目 + 下载。
    if (tok.startsWith('[CQ:file')) {
      const gv = (field: string) => {
        const mm = tok.match(new RegExp(field + '=([^,\\]]*)'));
        return mm ? mm[1].trim() : '';
      };
      const name = gv('name') || 'file';
      const fid = gv('id');
      const busid = gv('busid');
      const size = Number(gv('size')) || 0;
      out.push(
        <span key={`fl${k++}`} className="my-1 flex items-center gap-2 rounded-md border bg-black/5 dark:bg-white/10 px-2.5 py-1.5 text-xs max-w-[280px]">
          <FileText className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate flex-1" title={name}>{name}{size > 0 ? ` (${fmtSize(size)})` : ''}</span>
          {fid && onFile && (
            <button className="text-primary hover:underline shrink-0" onClick={() => onFile(fid, busid, name)}>{fileLabel}</button>
          )}
        </span>
      );
      continue;
    }
    if (tok.startsWith('[CQ:image') || tok.startsWith('[img') || tok.startsWith('[图')) {
      // 取 file=URL 或 url=URL 或 [图片:URL]
      const um = tok.match(/(?:file|url)=([^,\]]+)/) || tok.match(/\[图片?:([^\]]+)\]/);
      let src = um ? um[1].trim() : '';
      // C#56/57：本站资产统一走相对路径，本地目录引用转 /api/assets/，
      // 旧数据里的 http://localhost:xx/api/assets/.. 在其他设备浏览也能显示。
      const am = src.match(/^data[/\\]assets[/\\]([^/\\]+)$/) || src.match(/\/api\/assets\/([^/?#]+)$/);
      if (am) src = `/api/assets/${am[1]}`;
      // C#65：入站图片已本地化为 /api/chat/images/..（同源，无 rkey 问题）。
      if (/^https?:\/\//i.test(src) || src.startsWith('/api/')) {
        out.push(
          // referrerPolicy=no-referrer：QQ 图床(gchat.qpic.cn 等)有防盗链，带 Referer 会 400；
          // 不发 Referer 即可像直接访问那样加载。
          <img key={`i${k++}`} src={src} alt="图片" loading="lazy" referrerPolicy="no-referrer"
            onClick={() => onZoom(src)}
            className="my-1 max-h-32 max-w-[200px] rounded-md cursor-zoom-in object-cover block border" />
        );
      } else out.push(<span key={`i${k++}`} className="opacity-70">[图片]</span>);
    } else if (tok.startsWith('[CQ:at')) {
      out.push(<span key={`a${k++}`} className="text-primary">@{m[1]}</span>);
    } else {
      out.push(<span key={`f${k++}`} className="opacity-70">[表情]</span>);
    }
  }
  pushText(content.slice(last));
  return out;
};

// ── C#99 群文件：浏览根目录/文件夹，点击下载（经适配器取直链）──────────
interface GFile { fileId: string; name: string; size: number; busid: number; uploadTime: number; uploader: string; uploaderName: string; downloadTimes: number }
interface GFolder { folderId: string; name: string; count: number }

const FilesTab: React.FC<any> = ({ base, t, toast }) => {
  const [files, setFiles] = useState<GFile[]>([]);
  const [folders, setFolders] = useState<GFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);   // C#110：上传中
  const upRef = useRef<HTMLInputElement>(null);
  // 面包屑：[{id:'',name:根目录}, ...进入的文件夹]
  const [crumbs, setCrumbs] = useState<{ id: string; name: string }[]>([]);
  const [dling, setDling] = useState<Set<string>>(new Set());   // 正在下载的 fileId

  const load = useCallback(async (folderId: string) => {
    setLoading(true); setError('');
    try {
      const d = await jget<{ files: GFile[]; folders: GFolder[] }>(
        `${base}/files${folderId ? `?folder=${encodeURIComponent(folderId)}` : ''}`);
      setFiles(d?.files || []); setFolders(d?.folders || []);
    } catch (e) { setError((e as Error).message); setFiles([]); setFolders([]); }
    finally { setLoading(false); }
  }, [base]);
  useEffect(() => { void load(''); }, [load]);

  const enter = (f: GFolder) => { setCrumbs((c) => [...c, { id: f.folderId, name: f.name }]); void load(f.folderId); };
  const jump = (idx: number) => {   // idx=-1 → 根目录
    const next = idx < 0 ? [] : crumbs.slice(0, idx + 1);
    setCrumbs(next);
    void load(next.length ? next[next.length - 1].id : '');
  };
  // C#110：网页上传文件到群文件（选文件 → base64 → 后端经适配器 upload_group_file）。
  const uploadFile = async (f: File) => {
    if (f.size > 30 * 1024 * 1024) { toast({ title: t('groups.files_too_large'), variant: 'destructive' }); return; }
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(f);
      });
      await jsend('POST', `${base}/file-upload`, { name: f.name, content: dataUrl });
      toast({ title: t('groups.files_upload_queued', { name: f.name }) });
      // 上传经 QQ 处理有延迟，稍后刷新列表
      setTimeout(() => { void load(crumbs.length ? crumbs[crumbs.length - 1].id : ''); }, 3000);
    } catch (e) { toast({ title: t('common.upload_fail'), description: String(e), variant: 'destructive' }); }
    finally { setUploading(false); }
  };

  // 下载：优先「直连」——取 QQ 直链后前端 fetch 成 blob，用 <a download> 存盘。
  // 文件字节走 QQ→浏览器、不经服务器（小水管无压力），且 blob 同源、download 生效，
  // 文件名正确、强制下载（大 html 也不会被浏览器直接打开）。
  // 仅当文件服务器禁止跨域读取（CORS）/ 混合内容 / 取直链失败时，自动回退服务器中转（同样保证文件名）。
  const download = async (f: GFile) => {
    setDling((s) => new Set(s).add(f.fileId));
    try {
      const d = await jget<{ url: string }>(`${base}/file-url?file_id=${encodeURIComponent(f.fileId)}&busid=${f.busid}`);
      if (!d?.url) throw new Error('no url');
      const resp = await fetch(d.url);
      if (!resp.ok) throw new Error('http ' + resp.status);
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl; a.download = f.name || 'file';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 10000);
    } catch {
      window.open(`/api${base}/file-download?file_id=${encodeURIComponent(f.fileId)}&busid=${f.busid}&name=${encodeURIComponent(f.name)}`, '_blank');
    } finally {
      setDling((s) => { const n = new Set(s); n.delete(f.fileId); return n; });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <button className={`hover:text-primary ${crumbs.length === 0 ? 'font-medium' : 'text-muted-foreground'}`} onClick={() => jump(-1)}>
          {t('groups.files_root')}
        </button>
        {crumbs.map((c, i) => (
          <React.Fragment key={c.id}>
            <span className="text-muted-foreground">/</span>
            <button className={`hover:text-primary ${i === crumbs.length - 1 ? 'font-medium' : 'text-muted-foreground'}`} onClick={() => jump(i)}>{c.name}</button>
          </React.Fragment>
        ))}
        <span className="flex-1" />
        {/* C#110：上传文件到群文件 */}
        <input ref={upRef} type="file" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadFile(f); }} />
        <Button variant="outline" size="sm" onClick={() => upRef.current?.click()} disabled={uploading || loading}>
          {uploading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}{t('groups.files_upload')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => jump(crumbs.length - 1)} disabled={loading}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}
        </Button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">{t('groups.files_unavailable')}<div className="mt-1 text-xs opacity-70">{error}</div></div>
      ) : folders.length === 0 && files.length === 0 ? (
        <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">{t('groups.files_empty')}</div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="rt w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium p-2.5">{t('groups.files_name')}</th>
                <th className="text-left font-medium p-2.5 w-24">{t('groups.files_size')}</th>
                <th className="text-left font-medium p-2.5 w-40">{t('groups.files_uploader')}</th>
                <th className="text-left font-medium p-2.5 w-40">{t('groups.files_time')}</th>
                <th className="p-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {folders.map((f) => (
                <tr key={'d' + f.folderId} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => enter(f)}>
                  <td data-label={t('groups.files_name')} className="p-2.5"><span className="flex items-center gap-2"><FolderOpen className="h-4 w-4 text-amber-500" />{f.name}<span className="text-xs text-muted-foreground">({f.count})</span></span></td>
                  <td data-label={t('groups.files_size')} className="p-2.5 text-muted-foreground">—</td>
                  <td data-label={t('groups.files_uploader')} className="p-2.5"></td>
                  <td data-label={t('groups.files_time')} className="p-2.5"></td>
                  <td className="p-2.5"></td>
                </tr>
              ))}
              {files.map((f) => (
                <tr key={f.fileId} className="border-t hover:bg-muted/30">
                  <td data-label={t('groups.files_name')} className="p-2.5"><span className="flex items-center gap-2"><FileText className="h-4 w-4 opacity-60" /><span className="break-all">{f.name}</span></span></td>
                  <td data-label={t('groups.files_size')} className="p-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtSize(f.size)}</td>
                  <td data-label={t('groups.files_uploader')} className="p-2.5 text-xs text-muted-foreground">{f.uploaderName || f.uploader}</td>
                  <td data-label={t('groups.files_time')} className="p-2.5 text-xs text-muted-foreground whitespace-nowrap">{f.uploadTime ? new Date(f.uploadTime * 1000).toLocaleString() : '—'}</td>
                  <td data-label={t('common.actions')} className="p-2.5">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => download(f)} disabled={dling.has(f.fileId)}>
                      {dling.has(f.fileId) ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}{t('common.download')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// C#106：玩家私聊页复用同一套模拟聊天 UI；私聊没有群历史/戳一戳/群文件能力。
export const ChatTab: React.FC<any> = ({ base, platform, t, toast, privateChat = false, channels = [], channelKey: controlledKey }) => {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState('');
  const [zoom, setZoom] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // C#43: only auto-stick to the bottom when the user is already there, so
  // scrolling up to read history isn't yanked back down by the 3s poll.
  const [stick, setStick] = useState(true);
  const fallbackChannel = { key: `${platform}:default`, platform, adapterAccount: '', endpointId: '', base, label: platform === 'qq_official' ? 'QQ 官方机器人' : 'OneBot' };
  const availableChannels = channels.length ? channels : [fallbackChannel];
  const [channelKey, setChannelKey] = useState(() => (availableChannels.find((c: any) => c.platform === platform)?.key ?? availableChannels[0].key));
  const isControlled = controlledKey != null;
  const activeKey = isControlled ? controlledKey : channelKey;
  const activeChannel = availableChannels.find((c: any) => c.key === activeKey) ?? availableChannels[0];
  const activeBase = activeChannel.base || base;
  const activePlatform = activeChannel.platform || platform;
  useEffect(() => {
    if (!availableChannels.some((c: any) => c.key === channelKey)) setChannelKey(availableChannels[0].key);
  }, [channelKey, availableChannels]);
  const onScroll = () => {
    const el = boxRef.current; if (!el) return;
    setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
  };
  const toLatest = () => { const el = boxRef.current; if (el) { el.scrollTo(0, el.scrollHeight); setStick(true); } };

  const poll = useCallback(async () => {
    try { const d = await jget<ChatLine[]>(`${activeBase}/messages`); setLines(d || []); } catch { /* ignore */ }
  }, [activeBase]);
  useEffect(() => {
    void poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [poll]);
  useEffect(() => { if (stick) boxRef.current?.scrollTo(0, boxRef.current.scrollHeight); }, [lines, stick]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput(''); setStick(true);   // C#43: jump to latest after sending your own message
    try { await jsend('POST', `${activeBase}/messages`, { text, adapterAccount: activeChannel.adapterAccount || '', endpointId: activeChannel.endpointId || '' }); await poll(); }
    catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };
  const sendRaw = async (text: string) => {
    setStick(true);
    try { await jsend('POST', `${activeBase}/messages`, { text, adapterAccount: activeChannel.adapterAccount || '', endpointId: activeChannel.endpointId || '' }); await poll(); }
    catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };

  // ── C#42: 发图 / 本地表情包 / 戳一戳 ──────────────────────────
  interface Sticker { url: string; code: string; }
  const imgRef = useRef<HTMLInputElement>(null);
  const stickerAddRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [stickers, setStickers] = useState<Sticker[]>(() => {
    try { return JSON.parse(localStorage.getItem('dice-stickers') || '[]'); } catch { return []; }
  });
  const [stickerOpen, setStickerOpen] = useState(false);
  const saveStickers = (s: Sticker[]) => { setStickers(s); localStorage.setItem('dice-stickers', JSON.stringify(s)); };
  const uploadImage = async (file: File): Promise<Sticker | null> => {
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file);
      });
      const r = await fetch('/api/assets/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, data: dataUrl }) });
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      return { url: j.data.url, code: j.data.code };
    } catch (e) { toast({ title: t('groups.chat_img_fail'), description: String(e), variant: 'destructive' }); return null; }
  };
  const sendImage = async (file: File) => {
    const s = await uploadImage(file);
    if (s) await sendRaw(s.code);   // [CQ:image,file=URL] — 发送路径会解析成真图片段
  };
  const addSticker = async (file: File) => {
    const s = await uploadImage(file);
    if (s) { saveStickers([...stickers, s]); toast({ title: t('groups.chat_sticker_added') }); }
  };
  // D#10：模拟聊天可直接把任意文件上传到群文件，不必切换到「群文件」选项卡。
  const sendFile = async (file: File) => {
    if (file.size > 30 * 1024 * 1024) { toast({ title: t('groups.files_too_large'), variant: 'destructive' }); return; }
    setFileUploading(true); setStick(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file);
      });
      await jsend('POST', `${base}/file-upload`, { name: file.name, content: dataUrl });
      toast({ title: t('groups.files_upload_queued', { name: file.name }) });
      void poll();
    } catch (e) { toast({ title: t('common.upload_fail'), description: String(e), variant: 'destructive' }); }
    finally { setFileUploading(false); }
  };
  const poke = async (uid?: string) => {
    if (!uid) return;
    try { await jsend('POST', `${base}/poke`, { userId: uid }); toast({ title: t('groups.chat_poked') }); }
    catch (e) { toast({ title: t('common.operation_fail'), description: String(e), variant: 'destructive' }); }
  };

  return (
    <div className="relative flex flex-col h-[60vh] rounded-lg border">
      {availableChannels.length > 1 && !isControlled && (
        <div className="flex items-center gap-2 border-b bg-muted/20 px-3 py-2 text-xs">
          <span className="text-muted-foreground">发送渠道</span>
          <Select value={channelKey} onValueChange={setChannelKey}>
            <SelectTrigger className="h-7 w-auto min-w-[120px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableChannels.map((channel: any) => <SelectItem key={channel.key} value={channel.key} className="text-xs">{channel.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div ref={boxRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-4 space-y-3">
        {lines.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{t('groups.chat_empty')}</div>
        ) : lines.map((l) => (
          <div key={l.id} className={`flex gap-2 ${l.self ? 'flex-row-reverse' : 'flex-row'}`}>
            <ChatAvatar userId={l.userId} sender={l.sender} platform={activePlatform} self={l.self} />
            <div className={`max-w-[75%] flex flex-col ${l.self ? 'items-end' : 'items-start'}`}>
              <div className="text-xs opacity-70 mb-0.5 px-1 flex items-center flex-wrap gap-x-1">
                {l.sender}
                {l.userId && <span className="font-mono opacity-60">{l.userId}</span>}
                {/* C#44: 已撤回标注（内容仍显示） */}
                {l.recalled && <Badge variant="outline" className="h-4 px-1 text-[10px] text-destructive border-destructive/40">{t('groups.chat_recalled')}</Badge>}
                {/* C#42: 戳一戳（对方消息） */}
                {!privateChat && !l.self && l.userId && (
                  <button title={t('groups.chat_poke')} onClick={() => poke(l.userId)}
                    className="opacity-40 hover:opacity-100 transition-opacity">👉</button>
                )}
              </div>
              <div className={`rounded-lg px-3 py-2 ${l.self ? 'bg-primary text-primary-foreground' : 'bg-muted'} ${l.recalled ? 'opacity-70' : ''}`}>
                <div className="text-sm whitespace-pre-wrap break-words">{renderMessage(l.content, setZoom,
                  (qid) => {   // C#59: 在当前窗口内按 msgId 找被引消息 → 摘要
                    const src = lines.find((x) => x.msgId === qid);
                    if (!src) return null;
                    const plain = src.content.replace(/\[CQ:[^\]]*\]/g, '[..]');
                    return { sender: src.sender, excerpt: plain.length > 30 ? plain.slice(0, 30) + '…' : plain };
                  }, t('groups.chat_quoted'),
                  // C#99：聊天里的文件 → 本端下载代理（带真实文件名）
                  privateChat ? undefined : (fid, busid, name) => {
                    window.open(`/api${base}/file-download?file_id=${encodeURIComponent(fid)}&busid=${encodeURIComponent(busid)}&name=${encodeURIComponent(name)}`, '_blank');
                  }, t('common.download'))}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!stick && lines.length > 0 && (
        <button onClick={toLatest}
          className="absolute bottom-16 right-4 z-10 inline-flex items-center gap-1 rounded-full border bg-background/95 px-3 py-1.5 text-xs shadow-md hover:bg-muted">
          <ChevronDown className="h-3.5 w-3.5" />{t('groups.chat_to_latest')}
        </button>
      )}
      {/* C#42: 本地表情包面板 */}
      {stickerOpen && (
        <div className="border-t bg-muted/30 p-2 max-h-40 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {stickers.map((s, i) => (
              <div key={i} className="relative group">
                <img src={s.url} alt="" className="h-14 w-14 rounded object-cover cursor-pointer border hover:border-primary"
                  onClick={() => { void sendRaw(s.code); setStickerOpen(false); }} />
                <button onClick={() => saveStickers(stickers.filter((_, x) => x !== i))}
                  className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px]">×</button>
              </div>
            ))}
            <button onClick={() => stickerAddRef.current?.click()}
              className="h-14 w-14 rounded border border-dashed flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary">
              <Plus className="h-5 w-5" />
            </button>
          </div>
          {stickers.length === 0 && <p className="mt-1 text-[11px] text-muted-foreground">{t('groups.chat_sticker_hint')}</p>}
        </div>
      )}
      <div className="flex gap-2 border-t p-3">
        {/* C#44: 通过 NapCat API 拉取历史消息（异步入库后随下一次轮询显示） */}
        {!privateChat && <Button variant="outline" size="icon" title={t('groups.chat_fetch_history')} onClick={async () => {
          try { await jsend('POST', `${base}/fetch-history`, {}); toast({ title: t('groups.chat_history_requested') }); setTimeout(() => void poll(), 2500); }
          catch (e) { toast({ title: t('common.operation_fail'), description: String(e), variant: 'destructive' }); }
        }}><Download className="h-4 w-4" /></Button>}
        {/* C#42: 发送图片 */}
        <Button variant="outline" size="icon" title={t('groups.chat_send_image')} onClick={() => imgRef.current?.click()}>
          <ImageIcon className="h-4 w-4" />
        </Button>
        {!privateChat && <Button variant="outline" size="icon" title={t('groups.chat_send_file')} onClick={() => fileRef.current?.click()} disabled={fileUploading}>
          {fileUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        </Button>}
        {/* C#42: 表情包面板开关 */}
        <Button variant={stickerOpen ? 'secondary' : 'outline'} size="icon" title={t('groups.chat_stickers')} onClick={() => setStickerOpen((v) => !v)}>
          <Smile className="h-4 w-4" />
        </Button>
        <input ref={imgRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendImage(f); e.target.value = ''; }} />
        <input ref={stickerAddRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void addSticker(f); e.target.value = ''; }} />
        <input ref={fileRef} type="file" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void sendFile(f); }} />
        <Input value={input} placeholder={t('groups.chat_placeholder')} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        <Button onClick={send}><Send className="mr-2 h-4 w-4" />{t('groups.chat_send')}</Button>
      </div>
      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-zoom-out p-6"
          onClick={() => setZoom(null)}>
          <img src={zoom} alt="" referrerPolicy="no-referrer" className="max-h-full max-w-full rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
};

export default GroupsPage;
// force rebuild
