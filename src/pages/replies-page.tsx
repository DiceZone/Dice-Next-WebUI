import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTourState, useTourValue } from '@/components/onboarding/tour-data';
import { tourSamples } from '@/lib/tour-samples';
import { useTranslation } from 'react-i18next';
import { ReplyTable } from '@/components/reply/reply-table';
import { ReplyForm } from '@/components/reply/reply-form';
import { ReplyMatchPreview } from '@/components/reply/reply-match-preview';
import { BroadcastBar } from '@/components/reply/broadcast-bar';
import { PokeReplyButton } from '@/components/reply/poke-reply-button';
import { CausalRuleTable } from '@/components/causal/causal-rule-table';
import { CausalRuleEditor } from '@/components/causal/causal-rule-editor';
import { CounterManager } from '@/components/causal/counter-manager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { zustandReplyStore } from '@/store/reply-store';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import { MessageSquareReply, Plus, Search } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { ReplyRule, ReplyFormData, MatchType } from '@/types/reply';
import type { CausalRule } from '@/types/causal';
import { emptyCausalRule } from '@/types/causal';
import { PageHeader } from '@/components/ui/page-header';
import { zustandAdapterStore } from '@/store/adapter-store';
import { platformLabel } from '@/components/platform-icon';
import { resolveReplyScope, replyScopeKey } from '@/lib/reply-scope';

type Tab = 'replies' | 'causal' | 'counters';
type MatchTypeFilter = 'all' | MatchType;
type StatusFilter = 'all' | 'enabled' | 'disabled';

