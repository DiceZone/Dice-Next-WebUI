import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import type { LucideIcon } from 'lucide-react';
import {
  SlidersHorizontal, Crown, Plus, Trash2, ShieldCheck, Zap,
  Image, Type, Server, Clock, ScrollText, HeartPulse,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Master { platform: string; id: string; }
const PLATFORMS: { value: string; label: string }[] = [
  { value: 'onebot_v11', label: 'QQ' },
  { value: 'discord', label: 'Discord' },
  { value: 'kook', label: 'KOOK' },
];
const platLabel = (p: string) => PLATFORMS.find((x) => x.value === p)?.label || (p || '任意');

type GOpt = { key: string; label: string; type: 'bool' | 'int'; hint?: string; wired?: boolean };
type GGroup = { title: string; opts: GOpt[] };
const GLOBAL_GROUPS: GGroup[] = [
  { title: '响应开关', opts: [
    { key: 'silent_global', label: '全局静默', hint: '非信任用户只响应 .bot；其余沉默', type: 'bool', wired: true },
    { key: 'disabled_jrrp', label: '禁用 .jrrp', type: 'bool', wired: true },
    { key: 'disabled_me', label: '禁用 .me', type: 'bool', wired: true },
    { key: 'disabled_deck', label: '禁用 .deck', type: 'bool', wired: true },
    { key: 'disabled_draw', label: '禁用 .draw', type: 'bool', wired: true },
    { key: 'disabled_send', label: '禁用 .send', type: 'bool', wired: true },
    { key: 'disabled_help', label: '禁用 .help', type: 'bool', wired: true },
  ] },
  { title: '牌堆 / 显示', opts: [
    { key: 'deck_hide_underscore', label: '隐藏牌堆 _ 元数据键', hint: '.deck 列表不显示 _author/_title 等', type: 'bool', wired: true },
  ] },
  { title: '事件响应', opts: [
    { key: 'listen_group_request', label: '响应加群请求', type: 'bool', wired: true },
    { key: 'listen_group_add', label: '响应入群反馈（欢迎词）', type: 'bool', wired: true },
    { key: 'listen_friend_request', label: '响应好友请求', type: 'bool', wired: true },
    { key: 'listen_friend_add', label: '响应好友添加反馈', type: 'bool', wired: true },
  ] },
  { title: '云 / 网络（暂未联动）', opts: [
    { key: 'cloud_visible', label: '允许云端公开本骰信息', type: 'bool' },
    { key: 'cloud_black_share', label: '与云端互通不良记录', type: 'bool' },
  ] },
  { title: '外部请求（自定义回复 {api:URL}）', opts: [
    { key: 'api_enabled', label: '启用 {api:URL} 外部请求', hint: '默认关闭；仅 http/https，自动拦截私网地址。白名单 dice/api_whitelist 在配置文件设置', type: 'bool', wired: true },
    { key: 'api_timeout', label: '请求超时(秒)', hint: '1-30', type: 'int', wired: true },
  ] },
  { title: '自动维护', opts: [
    { key: 'inactive_user_line', label: '用户不活跃上限(天)', hint: '0=不生效', type: 'int' },
    // 群不活跃自动退群已迁移为「定时任务」页的一条 *(全部群) 任务，启动时自动迁移旧配置。
    { key: 'group_clear_limit', label: '单次清群上限', type: 'int' },
    { key: 'group_invalid_size', label: '协议无效群规模', type: 'int' },
  ] },
  { title: '其他兼容（记录项）', opts: [
    { key: 'private_mode', label: '私用模式', type: 'bool' },
    { key: 'check_group_license', label: '入群审核许可', type: 'bool' },
    { key: 'leave_discuss', label: '检测讨论组自动退出', type: 'bool' },
    { key: 'leave_black_qq', label: '检测黑名单用户自动退群', type: 'bool' },
    { key: 'listen_at_when_off', label: '停用时 @ 仍可触发', type: 'bool' },
    { key: 'allow_stranger', label: '陌生人策略(0白名单/1有记录/2非黑)', type: 'int' },
  ] },
  { title: '身份绑定（高风险）', opts: [
    { key: 'allow_official_direct_bind', label: '允许 QQ 官方窗口直接绑定真实 QQ', type: 'bool', wired: true,
      hint: '默认关闭。QQ 官方机器人无法验证发言者真实 QQ 或群管理身份；开启后可能有人冒认 QQ，导致人物卡、好感度等用户数据被错误合并或访问。仅在人工协助绑定时短暂开启，完成后请立即关闭。' },
  ] },
];

async function getJson(path: string) {
  const r = await fetch('/api' + path); const j = await r.json();
  if (j.code !== 0) throw new Error(j.message); return j.data;
}
async function putJson(path: string, body: unknown) {
  const r = await fetch('/api' + path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json(); if (j.code !== 0) throw new Error(j.message); return j.data;
}

// ── 图片发送方式（C#56）──────────────────────────────────
interface ImageSendConf { mode?: string; host?: string; default_host?: string; }

const ImageSendCard: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [c, setC] = useState<ImageSendConf>({ mode: 'base64', host: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await getJson('/system/image-send') as ImageSendConf;
        setC({ mode: d.mode || 'base64', host: d.host || '', default_host: d.default_host });
      } catch { /* ignore */ }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await putJson('/system/image-send', { mode: c.mode || 'base64', host: (c.host || '').trim() });
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Image className="h-4 w-4" />{t('settings.imgsend_title')}</CardTitle>
        <CardDescription>{t('settings.imgsend_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={c.mode || 'base64'} onValueChange={(v) => setC({ ...c, mode: v })}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="base64">{t('settings.imgsend_base64')}</SelectItem>
            <SelectItem value="httpurl">{t('settings.imgsend_httpurl')}</SelectItem>
          </SelectContent>
        </Select>
        {c.mode === 'httpurl' && (
          <div>
            <Label className="text-xs">{t('settings.imgsend_host')}</Label>
            <Input className="h-8 text-sm" value={c.host || ''} onChange={(e) => setC({ ...c, host: e.target.value })}
              placeholder={c.default_host || 'localhost:18088'} />
            <p className="text-[11px] text-muted-foreground mt-1">{t('settings.imgsend_host_hint')}</p>
          </div>
        )}
        <div className="flex justify-end"><Button size="sm" onClick={save} disabled={saving}>{t('common.save')}</Button></div>
      </CardContent>
    </Card>
  );
};

// ── 消息发送形式（传统文本 / 平台富卡片）──────────────────────
interface MessageFormatConf { mode?: 'traditional' | 'card'; }

const MessageFormatCard: React.FC = () => {
  const toast = useToast();
  const [mode, setMode] = useState<MessageFormatConf['mode']>('traditional');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await getJson('/system/message-format') as MessageFormatConf;
        setMode(d.mode === 'card' ? 'card' : 'traditional');
      } catch { /* ignore */ }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await putJson('/system/message-format', { mode: mode === 'card' ? 'card' : 'traditional' });
      toast({ title: '消息发送形式已保存' });
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Type className="h-4 w-4" />消息发送形式</CardTitle>
        <CardDescription>控制支持富消息的平台如何展示骰娘回复；OneBot 始终保持传统文本。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={mode || 'traditional'} onValueChange={(value) => setMode(value === 'card' ? 'card' : 'traditional')}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="traditional">传统文本</SelectItem>
            <SelectItem value="card">卡片消息</SelectItem>
          </SelectContent>
        </Select>
        {mode === 'card' && (
          <p className="text-xs text-muted-foreground">Discord 使用 Embed，KOOK 使用 CardMessage，QQ 官方机器人优先发送 Markdown。若 QQ 机器人未获 Markdown 权限，系统会自动退回传统文本；过长回复也会保持文本，避免截断。</p>
        )}
        <div className="flex justify-end"><Button size="sm" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</Button></div>
      </CardContent>
    </Card>
  );
};

// ── 图床配置组件 ────────────────────────────────────────
interface ImageHostConf { mode?: string; url?: string; file_field?: string; result_path?: string; public_base?: string; headers?: string[]; }

const ImageHostCard: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [c, setC] = useState<ImageHostConf>({ mode: 'none', file_field: 'file', result_path: 'data.url' });
  const [headersText, setHeadersText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await getJson('/system/image-host') as ImageHostConf;
        setC({ mode: d.mode || 'none', url: d.url || '', file_field: d.file_field || 'file', result_path: d.result_path || 'data.url', public_base: d.public_base || '' });
        setHeadersText((d.headers || []).join('\n'));
      } catch { /* ignore */ }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const headers = headersText.split('\n').map((s) => s.trim()).filter(Boolean);
      const body: ImageHostConf = { mode: c.mode, url: c.url, file_field: c.file_field, result_path: c.result_path, public_base: c.public_base, headers };
      await putJson('/system/image-host', body);
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const mode = c.mode || 'none';
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Image className="h-4 w-4" />{t('settings.imghost_title')}</CardTitle>
        <CardDescription>{t('settings.imghost_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={mode} onValueChange={(v) => setC({ ...c, mode: v })}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('settings.imghost_none')}</SelectItem>
            <SelectItem value="generic">{t('settings.imghost_generic')}</SelectItem>
            <SelectItem value="local">{t('settings.imghost_local')}</SelectItem>
          </SelectContent>
        </Select>
        {mode === 'generic' && (
          <div className="space-y-2">
            <div><Label className="text-xs">{t('settings.imghost_url')}</Label>
              <Input className="h-8 text-sm" value={c.url || ''} onChange={(e) => setC({ ...c, url: e.target.value })} placeholder="https://your-imagehost/api/upload" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">{t('settings.imghost_field')}</Label>
                <Input className="h-8 text-sm" value={c.file_field || ''} onChange={(e) => setC({ ...c, file_field: e.target.value })} placeholder="file" /></div>
              <div><Label className="text-xs">{t('settings.imghost_result')}</Label>
                <Input className="h-8 text-sm" value={c.result_path || ''} onChange={(e) => setC({ ...c, result_path: e.target.value })} placeholder="data.url" /></div>
            </div>
            <div><Label className="text-xs">{t('settings.imghost_headers')}</Label>
              <Textarea className="text-xs font-mono h-20" value={headersText} onChange={(e) => setHeadersText(e.target.value)} placeholder="Authorization: Bearer xxxx" /></div>
            <p className="text-[11px] text-muted-foreground">{t('settings.imghost_generic_hint')}</p>
          </div>
        )}
        {mode === 'local' && (
          <div>
            <Label className="text-xs">{t('settings.imghost_base')}</Label>
            <Input className="h-8 text-sm" value={c.public_base || ''} onChange={(e) => setC({ ...c, public_base: e.target.value })} placeholder="https://your-domain.com" />
            <p className="text-[11px] text-muted-foreground mt-1">{t('settings.imghost_local_hint')}</p>
          </div>
        )}
        <div className="flex justify-end"><Button size="sm" onClick={save} disabled={saving}>{t('common.save')}</Button></div>
      </CardContent>
    </Card>
  );
};

// ── Section + grouped-row primitives ─────────────────────
// Loose one-off switches/inputs are consolidated into titled group cards so the
// whole page reads as a handful of labelled sections instead of ~25 stray cards.
const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-sm font-semibold text-muted-foreground pt-2 first:pt-0">{children}</h2>
);

