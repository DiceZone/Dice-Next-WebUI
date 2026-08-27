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
  SlidersHorizontal, Crown, Globe, Plus, Trash2, ShieldCheck, Zap,
  Image, Type, Server, Clock, ScrollText, HeartPulse, Layers3, RotateCcw,
  ArrowUp, ArrowDown,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { PlatformIcon, platformLabel } from '@/components/platform-icon';

interface Master { platform: string; adapter_id?: string; id: string; nickname?: string; }
const PLATFORMS: { value: string; label: string }[] = [
  { value: 'onebot_v11', label: 'QQ' },
  { value: 'qq_official', label: 'OpenID' },
  { value: 'discord', label: 'Discord' },
  { value: 'kook', label: 'KOOK' },
];
const masterPlatLabel = (p: string) => (p ? platformLabel(p) : '任意');
// 常用时区（相对 UTC 的分钟偏移，东为正；null = 跟随系统）。
const TZ_OFFSETS: number[] = [
  -720, -660, -600, -540, -480, -420, -360, -300, -240, -180, -120, -60, 0,
  60, 120, 180, 240, 300, 330, 360, 420, 480, 540, 570, 600, 660, 720, 780, 840,
];
const tzLabel = (m: number) => {
  const sign = m < 0 ? '-' : '+';
  const abs = Math.abs(m);
  const h = Math.floor(abs / 60), min = abs % 60;
  return `UTC${sign}${h}${min ? ':' + String(min).padStart(2, '0') : ''}`;
};
const formatDateTimeAtOffset = (value: string, offsetMinutes: number) => {
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) return value;
  const date = new Date(epoch + offsetMinutes * 60_000);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} `
    + `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
};