export const RepliesPage: React.FC = () => {
  const { t } = useTranslation();
  const { replies: liveReplies, scope: loadedScope, loading: liveLoading, error: liveError, fetchReplies, createReply, updateReply, deleteReply, toggleReply } = zustandReplyStore();
  const error = useTourValue(liveError, null);
  const dlg = useDialogs(t);
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<ReplyRule | null>(null);
  const [filterText, setFilterText] = useTourState('', '');
  const [matchTypeFilter, setMatchTypeFilter] = useState<MatchTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tab, setTab] = useTourState<Tab>('replies', 'replies');
  const { adapters: liveAdapters, fetchAdapters, error: adaptersError } = zustandAdapterStore();
  const accounts = useTourValue(liveAdapters, tourSamples.adapters);
  const [scopeSelection, setScopeSelection] = useTourState('global', 'global');
  const [pokeEditing, setPokeEditing] = useState(false);
  const scope = useMemo(() => resolveReplyScope(scopeSelection, accounts), [scopeSelection, accounts]);
  const scopeReady = replyScopeKey(scope) === replyScopeKey(loadedScope);
  const replies = useTourValue(scopeReady ? liveReplies : [], tourSamples.replies);
  const loading = useTourValue(liveLoading || !scopeReady, false);
  const selectedAccount = accounts.find((account) => account.id === scope.target);
  const scopeLabel = scope.scope === 'global' ? t('settings.scope_global')
    : scope.scope === 'adapter' ? `${t('settings.scope_adapter')} · ${platformLabel(scope.platform)}`
    : `${t('settings.scope_account')} · ${selectedAccount?.name || scope.target} ${selectedAccount?.loginId || ''}`;

  // Causal rule state
  const [causalRules, setCausalRules] = useState<CausalRule[]>([]);
  const [causalLoading, setCausalLoading] = useState(false);
  const [causalFilter, setCausalFilter] = useState('');
  const [causalEditorOpen, setCausalEditorOpen] = useState(false);
  const [editingCausalRule, setEditingCausalRule] = useState<CausalRule>(emptyCausalRule);

  useEffect(() => { void fetchReplies(scope); }, [fetchReplies, scope]);
  useEffect(() => { void fetchAdapters(); }, [fetchAdapters]);

  const fetchCausalRules = useCallback(async () => {
    setCausalLoading(true);
    try {
      const res = await apiClient.get<CausalRule[]>('/causal/rules');
      setCausalRules(res.data || []);
    } catch {
      toast({ title: t('common.load_fail'), variant: 'destructive' });
    } finally {
      setCausalLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    if (tab === 'causal' && causalRules.length === 0) void fetchCausalRules();
  }, [tab, causalRules.length, fetchCausalRules]);

  const handleCreate = async (data: ReplyFormData) => {
    try {
      const reply = await createReply(data);
      toast({ title: t(reply.deduplicated ? 'replies.duplicate_skipped' : 'replies.added') });
    }
    catch (e) { toast({ title: t('common.create_fail'), variant: 'destructive' }); throw e; }
  };
  const handleUpdate = async (data: ReplyFormData) => {
    if (!editingReply) return;
    try {
      const reply = await updateReply(editingReply.id, data);
      toast({ title: t(reply.deduplicated ? 'replies.duplicates_merged' : 'replies.updated') });
    }
    catch (e) { toast({ title: t('common.update_fail'), variant: 'destructive' }); throw e; }
  };
  const handleDelete = async (id: string) => {
    const rule = replies.find((item) => item.id === id);
    if (!await dlg.confirm({ title: t('common.confirm_delete'), description: rule?.matchContent || rule?.replyContent || id, confirmText: t('common.delete'), destructive: true })) return;
    try { await deleteReply(id); toast({ title: t('replies.deleted') }); }
    catch { toast({ title: t('common.delete_fail'), variant: 'destructive' }); }
  };
  const handleToggle = async (id: string) => {
    try { await toggleReply(id); }
    catch { toast({ title: t('common.operation_fail'), variant: 'destructive' }); }
  };

  // Causal rule handlers
  const handleCausalSave = async (rule: CausalRule) => {
    try {
      if (rule.id > 0) {
        await apiClient.put(`/causal/rules/${rule.id}`, rule);
        toast({ title: t('common.update_success') });
      } else {
        await apiClient.post('/causal/rules', rule);
        toast({ title: t('common.create_success') });
      }
      void fetchCausalRules();
    } catch (e) {
      throw e; // The editor keeps the draft and displays the save error.
    }
  };

  const handleCausalDelete = async (id: number) => {
    if (!await dlg.confirm({ title: t('common.confirm_delete'), description: causalRules.find((rule) => rule.id === id)?.name || String(id), confirmText: t('common.delete'), destructive: true })) return;
    try {
      await apiClient.delete(`/causal/rules/${id}`);
      toast({ title: t('common.delete_success') });
      void fetchCausalRules();
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleCausalToggle = async (id: number) => {
    try {
      await apiClient.post(`/causal/rules/${id}/toggle`);
      void fetchCausalRules();
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {dlg.node}
      <PageHeader icon={MessageSquareReply} title={t('replies.title')} description={t('replies.subtitle')} help={t('page_help.replies')} />

      {tab === 'replies' && <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <label htmlFor="replies-scope" className="text-sm font-medium">{t('settings.scope_title')}</label>
        <Select value={scopeSelection} onValueChange={setScopeSelection} disabled={formOpen || pokeEditing}>
          <SelectTrigger id="replies-scope" className="w-full sm:w-80"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="global">{t('settings.scope_global')}</SelectItem>
            {[...new Set(accounts.map((account) => account.type))].map((platform) => <SelectItem key={platform} value={`adapter:${platform}`}>
              {t('settings.scope_adapter')} · {platformLabel(platform)}
            </SelectItem>)}
            {accounts.map((account) => <SelectItem key={account.id} value={`account:${account.id}`}>
              {t('settings.scope_account')} · {account.name} {account.loginId || ''}
            </SelectItem>)}
          </SelectContent>
        </Select>
        <p className="w-full text-xs text-muted-foreground">{t('replies.page_scope_hint')}</p>
        {adaptersError && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          {t('common.load_fail')}：{adaptersError}
          <Button variant="outline" size="sm" onClick={() => void fetchAdapters()}>{t('ui_refresh.retry')}</Button>
        </div>}
      </div>}

      {/* Tab switcher */}
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="space-y-5">
      <TabsList variant="page" data-tour="replies-tabs" aria-label={t('replies.title')}>
        <TabsTrigger value="replies">{t('replies.tab_replies')}</TabsTrigger>
        <TabsTrigger value="causal">{t('replies.tab_causal')}</TabsTrigger>
        <TabsTrigger value="counters">{t('replies.tab_counters')}</TabsTrigger>
      </TabsList>
      <TabsContent value={tab} className="mt-0 space-y-6">

      {/* Tab content */}
      {tab === 'replies' && (
        <>
          {/* C#72：活动广播横幅（仅有待发广播时显示，单独一行）。 */}
          <BroadcastBar render="banner" />
          {/* C#72：搜索框 + 添加回复 + 新增广播 同一横排。 */}
          <div data-tour="replies-toolbar" className="grid grid-cols-2 items-center gap-2 md:flex md:flex-wrap">
            <div className="relative col-span-2 min-w-0 md:flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t('replies.search_placeholder')} value={filterText} onChange={(e) => setFilterText(e.target.value)} className="pl-9" />
            </div>
            <Select value={matchTypeFilter} onValueChange={(value) => setMatchTypeFilter(value as MatchTypeFilter)}>
              <SelectTrigger className="w-full md:w-[150px]" aria-label={t('replies.filter_match_type')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('replies.filter_type_all')}</SelectItem>
                <SelectItem value="keyword">{t('replies.mt_keyword')}</SelectItem>
                <SelectItem value="prefix">{t('replies.mt_prefix')}</SelectItem>
                <SelectItem value="search">{t('replies.mt_search')}</SelectItem>
                <SelectItem value="regex">{t('replies.mt_regex')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-full md:w-[130px]" aria-label={t('replies.filter_status')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('replies.filter_status_all')}</SelectItem>
                <SelectItem value="enabled">{t('replies.filter_enabled')}</SelectItem>
                <SelectItem value="disabled">{t('replies.filter_disabled')}</SelectItem>
              </SelectContent>
            </Select>
            <Button className="shrink-0" disabled={loading || !!error} onClick={() => { setEditingReply(null); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" />{t('replies.add')}</Button>
            <PokeReplyButton scope={scope} scopeLabel={scopeLabel} onEditingChange={setPokeEditing} />
            <BroadcastBar render="button" />
          </div>
          <div data-tour="replies-list">{error ? (
            <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 p-4">
              <p className="text-sm text-destructive">{t('common.load_fail')}：{error}</p>
              <Button variant="outline" onClick={() => void fetchReplies()}>{t('ui_refresh.retry')}</Button>
            </div>
          ) : loading ? (
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          ) : (
            <ReplyTable replies={replies} onEdit={(r) => { setEditingReply(r); setFormOpen(true); }} onDelete={handleDelete} onToggle={handleToggle} filterText={filterText} matchTypeFilter={matchTypeFilter} statusFilter={statusFilter} />
          )}</div>
          <div data-tour="replies-preview"><ReplyMatchPreview replies={replies} scope={scope} /></div>
          <ReplyForm open={formOpen} onOpenChange={setFormOpen} onSubmit={editingReply ? handleUpdate : handleCreate} reply={editingReply}
            headerSlot={<p className="text-sm font-medium">{scopeLabel}</p>} />
        </>
      )}

      {tab === 'causal' && (
        <>
          <CausalRuleTable
            rules={causalRules}
            loading={causalLoading}
            filterText={causalFilter}
            onFilterChange={setCausalFilter}
            onEdit={(rule) => { setEditingCausalRule(rule); setCausalEditorOpen(true); }}
            onDelete={handleCausalDelete}
            onToggle={handleCausalToggle}
            onCreate={() => { setEditingCausalRule({ ...emptyCausalRule }); setCausalEditorOpen(true); }}
          />
          <CausalRuleEditor
            rule={editingCausalRule}
            open={causalEditorOpen}
            onOpenChange={setCausalEditorOpen}
            onSave={handleCausalSave}
          />
        </>
      )}

      {tab === 'counters' && <CounterManager />}
      </TabsContent>
      </Tabs>
    </div>
  );
};
export default RepliesPage;