const SettingGroup: React.FC<{ title?: string; icon?: LucideIcon; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
  <Card>
    {title && (
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">{Icon && <Icon className="h-4 w-4" />}{title}</CardTitle>
      </CardHeader>
    )}
    <CardContent className={title ? 'divide-y' : 'divide-y pt-6'}>{children}</CardContent>
  </Card>
);

// A switch row that lives inside a SettingGroup.
const SettingSwitch: React.FC<{ title: string; desc: string; checked: boolean; onToggle: (v: boolean) => void }> = ({ title, desc, checked, onToggle }) => (
  <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
    <div className="min-w-0 pr-2">
      <Label className="text-sm font-medium">{title}</Label>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onToggle} />
  </div>
);

// A row with arbitrary controls (input + save button) inside a SettingGroup.
const SettingRow: React.FC<{ title: string; desc: string; children: React.ReactNode; extra?: React.ReactNode }> = ({ title, desc, children, extra }) => (
  <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
    <div className="min-w-0 pr-2">
      <Label className="text-sm font-medium">{title}</Label>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      {extra}
    </div>
    <div className="flex items-center gap-2 shrink-0">{children}</div>
  </div>
);

// ── 主页面 ───────────────────────────────────────────────
export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const dlg = useDialogs(t);

  // — Master —
  const [masters, setMasters] = useState<Master[]>([]);
  const [mPlatform, setMPlatform] = useState('onebot_v11');
  const [mId, setMId] = useState('');
  // — Prefixes —
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [savingPrefix, setSavingPrefix] = useState(false);
  // — Approval —
  const [friendPolicy, setFriendPolicy] = useState('manual');
  const [friendKeyword, setFriendKeyword] = useState('');
  const [groupInvitePolicy, setGroupInvitePolicy] = useState('manual');
  const [groupRejectBlacklist, setGroupRejectBlacklist] = useState(true);
  const [groupRejectNonfriend, setGroupRejectNonfriend] = useState(false);
  const [groupNameKeywordLeave, setGroupNameKeywordLeave] = useState('');   // 群名关键词自动退群
  const [savingEvents, setSavingEvents] = useState(false);
  // — 日志站（API 地址可自建 + 上传协议）—
  const [logsiteUrl, setLogsiteUrl] = useState('');
  const [logsiteFormat, setLogsiteFormat] = useState('dicenext');
  const [logsiteOfficial, setLogsiteOfficial] = useState('');
  const [savingLogsite, setSavingLogsite] = useState(false);
  // — Nudge —
  const [pokeText, setPokeText] = useState('');
  const [pokeCommand, setPokeCommand] = useState('');
  const [pokeEnabled, setPokeEnabled] = useState(true);   // C#70：戳一戳回复开关
  const [welcomeMinDelay, setWelcomeMinDelay] = useState(0);
  const [welcomeMinCooldown, setWelcomeMinCooldown] = useState(0);
  const [savingPoke, setSavingPoke] = useState(false);
  // — WebUI items (moved here) —
  const [autostart, setAutostart] = useState(false);
  const [saveImages, setSaveImages] = useState(false);
  const [quoteReply, setQuoteReply] = useState(true);
  const [autoCard, setAutoCard] = useState(true);
  const [respondSelf, setRespondSelf] = useState(false);   // C#69：自响应/自控
  const [forwardLong, setForwardLong] = useState(false);
  const [forwardThreshold, setForwardThreshold] = useState(1200);
  const [segLen, setSegLen] = useState(600);
  const [segSaving, setSegSaving] = useState(false);
  const [nickPre, setNickPre] = useState('<');
  const [nickSuf, setNickSuf] = useState('>');
  const [nickSaving, setNickSaving] = useState(false);
  // — Globals —
  const [globals, setGlobals] = useState<Record<string, boolean | number>>({});

  // —— Loaders ———————————————————————————————————————————
  const loadMasters = async () => {
    try { const r = await fetch('/api/masters'); const j = await r.json(); if (j.code === 0) setMasters(j.data || []); } catch { /* ignore */ }
  };
  const loadPrefixes = async () => {
    try { const r = await fetch('/api/system/prefixes'); const j = await r.json(); if (j.code === 0) setPrefixes(j.data?.prefixes || []); } catch { /* ignore */ }
  };
  const loadEvents = async () => {
    try {
      const r = await fetch('/api/system/events'); const j = await r.json();
      if (j.code === 0) {
        setFriendPolicy(j.data.friend_policy || 'manual');
        setFriendKeyword(j.data.friend_keyword || '');
        setGroupInvitePolicy(j.data.group_invite_policy || 'manual');
        setGroupRejectBlacklist(j.data.group_invite_reject_blacklist !== false);
        setGroupRejectNonfriend(j.data.group_invite_reject_nonfriend === true);
        setGroupNameKeywordLeave(j.data.group_name_keyword_leave || '');
        setPokeText(j.data.poke || '');
        setPokeCommand(j.data.poke_command || '');
        setPokeEnabled(j.data.poke_enabled !== false);
        setWelcomeMinDelay(j.data.welcome_min_delay || 0);
        setWelcomeMinCooldown(j.data.welcome_min_cooldown || 0);
      }
    } catch { /* ignore */ }
  };
  const loadWebui = useCallback(async () => {
    try { setAutostart(!!(await getJson('/system/autostart')).enabled); } catch { /* ignore */ }
    try { setSaveImages(!!(await getJson('/system/save-log-images')).enabled); } catch { /* ignore */ }
    try { setQuoteReply((await getJson('/system/quote-reply')).enabled !== false); } catch { /* ignore */ }
    try { setAutoCard((await getJson('/system/auto-card')).enabled !== false); } catch { /* ignore */ }
    try { setRespondSelf(!!(await getJson('/system/respond-self')).enabled); } catch { /* ignore */ }
    try { const d = await getJson('/system/forward-long'); setForwardLong(!!d.enabled); setForwardThreshold(Number(d.threshold) || 1200); } catch { /* ignore */ }
    try { setSegLen(Number((await getJson('/system/reply-segment')).len) || 600); } catch { /* ignore */ }
    try { const d = await getJson('/system/nick-wrap'); setNickPre(d.prefix ?? '<'); setNickSuf(d.suffix ?? '>'); } catch { /* ignore */ }
  }, []);
  const loadGlobals = async () => {
    try { const r = await fetch('/api/system/global'); const j = await r.json(); if (j.code === 0) setGlobals(j.data || {}); } catch { /* ignore */ }
  };
  const loadLogsite = async () => {
    try {
      const r = await fetch('/api/system/logsite'); const j = await r.json();
      if (j.code === 0) { setLogsiteUrl(j.data.url || ''); setLogsiteFormat(j.data.format || 'dicenext'); setLogsiteOfficial(j.data.official || ''); }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    void loadMasters(); void loadPrefixes(); void loadEvents(); void loadWebui(); void loadGlobals(); void loadLogsite();
  }, [loadWebui]);

  // —— Handlers ——————————————————————————————————————————
  const addMaster = async () => {
    const id = mId.trim(); if (!id) return;
    try {
      const r = await fetch('/api/masters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: mPlatform, id }) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      setMId(''); setMasters(j.data || []); toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };
  const delMaster = async (m: Master) => {
    try {
      const r = await fetch(`/api/masters/${encodeURIComponent(m.platform || '_')}/${encodeURIComponent(m.id)}`, { method: 'DELETE' });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      setMasters(j.data || []); toast({ title: t('common.delete_success') });
    } catch (e) { toast({ title: t('common.delete_fail'), description: String(e), variant: 'destructive' }); }
  };
  const savePrefixes = async () => {
    const cleaned = prefixes.map((p) => p.trim()).filter(Boolean);
    if (cleaned.length === 0) { toast({ title: '至少需要一个前缀', variant: 'destructive' }); return; }
    setSavingPrefix(true);
    try {
      const r = await fetch('/api/system/prefixes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: cleaned }) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      setPrefixes(j.data?.prefixes || cleaned); toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setSavingPrefix(false); }
  };
  const saveEvents = async () => {
    setSavingEvents(true);
    try {
      const r = await fetch('/api/system/events', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_policy: friendPolicy, friend_keyword: friendKeyword, group_invite_policy: groupInvitePolicy, group_invite_reject_blacklist: groupRejectBlacklist, group_invite_reject_nonfriend: groupRejectNonfriend, group_name_keyword_leave: groupNameKeywordLeave.trim(), poke: pokeText, poke_command: pokeCommand , welcome_min_delay: welcomeMinDelay, welcome_min_cooldown: welcomeMinCooldown }) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setSavingEvents(false); }
  };
  const saveLogsite = async () => {
    setSavingLogsite(true);
    try {
      const r = await fetch('/api/system/logsite', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: logsiteUrl.trim(), format: logsiteFormat }) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      setLogsiteUrl(j.data.url || ''); setLogsiteFormat(j.data.format || 'dicenext');
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setSavingLogsite(false); }
  };
  const savePoke = async () => {
    setSavingPoke(true);
    try {
      const r = await fetch('/api/system/events', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_policy: friendPolicy, friend_keyword: friendKeyword, group_invite_policy: groupInvitePolicy, group_invite_reject_blacklist: groupRejectBlacklist, group_invite_reject_nonfriend: groupRejectNonfriend, poke: pokeText, poke_command: pokeCommand, poke_enabled: pokeEnabled }) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setSavingPoke(false); }
  };
  const saveGlobal = async (key: string, value: boolean | number) => {
    if (key === 'allow_official_direct_bind' && value === true) {
      const accepted = await dlg.confirm({
        title: '高风险操作',
        description: 'QQ 官方机器人无法验证发言者真实 QQ 或群管理身份。开启后，任何人都可能冒认 QQ，造成他人的人物卡、好感度等用户数据被错误关联或访问。仅在人工协助绑定时临时开启，完成后请立即关闭。是否继续？',
        destructive: true, confirmText: '仍然开启',
      });
      if (!accepted) return;
    }
    setGlobals((g) => ({ ...g, [key]: value }));
    try {
      const r = await fetch('/api/system/global', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: value }) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      toast({ title: t('common.save_success') });
    } catch (e) { void loadGlobals(); toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };

  const toggleAutostart = async (v: boolean) => {
    setAutostart(v);
    try { const d = await putJson('/system/autostart', { enabled: v }); setAutostart(!!d.enabled); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); setAutostart(!v); }
  };
  const toggleSaveImages = async (v: boolean) => {
    setSaveImages(v);
    try { const d = await putJson('/system/save-log-images', { enabled: v }); setSaveImages(!!d.enabled); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); setSaveImages(!v); }
  };
  const toggleQuoteReply = async (v: boolean) => {
    setQuoteReply(v);
    try { const d = await putJson('/system/quote-reply', { enabled: v }); setQuoteReply(d.enabled !== false); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); setQuoteReply(!v); }
  };
  const toggleAutoCard = async (v: boolean) => {
    setAutoCard(v);
    try { const d = await putJson('/system/auto-card', { enabled: v }); setAutoCard(d.enabled !== false); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); setAutoCard(!v); }
  };
  const toggleRespondSelf = async (v: boolean) => {
    setRespondSelf(v);
    try { const d = await putJson('/system/respond-self', { enabled: v }); setRespondSelf(!!d.enabled); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); setRespondSelf(!v); }
  };
  const toggleForwardLong = async (v: boolean) => {
    setForwardLong(v);
    try { const d = await putJson('/system/forward-long', { enabled: v, threshold: forwardThreshold }); setForwardLong(!!d.enabled); setForwardThreshold(Number(d.threshold) || 1200); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); setForwardLong(!v); }
  };
  const saveForwardThreshold = async () => {
    try { const d = await putJson('/system/forward-long', { enabled: forwardLong, threshold: forwardThreshold }); setForwardThreshold(Number(d.threshold) || 1200); toast({ title: t('common.save_success') }); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  };
  const saveSegLen = async () => {
    setSegSaving(true);
    try { const d = await putJson('/system/reply-segment', { len: segLen }); setSegLen(Number(d.len) || 600); toast({ title: t('common.save_success') }); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setSegSaving(false); }
  };
  const saveNickWrap = async () => {
    setNickSaving(true);
    try { await putJson('/system/nick-wrap', { prefix: nickPre, suffix: nickSuf }); toast({ title: t('common.save_success') }); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setNickSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader icon={SlidersHorizontal} title={t('settings.title')} description={t('settings.subtitle')} />

      <SectionHeading>{t('settings.sec_basic')}</SectionHeading>

      {/* ── Master ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Crown className="h-4 w-4" />{t('settings.master_title')}</CardTitle>
          <CardDescription>{t('settings.master_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {masters.length > 0 && (
            <div className="space-y-1">
              {masters.map((m) => (
                <div key={`${m.platform}/${m.id}`} className="flex items-center justify-between rounded border p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-medium">{platLabel(m.platform)}</span>
                    <span className="font-mono text-sm">{m.id}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => delMaster(m)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Select value={mPlatform} onValueChange={(v) => setMPlatform(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="flex-1" placeholder={t('settings.master_id_placeholder')} value={mId} onChange={(e) => setMId(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addMaster(); }} />
            <Button onClick={addMaster}><Plus className="mr-2 h-4 w-4" />{t('settings.master_add')}</Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 指令前缀 ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Type className="h-4 w-4" />{t('settings.prefix_title')}</CardTitle>
          <CardDescription>{t('settings.prefix_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {prefixes.map((p, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input value={p} maxLength={4} className="w-16 text-center font-mono" onChange={(e) => setPrefixes((arr) => arr.map((x, j) => j === i ? e.target.value : x))} />
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setPrefixes((arr) => arr.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setPrefixes((arr) => [...arr, ''])}><Plus className="mr-1 h-4 w-4" />{t('settings.prefix_add')}</Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={savePrefixes} disabled={savingPrefix}>{t('common.save')}</Button>
            <span className="text-xs text-muted-foreground">{t('settings.prefix_hint')}</span>
          </div>
        </CardContent>
      </Card>

      <SectionHeading>{t('settings.sec_approval')}</SectionHeading>

      {/* ── 好友 / 加群邀请审批 ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{t('settings.approval_title')}</CardTitle>
          <CardDescription>{t('settings.approval_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('settings.approval_friend')}</Label>
            <Select value={friendPolicy} onValueChange={(v) => setFriendPolicy(v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">{t('settings.approval_friend_manual')}</SelectItem>
                <SelectItem value="all">{t('settings.approval_friend_all')}</SelectItem>
                <SelectItem value="keyword">{t('settings.approval_friend_keyword')}</SelectItem>
                <SelectItem value="reject">{t('settings.approval_friend_reject')}</SelectItem>
              </SelectContent>
            </Select>
            {friendPolicy === 'keyword' && <Input value={friendKeyword} onChange={(e) => setFriendKeyword(e.target.value)} placeholder={t('settings.approval_keyword_ph')} />}
          </div>
          <div className="space-y-2">
            <Label>{t('settings.approval_group')}</Label>
            <Select value={groupInvitePolicy} onValueChange={(v) => setGroupInvitePolicy(v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">{t('settings.approval_group_manual')}</SelectItem>
                <SelectItem value="all">{t('settings.approval_group_all')}</SelectItem>
                <SelectItem value="whitelist">{t('settings.approval_group_whitelist')}</SelectItem>
                <SelectItem value="ignore">{t('settings.approval_group_ignore')}</SelectItem>
                <SelectItem value="reject">{t('settings.approval_group_reject')}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 pt-1">
              <Switch id="grb" checked={groupRejectBlacklist} onCheckedChange={setGroupRejectBlacklist} />
              <Label htmlFor="grb" className="text-sm font-normal">{t('settings.approval_group_reject_blacklist')}</Label>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch id="grn" checked={groupRejectNonfriend} onCheckedChange={setGroupRejectNonfriend} />
              <Label htmlFor="grn" className="text-sm font-normal">{t('settings.approval_group_reject_nonfriend')}</Label>
            </div>
            {groupRejectNonfriend && <p className="text-xs text-muted-foreground">{t('settings.approval_group_reject_nonfriend_hint')}</p>}
            <div className="space-y-1 pt-1">
              <Label className="text-sm font-normal">{t('settings.approval_group_name_keyword')}</Label>
              <Input value={groupNameKeywordLeave} onChange={(e) => setGroupNameKeywordLeave(e.target.value)}
                placeholder={t('settings.approval_group_name_keyword_ph')} />
              <p className="text-xs text-muted-foreground">{t('settings.approval_group_name_keyword_hint')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={saveEvents} disabled={savingEvents}>{t('common.save')}</Button>
            <span className="text-xs text-muted-foreground">{t('settings.approval_note')}</span>
          </div>
        </CardContent>
      </Card>

      {/* ── 心跳上报（heart.dice.zone）── */}
      <HeartbeatCard />

      {/* ── 戳一戳 (独立容器) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" />{t('settings.poke_title')}</CardTitle>
          <CardDescription>{t('settings.poke_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t('settings.poke_enabled')}</Label>
            <Switch checked={pokeEnabled} onCheckedChange={setPokeEnabled} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('settings.poke_command')}</Label>
            <Input className="h-8 text-sm" value={pokeCommand} onChange={(e) => setPokeCommand(e.target.value)} placeholder=".jrrp" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('settings.poke_text')}</Label>
            <Input className="h-8 text-sm" value={pokeText} onChange={(e) => setPokeText(e.target.value)} placeholder={t('settings.poke_text_ph')} />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={savePoke} disabled={savingPoke}>{t('common.save')}</Button>
          </div>
        </CardContent>
      </Card>

      {/* C#76: Welcome delay/cooldown minimums */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />{t('settings.welcome_min_title')}</CardTitle>
          <CardDescription>{t('settings.welcome_min_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">{t('settings.welcome_min_delay')}</Label>
            <Input className="h-8 text-sm w-32" type="number" min={0} max={300} value={welcomeMinDelay} onChange={(e) => setWelcomeMinDelay(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('settings.welcome_min_cooldown')}</Label>
            <Input className="h-8 text-sm w-32" type="number" min={0} max={3600} value={welcomeMinCooldown} onChange={(e) => setWelcomeMinCooldown(Number(e.target.value) || 0)} />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={saveEvents} disabled={savingEvents}>{t('common.save')}</Button>
          </div>
        </CardContent>
      </Card>

      <SectionHeading>{t('settings.sec_reply')}</SectionHeading>

      <SettingGroup>
        <SettingSwitch title={t('settings.quote_reply')} desc={t('settings.quote_reply_desc')} checked={quoteReply} onToggle={toggleQuoteReply} />
        <SettingSwitch title={t('settings.auto_card')} desc={t('settings.auto_card_desc')} checked={autoCard} onToggle={toggleAutoCard} />
        <SettingSwitch title={t('settings.respond_self')} desc={t('settings.respond_self_desc')} checked={respondSelf} onToggle={toggleRespondSelf} />
        <SettingSwitch title={t('settings.forward_long')} desc={t('settings.forward_long_desc')} checked={forwardLong} onToggle={toggleForwardLong} />
        <SettingRow title={t('settings.forward_threshold')} desc={t('settings.forward_threshold_desc')}>
          <Input type="number" min={1} max={100000} disabled={!forwardLong} className="h-9 w-28 text-sm"
            value={forwardThreshold} onChange={(e) => setForwardThreshold(Number(e.target.value))} />
          <Button size="sm" onClick={saveForwardThreshold} disabled={!forwardLong}>{t('common.save')}</Button>
        </SettingRow>
        <SettingRow title={t('settings.seg_len')} desc={t('settings.seg_len_desc')}>
          <Input type="number" min={100} max={1000} className="h-9 w-24 text-sm" value={segLen} onChange={(e) => setSegLen(Number(e.target.value))} />
          <Button size="sm" onClick={saveSegLen} disabled={segSaving}>{t('common.save')}</Button>
        </SettingRow>
        <SettingRow title={t('settings.nick_wrap')} desc={t('settings.nick_wrap_desc')}
          extra={<p className="text-xs text-muted-foreground mt-0.5 font-mono">{nickPre}{t('settings.nick_sample')}{nickSuf}</p>}>
          <Input className="h-9 w-14 text-sm text-center" maxLength={4} placeholder="<" value={nickPre} onChange={(e) => setNickPre(e.target.value)} />
          <Input className="h-9 w-14 text-sm text-center" maxLength={4} placeholder=">" value={nickSuf} onChange={(e) => setNickSuf(e.target.value)} />
          <Button size="sm" onClick={saveNickWrap} disabled={nickSaving}>{t('common.save')}</Button>
        </SettingRow>
      </SettingGroup>

      <MessageFormatCard />

      <SectionHeading>{t('settings.sec_image')}</SectionHeading>

      {/* 图片发送方式 */}
      <ImageSendCard />
      {/* 图床 */}
      <ImageHostCard />

      <SectionHeading>{t('settings.sec_logdata')}</SectionHeading>

      {/* 日志站（API 地址可自建 + 上传协议）*/}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ScrollText className="h-4 w-4" />{t('settings.logsite_title')}</CardTitle>
          <CardDescription>{t('settings.logsite_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('settings.logsite_url')}</Label>
            <Input value={logsiteUrl} onChange={(e) => setLogsiteUrl(e.target.value)} placeholder={logsiteOfficial} className="font-mono text-xs" />
            {logsiteUrl.trim() !== '' && logsiteOfficial !== '' && logsiteUrl.trim() !== logsiteOfficial && (
              <p className="text-xs text-amber-600 dark:text-amber-400">{t('settings.logsite_unofficial')}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t('settings.logsite_format')}</Label>
            <Select value={logsiteFormat} onValueChange={setLogsiteFormat}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="seal">{t('settings.logsite_format_seal')}</SelectItem>
                <SelectItem value="dicenext">{t('settings.logsite_format_dicenext')}</SelectItem>
                <SelectItem value="seal_v105">{t('settings.logsite_format_seal_v105')}</SelectItem>
                <SelectItem value="legacy">{t('settings.logsite_format_legacy')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={saveLogsite} disabled={savingLogsite}>{t('common.save')}</Button>
            <Button size="sm" variant="outline" onClick={() => { setLogsiteUrl(logsiteOfficial); setLogsiteFormat('dicenext'); }}>{t('settings.logsite_reset')}</Button>
          </div>
        </CardContent>
      </Card>
      {/* 聊天记录保留期 */}
      <ChatRetentionCard />
      <SectionHeading>{t('settings.sec_maintenance')}</SectionHeading>

      <SettingGroup>
        <SettingSwitch title={t('settings.autostart')} desc={t('settings.autostart_desc')} checked={autostart} onToggle={toggleAutostart} />
        <SettingSwitch title={t('settings.save_images')} desc={t('settings.save_images_desc')} checked={saveImages} onToggle={toggleSaveImages} />
      </SettingGroup>
      {/* 用户群 */}
      <UserGroupCard />
      {/* 自动清理好友 */}
      <FriendCleanCard />

      <SectionHeading>{t('settings.sec_global')}</SectionHeading>

      {/* 原版全局设置：每个二级标题独立容器 */}
      {GLOBAL_GROUPS.map((grp) => (
        <Card key={grp.title}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" />{grp.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {grp.opts.map((o) => (
              <div key={o.key} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label htmlFor={`g-${o.key}`} className="font-normal">
                    {o.label}
                    {!o.wired && <span className="ml-1.5 text-[10px] text-amber-600">{t('settings.record_only')}</span>}
                  </Label>
                  {o.hint && <p className="text-[11px] text-muted-foreground">{o.hint}</p>}
                </div>
                {o.type === 'bool' ? (
                  <Switch id={`g-${o.key}`} checked={!!globals[o.key]} onCheckedChange={(v) => saveGlobal(o.key, v)} />
                ) : (
                  <Input id={`g-${o.key}`} type="number" className="w-24" value={String(globals[o.key] ?? 0)}
                    onChange={(e) => setGlobals((g) => ({ ...g, [o.key]: Number(e.target.value) }))}
                    onBlur={(e) => saveGlobal(o.key, Number(e.target.value))} />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      {dlg.node}
    </div>
  );
};

// ── 心跳上报（向 heart.dice.zone 上报骰娘在线状态）────────────────
interface HeartbeatConf {
  enabled: boolean; url: string; token_set: boolean; token_tail: string;
  public_show: boolean; interval: number;
  last_status: string; last_report_at: string; last_error: string;
}

const HeartbeatCard: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [c, setC] = useState<HeartbeatConf>({
    enabled: false, url: 'https://heart.dice.zone', token_set: false, token_tail: '',
    public_show: true, interval: 300, last_status: '', last_report_at: '', last_error: '',
  });
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getJson('/system/heartbeat') as Partial<HeartbeatConf>;
      setC((prev) => ({ ...prev, ...d, url: d.url || 'https://heart.dice.zone' }));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const interval = Math.min(600, Math.max(180, Number(c.interval) || 300));
      await putJson('/system/heartbeat', {
        enabled: c.enabled, url: c.url.trim(), token,   // token 留空 = 不修改
        public_show: c.public_show, interval,
      });
      setToken(''); await load();
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await fetch('/api/system/heartbeat/test', { method: 'POST' });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      const d = j.data || {};
      toast({ title: t('settings.heartbeat_test_done', { status: d.http ?? '?' }), description: String(d.body ?? '').slice(0, 200) });
      void load();
    } catch (e) { toast({ title: t('settings.heartbeat_test_fail'), description: (e as Error).message, variant: 'destructive' }); }
    finally { setTesting(false); }
  };

  const statusBadge = () => {
    // 后端取值：''/unknown=从未上报、online=在线、offline=离线；其余视为错误
    const s = c.last_status || '';
    if (!s || s === 'unknown') return <Badge variant="outline">{t('settings.heartbeat_never')}</Badge>;
    if (s === 'online') return <Badge variant="outline" className="border-green-600 text-green-600 dark:border-green-400 dark:text-green-400">{t('settings.heartbeat_online')}</Badge>;
    if (s === 'offline') return <Badge variant="outline">{t('settings.heartbeat_offline')}</Badge>;
    return <Badge variant="destructive">{s}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><HeartPulse className="h-4 w-4" />{t('settings.heartbeat_title')}</CardTitle>
        <CardDescription>{t('settings.heartbeat_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm">{t('settings.heartbeat_enable')}</Label>
          <Switch checked={c.enabled} onCheckedChange={(v) => setC({ ...c, enabled: v })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('settings.heartbeat_url')}</Label>
          <Input className="h-8 font-mono text-xs" value={c.url}
            onChange={(e) => setC({ ...c, url: e.target.value })} placeholder="https://heart.dice.zone" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('settings.heartbeat_api_key')}</Label>
          <Input className="h-8 text-sm" type="password" value={token} onChange={(e) => setToken(e.target.value)}
            placeholder={c.token_set ? t('settings.heartbeat_token_set_ph', { tail: c.token_tail }) : t('settings.heartbeat_token_unset_ph')} />
          <p className="text-[11px] text-muted-foreground">
            {t('settings.heartbeat_token_hint')}
            <a href="https://account.dice.zone/dashboard/bindings" target="_blank" rel="noreferrer" className="underline text-primary">
              {t('settings.heartbeat_api_key_link')}
            </a>
          </p>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-sm">{t('settings.heartbeat_public')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.heartbeat_public_desc')}</p>
          </div>
          <Switch checked={c.public_show} onCheckedChange={(v) => setC({ ...c, public_show: v })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('settings.heartbeat_interval')}</Label>
          <Input className="h-8 w-32 text-sm" type="number" min={180} max={480} value={c.interval}
            onChange={(e) => setC({ ...c, interval: Number(e.target.value) || 0 })} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{t('settings.heartbeat_last')}</span>
          {statusBadge()}
          {c.last_report_at && <span className="text-muted-foreground">{c.last_report_at.replace('T', ' ').slice(0, 19)}</span>}
          {c.last_error && <span className="text-destructive truncate max-w-[280px]" title={c.last_error}>{c.last_error}</span>}
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={test} disabled={testing}>{testing ? t('settings.heartbeat_testing') : t('settings.heartbeat_test_now')}</Button>
          <Button size="sm" onClick={save} disabled={saving}>{t('common.save')}</Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ── 聊天记录保留期 ─────────────────────────────────────────
const ChatRetentionCard: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [days, setDays] = useState(7);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    (async () => {
      try { const d = await apiClient.get<{ retentionDays: number }>('/system/chat-config'); setDays(d.data.retentionDays ?? 7); }
      catch { /* ignore */ }
    })();
  }, []);
  const save = async () => {
    setSaving(true);
    try { await apiClient.put('/system/chat-config', { retentionDays: days }); toast({ title: t('common.save_success') }); }
    catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setSaving(false); }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('chatcfg.title')}</CardTitle>
        <CardDescription>{t('chatcfg.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('chatcfg.days')}</Label>
          <Input type="number" min={0} max={3650} className="h-9 w-28"
            value={days} onChange={(e) => setDays(Math.max(0, parseInt(e.target.value) || 0))} />
        </div>
        <Button size="sm" onClick={save} disabled={saving}>{t('common.save')}</Button>
        <p className="text-xs text-muted-foreground pb-2">{t('chatcfg.hint')}</p>
      </CardContent>
    </Card>
  );
};

// ── C#52: 自动清理好友 ───────────────────────────────────────────
const FriendCleanCard: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [days, setDays] = useState(0);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    (async () => {
      try { const d = await apiClient.get<{ days: number }>('/system/friend-clean'); setDays(d.data.days ?? 0); }
      catch { /* ignore */ }
    })();
  }, []);
  const save = async () => {
    setSaving(true);
    try { await apiClient.put('/system/friend-clean', { days }); toast({ title: t('common.save_success') }); }
    catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setSaving(false); }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('friendclean.title')}</CardTitle>
        <CardDescription>{t('friendclean.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t('friendclean.days')}</Label>
          <Input type="number" min={0} max={3650} className="h-9 w-28"
            value={days} onChange={(e) => setDays(Math.max(0, parseInt(e.target.value) || 0))} />
        </div>
        <Button size="sm" onClick={save} disabled={saving}>{t('common.save')}</Button>
        <p className="text-xs text-muted-foreground pb-2">{t('friendclean.hint')}</p>
      </CardContent>
    </Card>
  );
};

// ── C#51: 用户群 ─────────────────────────────────────────────────
const UserGroupCard: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [group, setGroup] = useState('');
  const [enforce, setEnforce] = useState(false);
  const [invite, setInvite] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const d = await apiClient.get<{ group: string; enforce: boolean; invite: boolean }>('/system/user-group');
        setGroup(d.data.group || ''); setEnforce(!!d.data.enforce); setInvite(d.data.invite !== false);
      } catch { /* ignore */ }
    })();
  }, []);
  const save = async () => {
    setSaving(true);
    try { await apiClient.put('/system/user-group', { group: group.trim(), enforce, invite }); toast({ title: t('common.save_success') }); }
    catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setSaving(false); }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('usergroup.title')}</CardTitle>
        <CardDescription>{t('usergroup.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1 max-w-xs">
            <Label className="text-xs">{t('usergroup.group')}</Label>
            <Input className="h-9" placeholder={t('usergroup.group_ph')} value={group} onChange={(e) => setGroup(e.target.value)} />
          </div>
          <Button size="sm" onClick={save} disabled={saving}>{t('common.save')}</Button>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={enforce} onCheckedChange={setEnforce} />
          <Label className="text-sm font-normal">{t('usergroup.enforce')}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={invite} onCheckedChange={setInvite} />
          <Label className="text-sm font-normal">{t('usergroup.invite')}</Label>
        </div>
        <p className="text-xs text-muted-foreground">{t('usergroup.hint')}</p>
      </CardContent>
    </Card>
  );
};

export default SettingsPage;