type GOpt = { key: string; label: string; type: 'bool' | 'int'; hint?: string };
type GGroup = { title: string; opts: GOpt[] };
const GLOBAL_GROUPS: GGroup[] = [
  { title: '响应开关', opts: [
    { key: 'silent_global', label: '静默模式', hint: '非信任用户只响应 .bot；其余沉默', type: 'bool' },
    { key: 'disabled_jrrp', label: '禁用 .jrrp', type: 'bool' },
    { key: 'disabled_me', label: '禁用 .me', type: 'bool' },
    { key: 'disabled_deck', label: '禁用 .deck', type: 'bool' },
    { key: 'disabled_draw', label: '禁用 .draw', type: 'bool' },
    { key: 'disabled_send', label: '禁用 .send', type: 'bool' },
    { key: 'disabled_help', label: '禁用 .help', type: 'bool' },
    { key: 'listen_at_when_off', label: '停用时 @ 仍可触发', hint: '关闭后，bot off 状态下被 @ 也不会响应', type: 'bool' },
  ] },
  { title: '牌堆 / 显示', opts: [
    { key: 'deck_hide_underscore', label: '隐藏牌堆 _ 元数据键', hint: '.deck 列表不显示 _author/_title 等', type: 'bool' },
  ] },
  { title: '事件响应', opts: [
    { key: 'listen_group_request', label: '响应加群请求', type: 'bool' },
    { key: 'listen_group_add', label: '响应入群反馈（欢迎词）', type: 'bool' },
    { key: 'listen_friend_request', label: '响应好友请求', type: 'bool' },
    { key: 'listen_friend_add', label: '响应好友添加反馈', type: 'bool' },
    { key: 'leave_black_qq', label: '检测到黑名单用户时自动退群', type: 'bool' },
  ] },
  { title: '外部请求（自定义回复 {api:URL}）', opts: [
    { key: 'api_enabled', label: '启用 {api:URL} 外部请求', hint: '默认关闭；仅 http/https，自动拦截私网地址', type: 'bool' },
    { key: 'api_timeout', label: '请求超时（秒）', hint: '1–30', type: 'int' },
  ] },
  { title: '身份绑定（高风险）', opts: [
    { key: 'allow_official_direct_bind', label: '允许 QQ 官方窗口直接绑定真实 QQ', type: 'bool',
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
type SettingsScope = 'global' | 'adapter' | 'account';
interface ScopedCardProps {
  scope: SettingsScope;
  target: string;
  platform: string;
  overridden?: boolean;
  onReset?: () => void;
}
const scopedQuery = ({ scope, target, platform }: ScopedCardProps) => {
  const q = new URLSearchParams({ scope });
  if (target) q.set('target', target);
  if (platform) q.set('platform', platform);
  return q.toString();
};
const scopedBody = ({ scope, target, platform }: ScopedCardProps,
  values: Record<string, unknown>, clear?: string[]) => ({
  scope, target, platform, values, ...(clear ? { clear } : {}),
});
const scopeUnavailable = ({ scope, target }: ScopedCardProps) => scope !== 'global' && !target;

// ── 图片发送方式（C#56）──────────────────────────────────
interface ImageSendConf { mode?: string; host?: string; default_host?: string; }

const ImageSendCard: React.FC<ScopedCardProps> = (scopeProps) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [c, setC] = useState<ImageSendConf>({ mode: 'base64', host: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (scopeUnavailable(scopeProps)) return;
      try {
        const d = await getJson('/system/global?' + scopedQuery(scopeProps)) as any;
        const value = (d.values?.image_send || {}) as ImageSendConf;
        setC({ mode: value.mode || 'base64', host: value.host || '' });
      } catch { /* ignore */ }
    })();
  }, [scopeProps.scope, scopeProps.target, scopeProps.platform, scopeProps.overridden]);

  const save = async () => {
    if (scopeUnavailable(scopeProps)) return;
    setSaving(true);
    try {
      const d = await putJson('/system/global', scopedBody(scopeProps, {
        image_send: { mode: c.mode || 'base64', host: (c.host || '').trim() },
      })) as any;
      setC(d.values?.image_send || c);
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
        <div className="flex justify-end gap-2">
          {scopeProps.overridden && <Button size="sm" variant="outline" onClick={scopeProps.onReset}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />{t('settings.scope_reset')}</Button>}
          <Button size="sm" onClick={save} disabled={saving || scopeUnavailable(scopeProps)}>{t('common.save')}</Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ── 消息发送形式（传统文本 / 平台富卡片）──────────────────────
interface MessageFormatAdapter { id: string; type: string; name: string; loginId?: string; loginName?: string; appId?: string; mode?: string; }
const APPROVAL_SCOPE_KEYS = [
  'friend_policy', 'friend_keyword', 'group_invite_policy',
  'group_invite_reject_blacklist', 'group_invite_reject_nonfriend', 'group_name_keyword_leave',
];
const POKE_SCOPE_KEYS = ['poke', 'poke_command', 'poke_enabled'];
const EXPRESSION_SCOPE_KEYS = ['expression_mode', 'expression_order'];
type ExpressionMode = 'enhanced' | 'compatible' | 'original' | 'custom';
type ExpressionEngineId = 'dicenext' | 'onedice' | 'dicescript';
interface ExpressionEngineInfo { id: ExpressionEngineId; available: boolean; }
const EXPRESSION_ENGINES: ExpressionEngineId[] = ['dicenext', 'onedice', 'dicescript'];
interface MessageFormatConf { mode?: 'traditional' | 'card'; }

const MessageFormatCard: React.FC<ScopedCardProps> = (scopeProps) => {
  const toast = useToast();
  const { t } = useTranslation();
  const [mode, setMode] = useState<MessageFormatConf['mode']>('traditional');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (scopeUnavailable(scopeProps)) return;
      try {
        const d = await getJson('/system/global?' + scopedQuery(scopeProps)) as any;
        setMode(d.values?.message_format === 'card' ? 'card' : 'traditional');
      } catch { /* ignore */ }
    })();
  }, [scopeProps.scope, scopeProps.target, scopeProps.platform, scopeProps.overridden]);

  const save = async (nextMode: MessageFormatConf['mode']) => {
    if (scopeUnavailable(scopeProps) || saving) return;
    const previous = mode;
    setMode(nextMode);
    setSaving(true);
    try {
      const d = await putJson('/system/global', scopedBody(scopeProps, {
        message_format: nextMode === 'card' ? 'card' : 'traditional',
      })) as any;
      setMode(d.values?.message_format === 'card' ? 'card' : 'traditional');
      toast({ title: t('common.save_success') });
    } catch (e) {
      setMode(previous);
      toast({ title: (e as Error).message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const rich = mode === 'card';
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Type className="h-4 w-4" />{t('settings.message_format_title')}</CardTitle>
        <CardDescription>
          {t(scopeProps.scope === 'global' ? 'settings.message_format_desc_global' : 'settings.message_format_desc_scoped')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="min-w-0">
            <Label className="font-medium">{t('settings.message_format_switch')}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t(rich ? 'settings.message_format_rich' : 'settings.message_format_plain')}
            </p>
          </div>
          <Switch checked={rich} disabled={saving || scopeUnavailable(scopeProps)}
            onCheckedChange={(checked) => void save(checked ? 'card' : 'traditional')} />
        </div>
        <p className="text-xs text-muted-foreground">
          {t(rich ? 'settings.message_format_hint_rich' : 'settings.message_format_hint_plain')}
        </p>
        {scopeProps.scope !== 'global' && (
          <p className="text-[11px] text-muted-foreground">{t('settings.message_format_scope_hint')}</p>
        )}
        {scopeProps.overridden && (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={scopeProps.onReset}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />{t('settings.scope_reset')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
// ── 图床配置组件 ────────────────────────────────────────
interface ImageHostConf { mode?: string; url?: string; file_field?: string; result_path?: string; public_base?: string; headers?: string[]; }

const ImageHostCard: React.FC<ScopedCardProps> = (scopeProps) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [c, setC] = useState<ImageHostConf>({ mode: 'none', file_field: 'file', result_path: 'data.url' });
  const [headersText, setHeadersText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (scopeUnavailable(scopeProps)) return;
      try {
        const d = await getJson('/system/global?' + scopedQuery(scopeProps)) as any;
        const value = (d.values?.image_host || {}) as ImageHostConf;
        setC({ mode: value.mode || 'none', url: value.url || '', file_field: value.file_field || 'file', result_path: value.result_path || 'data.url', public_base: value.public_base || '' });
        setHeadersText((value.headers || []).join('\n'));
      } catch { /* ignore */ }
    })();
  }, [scopeProps.scope, scopeProps.target, scopeProps.platform, scopeProps.overridden]);

  const save = async () => {
    setSaving(true);
    try {
      const headers = headersText.split('\n').map((s) => s.trim()).filter(Boolean);
      const body: ImageHostConf = { mode: c.mode, url: c.url, file_field: c.file_field, result_path: c.result_path, public_base: c.public_base, headers };
      const d = await putJson('/system/global', scopedBody(scopeProps, { image_host: body })) as any;
      const value = (d.values?.image_host || body) as ImageHostConf;
      setC(value);
      setHeadersText((value.headers || []).join('\n'));
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
        <div className="flex justify-end gap-2">
          {scopeProps.overridden && <Button size="sm" variant="outline" onClick={scopeProps.onReset}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />{t('settings.scope_reset')}</Button>}
          <Button size="sm" onClick={save} disabled={saving || scopeUnavailable(scopeProps)}>{t('common.save')}</Button>
        </div>
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
  const [mAdapter, setMAdapter] = useState('');
  const [masterAccounts, setMasterAccounts] = useState<MessageFormatAdapter[]>([]);
  const [masterInherit, setMasterInherit] = useState(true);
  const [mId, setMId] = useState('');
  // — Scoped settings (#17): account > adapter type > global —
  const [settingsScope, setSettingsScope] = useState<SettingsScope>('global');
  const [settingsTarget, setSettingsTarget] = useState('');
  const [eventOverrides, setEventOverrides] = useState<Record<string, unknown>>({});
  const [eventSources, setEventSources] = useState<Record<string, string>>({});
  const [expressionMode, setExpressionMode] = useState<ExpressionMode>('enhanced');
  const [expressionOrder, setExpressionOrder] = useState<ExpressionEngineId[]>(EXPRESSION_ENGINES);
  const [expressionEngines, setExpressionEngines] = useState<ExpressionEngineInfo[]>([]);
  const [expressionOverrides, setExpressionOverrides] = useState<Record<string, unknown>>({});
  const [expressionSources, setExpressionSources] = useState<Record<string, string>>({});
  const [savingExpression, setSavingExpression] = useState(false);
  // — Prefixes —
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [savingPrefix, setSavingPrefix] = useState(false);
  // — Timezone (server/timezone_minutes; null = follow system) —
  const [tzMinutes, setTzMinutes] = useState<number | null>(null);
  const [tzEffectiveMinutes, setTzEffectiveMinutes] = useState(0);
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
  const [quoteReply, setQuoteReply] = useState(true);
  const [autoCard, setAutoCard] = useState(true);
  const [respondSelf, setRespondSelf] = useState(false);   // C#69：自响应/自控
  const [forwardLong, setForwardLong] = useState(false);
  const [forwardThreshold, setForwardThreshold] = useState(1200);
  const [segLen, setSegLen] = useState(600);
  const [segEnabled, setSegEnabled] = useState(true);
  const [segSaving, setSegSaving] = useState(false);
  const [nickPre, setNickPre] = useState('<');
  const [nickSuf, setNickSuf] = useState('>');
  const [nickSaving, setNickSaving] = useState(false);
  // — Globals —
  const [globals, setGlobals] = useState<Record<string, any>>({});
  const [globalOverrides, setGlobalOverrides] = useState<Record<string, unknown>>({});
  const [globalSources, setGlobalSources] = useState<Record<string, string>>({});
  // — 插件签名公钥（可选）—
  const [pluginKey, setPluginKey] = useState('');
  // — JS 插件网络访问（T8）—
  const [jsFetchStrict, setJsFetchStrict] = useState(false);

  // —— Loaders ———————————————————————————————————————————
  const loadMasters = async () => {
    try {
      const r = await fetch('/api/masters'); const j = await r.json();
      if (j.code === 0) { setMasters(j.data?.items || []); setMasterInherit(j.data?.master_inherit !== false); }
    } catch { /* ignore */ }
  };
  const loadMasterAccounts = async () => {
    try {
      const r = await fetch('/api/adapters'); const j = await r.json();
      if (j.code === 0) {
        setMasterAccounts((j.data || []).map((a: any) => ({
          id: String(a.id), type: a.type, name: a.name, loginId: a.loginId, loginName: a.loginName, appId: a.appId,
        })));
      }
    } catch { /* ignore */ }
  };
  const loadPrefixes = async () => {
    try { const r = await fetch('/api/system/prefixes'); const j = await r.json(); if (j.code === 0) setPrefixes(j.data?.prefixes || []); } catch { /* ignore */ }
  };
  const selectedScopeAccount = masterAccounts.find((a) => a.id === settingsTarget);
  const settingsPlatform = settingsScope === 'adapter'
    ? settingsTarget
    : settingsScope === 'account' ? (selectedScopeAccount?.type || '') : '';
  const applyEventData = useCallback((data: any) => {
    setFriendPolicy(data.friend_policy || 'manual');
    setFriendKeyword(data.friend_keyword || '');
    setGroupInvitePolicy(data.group_invite_policy || 'manual');
    setGroupRejectBlacklist(data.group_invite_reject_blacklist !== false);
    setGroupRejectNonfriend(data.group_invite_reject_nonfriend === true);
    setGroupNameKeywordLeave(data.group_name_keyword_leave || '');
    setPokeText(data.poke || '');
    setPokeCommand(data.poke_command || '');
    setPokeEnabled(data.poke_enabled !== false);
    setWelcomeMinDelay(data.welcome_min_delay || 0);
    setWelcomeMinCooldown(data.welcome_min_cooldown || 0);
    setEventOverrides(data.overrides || {});
    setEventSources(data.sources || {});
  }, []);
  const loadEvents = useCallback(async () => {
    if (settingsScope !== 'global' && !settingsTarget) return;
    try {
      const q = new URLSearchParams({ scope: settingsScope });
      if (settingsTarget) q.set('target', settingsTarget);
      if (settingsPlatform) q.set('platform', settingsPlatform);
      const r = await fetch('/api/system/events?' + q.toString()); const j = await r.json();
      if (j.code === 0) applyEventData(j.data);
    } catch { /* ignore */ }
  }, [settingsScope, settingsTarget, settingsPlatform, applyEventData]);
  const applyExpressionData = useCallback((data: any) => {
    const mode = ['enhanced', 'compatible', 'original', 'custom'].includes(data?.mode)
      ? data.mode as ExpressionMode : 'enhanced';
    const order = Array.isArray(data?.order)
      ? data.order.filter((id: string) => EXPRESSION_ENGINES.includes(id as ExpressionEngineId))
      : EXPRESSION_ENGINES;
    setExpressionMode(mode);
    setExpressionOrder(order.length ? order as ExpressionEngineId[] : EXPRESSION_ENGINES);
    setExpressionEngines(Array.isArray(data?.engines) ? data.engines : []);
    setExpressionOverrides(data?.overrides || {});
    setExpressionSources(data?.sources || {});
  }, []);
  const loadExpression = useCallback(async () => {
    if (settingsScope !== 'global' && !settingsTarget) return;
    try {
      const q = new URLSearchParams({ scope: settingsScope });
      if (settingsTarget) q.set('target', settingsTarget);
      if (settingsPlatform) q.set('platform', settingsPlatform);
      const r = await fetch('/api/system/expression-engine?' + q.toString()); const j = await r.json();
      if (j.code === 0) applyExpressionData(j.data);
    } catch { /* ignore */ }
  }, [settingsScope, settingsTarget, settingsPlatform, applyExpressionData]);
  const loadWebui = useCallback(async () => {
    try { setAutostart(!!(await getJson('/system/autostart')).enabled); } catch { /* ignore */ }
    try { setQuoteReply((await getJson('/system/quote-reply')).enabled !== false); } catch { /* ignore */ }
    try { setAutoCard((await getJson('/system/auto-card')).enabled !== false); } catch { /* ignore */ }
    try { setRespondSelf(!!(await getJson('/system/respond-self')).enabled); } catch { /* ignore */ }
    try { const d = await getJson('/system/forward-long'); setForwardLong(!!d.enabled); setForwardThreshold(Number(d.threshold) || 1200); } catch { /* ignore */ }
    try { const d = await getJson('/system/reply-segment'); setSegLen(Number(d.len) || 600); setSegEnabled(d.enabled !== false); } catch { /* ignore */ }
    try { const d = await getJson('/system/nick-wrap'); setNickPre(d.prefix ?? '<'); setNickSuf(d.suffix ?? '>'); } catch { /* ignore */ }
  }, []);
  const applyGlobalData = useCallback((data: any) => {
    setGlobals(data?.values || {});
    setGlobalOverrides(data?.overrides || {});
    setGlobalSources(data?.sources || {});
  }, []);
  const loadGlobals = useCallback(async () => {
    if (settingsScope !== 'global' && !settingsTarget) return;
    try {
      const r = await fetch('/api/system/global?' + scopedQuery({ scope: settingsScope, target: settingsTarget, platform: settingsPlatform }));
      const j = await r.json();
      if (j.code === 0) applyGlobalData(j.data);
    } catch { /* ignore */ }
  }, [settingsScope, settingsTarget, settingsPlatform, applyGlobalData]);
  const loadPluginVerify = async () => {
    try { const d = await getJson('/system/plugin-verify'); setPluginKey(d.public_key || ''); } catch { /* ignore */ }
  };
  const savePluginVerify = async () => {
    try { await putJson('/system/plugin-verify', { public_key: pluginKey }); toast({ title: t('common.save_success') }); }
    catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };
  const loadJsFetch = async () => {
    try { const d = await getJson('/system/js-fetch'); setJsFetchStrict(!!d.strict); } catch { /* ignore */ }
  };
  const toggleJsFetchStrict = async (v: boolean) => {
    setJsFetchStrict(v);
    try { await putJson('/system/js-fetch', { strict: v }); toast({ title: t('common.save_success') }); }
    catch (e) { setJsFetchStrict(!v); toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };
  const loadLogsite = async () => {
    try {
      const r = await fetch('/api/system/logsite'); const j = await r.json();
      if (j.code === 0) { setLogsiteUrl(j.data.url || ''); setLogsiteFormat(j.data.format || 'dicenext'); setLogsiteOfficial(j.data.official || ''); }
    } catch { /* ignore */ }
  };
  const loadTimezone = async () => {
    try {
      const r = await fetch('/api/system/timezone'); const j = await r.json();
      if (j.code === 0) {
        const configured = j.data?.offset_minutes ?? null;
        setTzMinutes(configured);
        setTzEffectiveMinutes(Number(j.data?.effective_offset_minutes ?? configured ?? 0));
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    void loadMasters(); void loadMasterAccounts(); void loadPrefixes(); void loadEvents(); void loadExpression(); void loadWebui(); void loadGlobals(); void loadPluginVerify(); void loadJsFetch(); void loadLogsite(); void loadTimezone();
  }, [loadWebui, loadEvents, loadExpression, loadGlobals]);

  // —— Handlers ——————————————————————————————————————————
  const addMaster = async () => {
    const id = mId.trim(); if (!id) return;
    if (mPlatform === 'qq_official' && !mAdapter) {
      toast({ title: t('settings.master_qq_need_account'), variant: 'destructive' }); return;
    }
    try {
      const r = await fetch('/api/masters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: mPlatform, adapter_id: mAdapter, id, master_inherit: masterInherit }) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      setMId(''); setMasters(j.data?.items || []); setMasterInherit(j.data?.master_inherit !== false); toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };
  const delMaster = async (m: Master) => {
    try {
      const r = await fetch(`/api/masters/${encodeURIComponent(m.platform || '_')}/${encodeURIComponent(m.adapter_id || '_')}/${encodeURIComponent(m.id)}`, { method: 'DELETE' });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      setMasters(j.data || []); toast({ title: t('common.delete_success') });
    } catch (e) { toast({ title: t('common.delete_fail'), description: String(e), variant: 'destructive' }); }
  };
  const masterAccountLabel = (a?: MessageFormatAdapter) => {
    if (!a) return '';
    const ident = a.type === 'qq_official' ? (a.appId || a.loginId || a.id) : (a.loginId || a.id);
    return `${a.loginName || a.name}(${ident})`;
  };
  const switchMasterPlatform = (v: string) => {
    setMPlatform(v);
    if (v === 'qq_official') {
      // OpenID 按 AppID 独立，平台级“全局”无意义：必须落到具体官机账号。
      const first = masterAccounts.find((a) => a.type === 'qq_official');
      setMAdapter(first ? first.id : '');
    } else if (mAdapter && !masterAccounts.some((a) => a.id === mAdapter && a.type === v)) {
      setMAdapter('');
    }
  };
  const saveMasterInherit = async (v: boolean) => {
    setMasterInherit(v);
    try {
      const r = await fetch('/api/masters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ master_inherit: v }) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      setMasters(j.data?.items || []); setMasterInherit(j.data?.master_inherit !== false);
      toast({ title: t('common.save_success') });
    } catch (e) { setMasterInherit(!v); toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
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
  const saveTimezone = async () => {
    try {
      const r = await fetch('/api/system/timezone', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offset_minutes: tzMinutes }) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      const configured = j.data?.offset_minutes ?? null;
      setTzMinutes(configured);
      setTzEffectiveMinutes(Number(j.data?.effective_offset_minutes ?? configured ?? 0));
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };
  const configuredPlatforms = PLATFORMS.filter((p) => masterAccounts.some((a) => a.type === p.value));
  const changeSettingsScope = (scope: SettingsScope) => {
    setSettingsScope(scope);
    if (scope === 'global') setSettingsTarget('');
    else if (scope === 'adapter') setSettingsTarget(configuredPlatforms[0]?.value || PLATFORMS[0].value);
    else setSettingsTarget(masterAccounts[0]?.id || '');
  };
  const scopedEventBody = (values: Record<string, unknown>, clear?: string[]) => ({
    scope: settingsScope,
    target: settingsTarget,
    platform: settingsPlatform,
    values,
    ...(clear ? { clear } : {}),
  });
  const saveEvents = async () => {
    setSavingEvents(true);
    try {
      const r = await fetch('/api/system/events', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scopedEventBody({
          friend_policy: friendPolicy,
          friend_keyword: friendKeyword,
          group_invite_policy: groupInvitePolicy,
          group_invite_reject_blacklist: groupRejectBlacklist,
          group_invite_reject_nonfriend: groupRejectNonfriend,
          group_name_keyword_leave: groupNameKeywordLeave.trim(),
        })) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      applyEventData(j.data);
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setSavingEvents(false); }
  };
  const saveWelcomeMinimums = async () => {
    setSavingEvents(true);
    try {
      const r = await fetch('/api/system/events', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scopedEventBody({ welcome_min_delay: welcomeMinDelay, welcome_min_cooldown: welcomeMinCooldown })) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      applyEventData(j.data);
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setSavingEvents(false); }
  };
  const resetEventScope = async (keys: string[]) => {
    if (settingsScope === 'global') return;
    try {
      const r = await fetch('/api/system/events', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scopedEventBody({}, keys)) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      applyEventData(j.data);
      toast({ title: t('settings.scope_reset_success') });
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };
  const hasScopeOverride = (keys: string[]) => settingsScope !== 'global' && keys.some((key) => Object.prototype.hasOwnProperty.call(eventOverrides, key));
  const scopeSourceLabel = (keys: string[]) => {
    if (settingsScope === 'global') return t('settings.scope_badge_global');
    if (hasScopeOverride(keys)) return settingsScope === 'account'
      ? t('settings.scope_badge_account') : t('settings.scope_badge_adapter');
    const sources = new Set(keys.map((key) => eventSources[key]).filter(Boolean));
    return sources.has('adapter') ? t('settings.scope_inherit_adapter') : t('settings.scope_inherit_global');
  };
  const hasExpressionOverride = settingsScope !== 'global' && EXPRESSION_SCOPE_KEYS.some(
    (key) => Object.prototype.hasOwnProperty.call(expressionOverrides, key));
  const expressionSourceLabel = () => {
    if (settingsScope === 'global') return t('settings.scope_badge_global');
    if (hasExpressionOverride) return settingsScope === 'account'
      ? t('settings.scope_badge_account') : t('settings.scope_badge_adapter');
    const sources = new Set(EXPRESSION_SCOPE_KEYS.map((key) => expressionSources[key]).filter(Boolean));
    return sources.has('adapter') ? t('settings.scope_inherit_adapter') : t('settings.scope_inherit_global');
  };
  const expressionAvailable = (id: ExpressionEngineId) =>
    expressionEngines.find((engine) => engine.id === id)?.available !== false;
  const toggleExpressionEngine = (id: ExpressionEngineId, enabled: boolean) => {
    if (!expressionAvailable(id)) return;
    if (enabled) {
      if (!expressionOrder.includes(id)) setExpressionOrder([...expressionOrder, id]);
    } else if (expressionOrder.length > 1) {
      setExpressionOrder(expressionOrder.filter((engine) => engine !== id));
    } else {
      toast({ title: t('settings.expression_need_one'), variant: 'destructive' });
    }
  };
  const moveExpressionEngine = (id: ExpressionEngineId, delta: -1 | 1) => {
    const index = expressionOrder.indexOf(id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= expressionOrder.length) return;
    const order = [...expressionOrder];
    [order[index], order[next]] = [order[next], order[index]];
    setExpressionOrder(order);
  };
  const saveExpression = async () => {
    setSavingExpression(true);
    try {
      const r = await fetch('/api/system/expression-engine', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scopedEventBody({ expression_mode: expressionMode, expression_order: expressionOrder })),
      });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      applyExpressionData(j.data);
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setSavingExpression(false); }
  };
  const resetExpressionScope = async () => {
    if (settingsScope === 'global') return;
    try {
      const r = await fetch('/api/system/expression-engine', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scopedEventBody({}, EXPRESSION_SCOPE_KEYS)),
      });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      applyExpressionData(j.data);
      toast({ title: t('settings.scope_reset_success') });
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
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
        body: JSON.stringify(scopedEventBody({ poke: pokeText, poke_command: pokeCommand, poke_enabled: pokeEnabled })) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      applyEventData(j.data);
      toast({ title: t('common.save_success') });
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setSavingPoke(false); }
  };
  const saveGlobal = async (key: string, value: boolean | number | string | Record<string, unknown>) => {
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
      const r = await fetch('/api/system/global', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scopedEventBody({ [key]: value })) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      applyGlobalData(j.data);
      toast({ title: t('common.save_success') });
    } catch (e) { void loadGlobals(); toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };
  const resetGlobalScope = async (keys: string[]) => {
    if (settingsScope === 'global') return;
    try {
      const r = await fetch('/api/system/global', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scopedEventBody({}, keys)) });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      applyGlobalData(j.data);
      toast({ title: t('settings.scope_reset_success') });
    } catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
  };
  const globalScopeLabel = (keys: string[]) => {
    if (settingsScope === 'global') return t('settings.scope_badge_global');
    if (keys.some((key) => Object.prototype.hasOwnProperty.call(globalOverrides, key)))
      return settingsScope === 'account' ? t('settings.scope_badge_account') : t('settings.scope_badge_adapter');
    return keys.some((key) => globalSources[key] === 'adapter') ? t('settings.scope_inherit_adapter') : t('settings.scope_inherit_global');
  };

  const toggleAutostart = async (v: boolean) => {
    setAutostart(v);
    try { const d = await putJson('/system/autostart', { enabled: v }); setAutostart(!!d.enabled); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); setAutostart(!v); }
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
    try { const d = await putJson('/system/reply-segment', { enabled: segEnabled, len: segLen }); setSegLen(Number(d.len) || 600); setSegEnabled(d.enabled !== false); toast({ title: t('common.save_success') }); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setSegSaving(false); }
  };
  const saveNickWrap = async () => {
    setNickSaving(true);
    try { await putJson('/system/nick-wrap', { prefix: nickPre, suffix: nickSuf }); toast({ title: t('common.save_success') }); }
    catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setNickSaving(false); }
  };

  const currentScopeProps: ScopedCardProps = {
    scope: settingsScope, target: settingsTarget, platform: settingsPlatform,
  };
  const renderGlobalGroup = (title: string) => {
    const group = GLOBAL_GROUPS.find((item) => item.title === title);
    if (!group) return null;
    const keys = group.opts.map((option) => option.key);
    const hasOverride = settingsScope !== 'global'
      && keys.some((key) => Object.prototype.hasOwnProperty.call(globalOverrides, key));
    return (
      <Card key={group.title}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" />{group.title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={hasOverride ? 'default' : 'secondary'}>{globalScopeLabel(keys)}</Badge>
              {hasOverride && <Button size="sm" variant="outline" onClick={() => void resetGlobalScope(keys)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />{t('settings.scope_reset')}</Button>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {group.opts.map((option) => (
            <div key={option.key} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label htmlFor={`g-${option.key}`} className="font-normal">{option.label}</Label>
                {option.hint && <p className="text-[11px] text-muted-foreground">{option.hint}</p>}
              </div>
              {option.type === 'bool' ? (
                <Switch id={`g-${option.key}`} checked={!!globals[option.key]} onCheckedChange={(value) => void saveGlobal(option.key, value)} />
              ) : (
                <Input id={`g-${option.key}`} type="number" className="w-24" value={String(globals[option.key] ?? 0)}
                  onChange={(event) => setGlobals((current) => ({ ...current, [option.key]: Number(event.target.value) }))}
                  onBlur={(event) => void saveGlobal(option.key, Number(event.target.value))} />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
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
                <div key={`${m.platform}/${m.adapter_id || ''}/${m.id}`} className="flex items-center justify-between rounded border p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 text-xs font-medium"><PlatformIcon platform={m.platform} className="h-3.5 w-3.5" />{masterPlatLabel(m.platform)}</span>
                    {m.adapter_id ? (
                      <span className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 text-xs font-medium">{masterAccountLabel(masterAccounts.find((a) => a.id === m.adapter_id)) || m.adapter_id}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{t('settings.master_all_accounts')}</span>
                    )}
                    <span className="font-mono text-sm">{m.nickname ? `${m.nickname}(${m.id})` : m.id}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => delMaster(m)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Select value={mPlatform} onValueChange={switchMasterPlatform}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}><span className="flex items-center gap-2"><PlatformIcon platform={p.value} />{p.label}</span></SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={mPlatform === 'qq_official' ? (mAdapter || '__none__') : (mAdapter || '__all__')} onValueChange={(v) => setMAdapter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {mPlatform !== 'qq_official' && <SelectItem value="__all__">{t('settings.master_all_accounts')}</SelectItem>}
                {masterAccounts.filter((a) => a.type === mPlatform).map((a) => (
                  <SelectItem key={a.id} value={a.id} className="pr-2">
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <PlatformIcon platform={a.type} className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{masterAccountLabel(a)}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input className="flex-1" placeholder={mPlatform === 'qq_official' ? t('settings.master_id_placeholder_qq') : t('settings.master_id_placeholder')} value={mId} onChange={(e) => setMId(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addMaster(); }} />
            <Button onClick={addMaster}><Plus className="mr-2 h-4 w-4" />{t('settings.master_add')}</Button>
          </div>
          {mPlatform === 'qq_official' && (
            <p className="text-xs text-muted-foreground">{t('settings.master_openid_hint')}</p>
          )}
          <div className="flex items-center justify-between rounded border p-2.5">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t('settings.master_inherit_title')}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.master_inherit_desc')}</p>
            </div>
            <Switch checked={masterInherit} onCheckedChange={(v) => void saveMasterInherit(v)} />
          </div>
        </CardContent>
      </Card>

      {/* ── 插件签名（可选）── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{t('settings.plugin_verify_title')}</CardTitle>
          <CardDescription>{t('settings.plugin_verify_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={pluginKey} onChange={(e) => setPluginKey(e.target.value)} rows={4} placeholder={t('settings.plugin_verify_placeholder')} />
          <p className="text-xs text-muted-foreground">{t('settings.plugin_verify_hint')}</p>
          <div className="flex justify-end"><Button size="sm" onClick={() => void savePluginVerify()}>{t('common.save')}</Button></div>
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

      {/* ── 时区 ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />{t('settings.timezone_title')}</CardTitle>
          <CardDescription>{t('settings.timezone_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Select value={tzMinutes === null ? 'auto' : String(tzMinutes)} onValueChange={(v) => setTzMinutes(v === 'auto' ? null : Number(v))}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t('settings.timezone_auto')}</SelectItem>
                {TZ_OFFSETS.map((m) => <SelectItem key={m} value={String(m)}>{tzLabel(m)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={saveTimezone}>{t('common.save')}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.timezone_hint')}</p>
        </CardContent>
      </Card>

      <SectionHeading>{t('settings.sec_scoped')}</SectionHeading>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Layers3 className="h-4 w-4" />{t('settings.scope_title')}</CardTitle>
          <CardDescription>{t('settings.scope_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {([
              ['global', t('settings.scope_global')],
              ['adapter', t('settings.scope_adapter')],
              ['account', t('settings.scope_account')],
            ] as [SettingsScope, string][]).map(([value, label]) => (
              <Button key={value} type="button" size="sm"
                variant={settingsScope === value ? 'default' : 'outline'}
                onClick={() => changeSettingsScope(value)}>{label}</Button>
            ))}
          </div>
          {settingsScope === 'adapter' && (
            <Select value={settingsTarget} onValueChange={setSettingsTarget}>
              <SelectTrigger><SelectValue placeholder={t('settings.scope_select_adapter')} /></SelectTrigger>
              <SelectContent>
                {(configuredPlatforms.length ? configuredPlatforms : PLATFORMS).map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center gap-2"><PlatformIcon platform={p.value} />{p.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {settingsScope === 'account' && (
            <Select value={settingsTarget} onValueChange={setSettingsTarget}>
              <SelectTrigger><SelectValue placeholder={t('settings.scope_select_account')} /></SelectTrigger>
              <SelectContent>
                {masterAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="flex items-center gap-2"><PlatformIcon platform={a.type} />{masterAccountLabel(a)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            {settingsScope === 'global' ? t('settings.scope_current_global')
              : settingsScope === 'adapter' ? t('settings.scope_current_adapter', { name: platformLabel(settingsTarget) })
              : selectedScopeAccount ? t('settings.scope_current_account', {
                  platform: platformLabel(selectedScopeAccount.type),
                  account: masterAccountLabel(selectedScopeAccount),
                }) : t('settings.scope_current_none')}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2"><Layers3 className="h-4 w-4" />{t('settings.expression_title')}</CardTitle>
            <Badge variant={hasExpressionOverride ? 'default' : 'secondary'}>{expressionSourceLabel()}</Badge>
          </div>
          <CardDescription>{t('settings.expression_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('settings.expression_mode')}</Label>
            <Select value={expressionMode} onValueChange={(value) => setExpressionMode(value as ExpressionMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="enhanced">{t('settings.expression_enhanced')}</SelectItem>
                <SelectItem value="compatible">{t('settings.expression_compatible')}</SelectItem>
                <SelectItem value="original">{t('settings.expression_original')}</SelectItem>
                <SelectItem value="custom">{t('settings.expression_custom')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t(`settings.expression_${expressionMode}_desc`)}</p>
          </div>

          {expressionMode === 'custom' ? (
            <div className="space-y-2">
              <Label>{t('settings.expression_order')}</Label>
              {EXPRESSION_ENGINES.map((id) => {
                const enabled = expressionOrder.includes(id);
                const index = expressionOrder.indexOf(id);
                const available = expressionAvailable(id);
                return (
                  <div key={id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                    <Switch checked={enabled} disabled={!available}
                      onCheckedChange={(checked) => toggleExpressionEngine(id, checked)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{t(`settings.expression_engine_${id}`)}</span>
                        {!available && <Badge variant="secondary">{t('settings.expression_unavailable')}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{t(`settings.expression_engine_${id}_desc`)}</p>
                    </div>
                    {enabled && (
                      <div className="flex items-center gap-1">
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8"
                          disabled={index <= 0} onClick={() => moveExpressionEngine(id, -1)} aria-label={t('settings.expression_move_up')}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8"
                          disabled={index < 0 || index >= expressionOrder.length - 1}
                          onClick={() => moveExpressionEngine(id, 1)} aria-label={t('settings.expression_move_down')}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">{t('settings.expression_order_hint')}</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
              {(expressionMode === 'original' ? ['dicenext']
                : expressionMode === 'compatible' ? ['dicenext', 'onedice']
                  : ['dicenext', 'onedice', 'dicescript']).map((id, index, list) => (
                    <React.Fragment key={id}>
                      <Badge variant="outline">{t(`settings.expression_engine_${id}`)}</Badge>
                      {index < list.length - 1 && <span className="text-muted-foreground">→</span>}
                    </React.Fragment>
                  ))}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {settingsScope !== 'global' && hasExpressionOverride && (
              <Button size="sm" variant="outline" onClick={() => void resetExpressionScope()}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />{t('settings.scope_reset')}
              </Button>
            )}
            <Button size="sm" onClick={saveExpression}
              disabled={savingExpression || (settingsScope !== 'global' && !settingsTarget)}>{t('common.save')}</Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 好友 / 加群邀请审批 ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{t('settings.approval_title')}</CardTitle><Badge variant={hasScopeOverride(APPROVAL_SCOPE_KEYS) ? 'default' : 'secondary'}>{scopeSourceLabel(APPROVAL_SCOPE_KEYS)}</Badge></div>
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
                <SelectItem value="whitelist">{t('settings.approval_friend_whitelist')}</SelectItem>
                <SelectItem value="group_used">{t('settings.approval_friend_group_used')}</SelectItem>
                <SelectItem value="nonblacklist">{t('settings.approval_friend_nonblacklist')}</SelectItem>
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
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={saveEvents} disabled={savingEvents || (settingsScope !== 'global' && !settingsTarget)}>{t('common.save')}</Button>
            {settingsScope !== 'global' && hasScopeOverride(APPROVAL_SCOPE_KEYS) && (
              <Button size="sm" variant="outline" onClick={() => void resetEventScope(APPROVAL_SCOPE_KEYS)}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />{t('settings.scope_reset')}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">{t('settings.approval_note')}</span>
          </div>
        </CardContent>
      </Card>

      {/* ── 戳一戳 (独立容器) ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" />{t('settings.poke_title')}</CardTitle><Badge variant={hasScopeOverride(POKE_SCOPE_KEYS) ? 'default' : 'secondary'}>{scopeSourceLabel(POKE_SCOPE_KEYS)}</Badge></div>
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
          <div className="flex flex-wrap justify-end gap-2">
            {settingsScope !== 'global' && hasScopeOverride(POKE_SCOPE_KEYS) && (
              <Button size="sm" variant="outline" onClick={() => void resetEventScope(POKE_SCOPE_KEYS)}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />{t('settings.scope_reset')}
              </Button>
            )}
            <Button size="sm" onClick={savePoke} disabled={savingPoke || (settingsScope !== 'global' && !settingsTarget)}>{t('common.save')}</Button>
          </div>
        </CardContent>
      </Card>

      <SectionHeading>{t('settings.sec_group_services')}</SectionHeading>

      {/* C#76: Welcome delay/cooldown minimums */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />{t('settings.welcome_min_title')}</CardTitle><Badge variant={hasScopeOverride(['welcome_min_delay', 'welcome_min_cooldown']) ? 'default' : 'secondary'}>{scopeSourceLabel(['welcome_min_delay', 'welcome_min_cooldown'])}</Badge></div>
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
            {settingsScope !== 'global' && hasScopeOverride(['welcome_min_delay', 'welcome_min_cooldown']) && (
              <Button size="sm" variant="outline" onClick={() => void resetEventScope(['welcome_min_delay', 'welcome_min_cooldown'])}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />{t('settings.scope_reset')}</Button>
            )}
            <Button size="sm" onClick={saveWelcomeMinimums} disabled={savingEvents || scopeUnavailable(currentScopeProps)}>{t('common.save')}</Button>
          </div>
        </CardContent>
      </Card>

      {/* 用户群 */}
      <UserGroupCard {...currentScopeProps}
        overridden={settingsScope !== 'global' && ['user_group', 'user_group_enforce', 'user_group_invite'].some((key) => Object.prototype.hasOwnProperty.call(globalOverrides, key))}
        onReset={() => void resetGlobalScope(['user_group', 'user_group_enforce', 'user_group_invite'])} />
      {renderGlobalGroup('事件响应')}
      {/* 自动清理好友与群聊 */}
      <FriendCleanCard />

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
        <SettingSwitch
          title={t('settings.seg_enabled')}
          desc={t('settings.seg_enabled_desc')}
          checked={segEnabled}
          onToggle={async (v) => {
            setSegEnabled(v);
            try { const d = await putJson('/system/reply-segment', { enabled: v, len: segLen }); setSegLen(Number(d.len) || 600); toast({ title: t('common.save_success') }); }
            catch (e) { setSegEnabled(!v); toast({ title: (e as Error).message, variant: 'destructive' }); }
          }}
        />
        <SettingRow title={t('settings.seg_len')} desc={t('settings.seg_len_desc')}>
          <Input type="number" min={100} max={1000} disabled={!segEnabled} className="h-9 w-24 text-sm" value={segLen} onChange={(e) => setSegLen(Number(e.target.value))} />
          <Button size="sm" onClick={saveSegLen} disabled={segSaving || !segEnabled}>{t('common.save')}</Button>
        </SettingRow>
        <SettingRow title={t('settings.nick_wrap')} desc={t('settings.nick_wrap_desc')}
          extra={<p className="text-xs text-muted-foreground mt-0.5 font-mono">{nickPre}{t('settings.nick_sample')}{nickSuf}</p>}>
          <Input className="h-9 w-14 text-sm text-center" maxLength={4} placeholder="<" value={nickPre} onChange={(e) => setNickPre(e.target.value)} />
          <Input className="h-9 w-14 text-sm text-center" maxLength={4} placeholder=">" value={nickSuf} onChange={(e) => setNickSuf(e.target.value)} />
          <Button size="sm" onClick={saveNickWrap} disabled={nickSaving}>{t('common.save')}</Button>
        </SettingRow>
      </SettingGroup>

      <MessageFormatCard {...currentScopeProps}
        overridden={settingsScope !== 'global' && Object.prototype.hasOwnProperty.call(globalOverrides, 'message_format')}
        onReset={() => void resetGlobalScope(['message_format'])} />
      {renderGlobalGroup('响应开关')}
      {renderGlobalGroup('牌堆 / 显示')}

      <SectionHeading>{t('settings.sec_data')}</SectionHeading>

      <SettingGroup>
        <SettingSwitch title={t('settings.save_images')} desc={t('settings.save_images_desc')} checked={!!globals.save_log_images} onToggle={(value) => void saveGlobal('save_log_images', value)} />
        {settingsScope !== 'global' && Object.prototype.hasOwnProperty.call(globalOverrides, 'save_log_images') && <div className="flex justify-end py-3"><Button size="sm" variant="outline" onClick={() => void resetGlobalScope(['save_log_images'])}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />{t('settings.scope_reset')}</Button></div>}
      </SettingGroup>

      {/* 图片发送方式 */}
      <ImageSendCard {...currentScopeProps}
        overridden={settingsScope !== 'global' && Object.prototype.hasOwnProperty.call(globalOverrides, 'image_send')}
        onReset={() => void resetGlobalScope(['image_send'])} />
      {/* 图床 */}
      <ImageHostCard {...currentScopeProps}
        overridden={settingsScope !== 'global' && Object.prototype.hasOwnProperty.call(globalOverrides, 'image_host')}
        onReset={() => void resetGlobalScope(['image_host'])} />
      {/* 聊天记录保留期 */}
      <ChatRetentionCard {...currentScopeProps}
        overridden={settingsScope !== 'global' && Object.prototype.hasOwnProperty.call(globalOverrides, 'chat_retention_days')}
        onReset={() => void resetGlobalScope(['chat_retention_days'])} />

      <SectionHeading>{t('settings.sec_network')}</SectionHeading>

      {/* ── JS 插件网络访问（T8，默认放行对齐海豹）── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" />{t('settings.js_fetch_title')}</CardTitle>
          <CardDescription>{t('settings.js_fetch_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded border p-2.5">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t('settings.js_fetch_strict_title')}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.js_fetch_strict_desc')}</p>
            </div>
            <Switch checked={jsFetchStrict} onCheckedChange={(value) => void toggleJsFetchStrict(value)} />
          </div>
        </CardContent>
      </Card>
      {renderGlobalGroup('外部请求（自定义回复 {api:URL}）')}
      {/* 心跳上报（heart.dice.zone）*/}
      <HeartbeatCard timezoneMinutes={tzEffectiveMinutes} />

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
      <SectionHeading>{t('settings.sec_maintenance')}</SectionHeading>

      <SettingGroup>
        <SettingSwitch title={t('settings.autostart')} desc={t('settings.autostart_desc')} checked={autostart} onToggle={toggleAutostart} />
      </SettingGroup>

      <SectionHeading>{t('settings.sec_security')}</SectionHeading>
      {renderGlobalGroup('身份绑定（高风险）')}

      {dlg.node}
    </div>
  );
};

// ── 心跳上报（向 heart.dice.zone 上报骰娘在线状态）────────────────
interface HeartbeatConf {
  enabled: boolean; url: string; configured_adapters: number;
  public_show: boolean; interval: number;
  master_qq: string; master_nickname: string;
  effective_master_qq: string; effective_master_nickname: string; master_source: string;
  last_status: string; last_report_at: string; last_error: string;
}

const HeartbeatCard: React.FC<{ timezoneMinutes: number }> = ({ timezoneMinutes }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [c, setC] = useState<HeartbeatConf>({
    enabled: false, url: 'https://heart.dice.zone', configured_adapters: 0,
    public_show: true, interval: 300,
    master_qq: '', master_nickname: '', effective_master_qq: '', effective_master_nickname: '', master_source: 'none',
    last_status: '', last_report_at: '', last_error: '',
  });
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
        enabled: c.enabled, url: c.url.trim(),
        public_show: c.public_show, interval,
        master_qq: c.master_qq.trim(), master_nickname: c.master_nickname.trim(),
      });
      await load();
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
      let payload: { results?: Array<{ adapter_name?: string; http?: number; body?: string }> } = {};
      try {
        payload = typeof d.body === 'string' ? JSON.parse(d.body) : (d.body || d);
      } catch {
        payload = {};
      }
      const results = Array.isArray(payload.results) ? payload.results : [];
      const rateLimited = results.filter((item) => {
        try {
          const body = typeof item.body === 'string' ? JSON.parse(item.body) : item.body;
          return body?.status === 'rate_limited';
        } catch {
          return false;
        }
      }).length;
      const failed = results.filter((item) => item.http !== 200);
      if (failed.length > 0) {
        const first = failed[0];
        throw new Error(`${first.adapter_name || t('nav.adapters')}: HTTP ${first.http ?? '?'}`);
      }
      toast({
        title: t('settings.heartbeat_test_success'),
        description: rateLimited > 0
          ? t('settings.heartbeat_test_rate_limited', { count: rateLimited, total: results.length })
          : t('settings.heartbeat_test_success_desc', { count: results.length }),
      });
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
        <div className="space-y-3 rounded-md border bg-muted/20 p-3">
          <div>
            <Label className="text-sm">{t('settings.heartbeat_master_title')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.heartbeat_master_desc')}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">{t('settings.heartbeat_master_nickname')}</Label>
              <Input className="h-8 text-sm" value={c.master_nickname} maxLength={128}
                onChange={(e) => setC({ ...c, master_nickname: e.target.value })}
                placeholder={t('settings.heartbeat_master_nickname_placeholder')} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('settings.heartbeat_master_qq')}</Label>
              <Input className="h-8 font-mono text-sm" value={c.master_qq} inputMode="numeric" maxLength={20}
                onChange={(e) => setC({ ...c, master_qq: e.target.value.replace(/\D/g, '').slice(0, 20) })}
                placeholder={t('settings.heartbeat_master_qq_placeholder')} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{c.master_source === 'none'
            ? t('settings.heartbeat_master_effective_none')
            : t('settings.heartbeat_master_effective', {
                source: t(c.master_source === 'manual' ? 'settings.heartbeat_master_source_manual' : 'settings.heartbeat_master_source_auto'),
                nickname: c.effective_master_nickname || '—', qq: c.effective_master_qq || '—',
              })}</p>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/20 p-3">
          <div>
            <Label className="text-sm">{t('settings.heartbeat_adapter_keys')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.heartbeat_adapter_keys_desc')}</p>
          </div>
          <a href="#/adapters" className="shrink-0 text-sm text-primary underline-offset-4 hover:underline">
            {t('settings.heartbeat_adapter_keys_count', { count: c.configured_adapters })}
          </a>
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
          {c.last_report_at && <span className="text-muted-foreground">{formatDateTimeAtOffset(c.last_report_at, timezoneMinutes)}</span>}
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
const ChatRetentionCard: React.FC<ScopedCardProps> = (scopeProps) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [days, setDays] = useState(7);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    (async () => {
      if (scopeUnavailable(scopeProps)) return;
      try {
        const d = await getJson('/system/global?' + scopedQuery(scopeProps)) as any;
        setDays(Number(d.values?.chat_retention_days ?? 7));
      }
      catch { /* ignore */ }
    })();
  }, [scopeProps.scope, scopeProps.target, scopeProps.platform, scopeProps.overridden]);
  const save = async () => {
    if (scopeUnavailable(scopeProps)) return;
    setSaving(true);
    try {
      const d = await putJson('/system/global', scopedBody(scopeProps, { chat_retention_days: days })) as any;
      setDays(Number(d.values?.chat_retention_days ?? days));
      toast({ title: t('common.save_success') });
    }
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
        {scopeProps.overridden && <Button size="sm" variant="outline" onClick={scopeProps.onReset}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />{t('settings.scope_reset')}</Button>}
        <Button size="sm" onClick={save} disabled={saving || scopeUnavailable(scopeProps)}>{t('common.save')}</Button>
        <p className="text-xs text-muted-foreground pb-2">{t('chatcfg.hint')}</p>
      </CardContent>
    </Card>
  );
};

// ── C#52: 自动清理好友与群聊 ─────────────────────────────────────
const FriendCleanCard: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [days, setDays] = useState(0);
  const [groupLimit, setGroupLimit] = useState(20);
  const [maxGroupSize, setMaxGroupSize] = useState(0);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const d = await apiClient.get<{ days: number; groupLimit: number; maxGroupSize: number }>('/system/friend-clean');
        setDays(d.data.days ?? 0);
        setGroupLimit(d.data.groupLimit ?? 20);
        setMaxGroupSize(d.data.maxGroupSize ?? 0);
      }
      catch { /* ignore */ }
    })();
  }, []);
  const save = async () => {
    setSaving(true);
    try {
      const d = await apiClient.put<{ days: number; groupLimit: number; maxGroupSize: number }>('/system/friend-clean', { days, groupLimit, maxGroupSize });
      setDays(d.data.days); setGroupLimit(d.data.groupLimit); setMaxGroupSize(d.data.maxGroupSize);
      toast({ title: t('common.save_success') });
    }
    catch (e) { toast({ title: t('common.save_fail'), description: String(e), variant: 'destructive' }); }
    finally { setSaving(false); }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('friendclean.title')}</CardTitle>
        <CardDescription>{t('friendclean.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('friendclean.days')}</Label>
            <Input type="number" min={0} max={3650} className="h-9"
              value={days} onChange={(e) => setDays(Math.max(0, parseInt(e.target.value) || 0))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('friendclean.group_limit')}</Label>
            <Input type="number" min={0} max={10000} className="h-9"
              value={groupLimit} onChange={(e) => setGroupLimit(Math.max(0, parseInt(e.target.value) || 0))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('friendclean.max_group_size')}</Label>
            <Input type="number" min={0} max={100000} className="h-9"
              value={maxGroupSize} onChange={(e) => setMaxGroupSize(Math.max(0, parseInt(e.target.value) || 0))} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t('friendclean.hint')}</p>
          <Button size="sm" onClick={save} disabled={saving}>{t('common.save')}</Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ── C#51: 用户群 ─────────────────────────────────────────────────
const UserGroupCard: React.FC<ScopedCardProps> = (scopeProps) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [group, setGroup] = useState('');
  const [enforce, setEnforce] = useState(false);
  const [invite, setInvite] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    (async () => {
      if (scopeUnavailable(scopeProps)) return;
      try {
        const d = await getJson('/system/global?' + scopedQuery(scopeProps)) as any;
        setGroup(d.values?.user_group || '');
        setEnforce(!!d.values?.user_group_enforce);
        setInvite(d.values?.user_group_invite !== false);
      } catch { /* ignore */ }
    })();
  }, [scopeProps.scope, scopeProps.target, scopeProps.platform, scopeProps.overridden]);
  const save = async () => {
    if (scopeUnavailable(scopeProps)) return;
    setSaving(true);
    try {
      const d = await putJson('/system/global', scopedBody(scopeProps, { user_group: group.trim(), user_group_enforce: enforce, user_group_invite: invite })) as any;
      setGroup(d.values?.user_group || ''); setEnforce(!!d.values?.user_group_enforce); setInvite(d.values?.user_group_invite !== false);
      toast({ title: t('common.save_success') });
    }
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
          {scopeProps.overridden && <Button size="sm" variant="outline" onClick={scopeProps.onReset}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />{t('settings.scope_reset')}</Button>}
          <Button size="sm" onClick={save} disabled={saving || scopeUnavailable(scopeProps)}>{t('common.save')}</Button>
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
