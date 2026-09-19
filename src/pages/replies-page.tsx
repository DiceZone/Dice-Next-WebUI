import React, { useEffect, useState, useCallback } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { zustandReplyStore } from '@/store/reply-store';
import { useToast } from '@/hooks/use-toast';
import { MessageSquareReply, Plus, Search } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { ReplyRule, ReplyFormData, MatchType } from '@/types/reply';
import type { CausalRule } from '@/types/causal';
import { emptyCausalRule } from '@/types/causal';

type Tab = 'replies' | 'causal' | 'counters';
type MatchTypeFilter = 'all' | MatchType;
type StatusFilter = 'all' | 'enabled' | 'disabled';

export const RepliesPage: React.FC = () => {
  const { t } = useTranslation();
  const { replies: liveReplies, loading: liveLoading, fetchReplies, createReply, updateReply, deleteReply, toggleReply } = zustandReplyStore();
  const replies = useTourValue(liveReplies, tourSamples.replies);
  const loading = useTourValue(liveLoading, false);
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<ReplyRule | null>(null);
  const [filterText, setFilterText] = useTourState('', '');
  const [matchTypeFilter, setMatchTypeFilter] = useState<MatchTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tab, setTab] = useTourState<Tab>('replies', 'replies');

  // Causal rule state
  const [causalRules, setCausalRules] = useState<CausalRule[]>([]);
  const [causalLoading, setCausalLoading] = useState(false);
  const [causalFilter, setCausalFilter] = useState('');
  const [causalEditorOpen, setCausalEditorOpen] = useState(false);
  const [editingCausalRule, setEditingCausalRule] = useState<CausalRule>(emptyCausalRule);

  useEffect(() => { void fetchReplies(); }, [fetchReplies]);

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
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleCausalDelete = async (id: number) => {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><MessageSquareReply className="h-5 w-5" />{t('replies.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('replies.subtitle')}</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div data-tour="replies-tabs" className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'replies' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('replies')}
        >
          {t('replies.tab_replies')}
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'causal' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('causal')}
        >
          {t('replies.tab_causal')}
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'counters' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('counters')}
        >
          {t('replies.tab_counters')}
        </button>
      </div>

      {/* Tab content */}
      {tab === 'replies' && (
        <>
          {/* C#72：活动广播横幅（仅有待发广播时显示，单独一行）。 */}
          <BroadcastBar render="banner" />
          {/* C#72：搜索框 + 添加回复 + 新增广播 同一横排。 */}
          <div data-tour="replies-toolbar" className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t('replies.search_placeholder')} value={filterText} onChange={(e) => setFilterText(e.target.value)} className="pl-9" />
            </div>
            <Select value={matchTypeFilter} onValueChange={(value) => setMatchTypeFilter(value as MatchTypeFilter)}>
              <SelectTrigger className="w-[150px]" aria-label={t('replies.filter_match_type')}>
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
              <SelectTrigger className="w-[130px]" aria-label={t('replies.filter_status')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('replies.filter_status_all')}</SelectItem>
                <SelectItem value="enabled">{t('replies.filter_enabled')}</SelectItem>
                <SelectItem value="disabled">{t('replies.filter_disabled')}</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="shrink-0" onClick={() => { setEditingReply(null); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" />{t('replies.add')}</Button>
            <PokeReplyButton />
            <BroadcastBar render="button" />
          </div>
          <div data-tour="replies-list">{loading ? (
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          ) : (
            <ReplyTable replies={replies} onEdit={(r) => { setEditingReply(r); setFormOpen(true); }} onDelete={handleDelete} onToggle={handleToggle} filterText={filterText} matchTypeFilter={matchTypeFilter} statusFilter={statusFilter} />
          )}</div>
          <div data-tour="replies-preview"><ReplyMatchPreview replies={replies} /></div>
          <ReplyForm open={formOpen} onOpenChange={setFormOpen} onSubmit={editingReply ? handleUpdate : handleCreate} reply={editingReply} />
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
    </div>
  );
};
export default RepliesPage;
