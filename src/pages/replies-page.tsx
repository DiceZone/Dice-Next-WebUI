import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ReplyTable } from '@/components/reply/reply-table';
import { ReplyForm } from '@/components/reply/reply-form';
import { ReplyMatchPreview } from '@/components/reply/reply-match-preview';
import { BroadcastBar } from '@/components/reply/broadcast-bar';
import { CausalRuleTable } from '@/components/causal/causal-rule-table';
import { CausalRuleEditor } from '@/components/causal/causal-rule-editor';
import { CounterManager } from '@/components/causal/counter-manager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { zustandReplyStore } from '@/store/reply-store';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { ReplyRule, ReplyFormData } from '@/types/reply';
import type { CausalRule } from '@/types/causal';
import { emptyCausalRule } from '@/types/causal';

type Tab = 'replies' | 'causal' | 'counters';

export const RepliesPage: React.FC = () => {
  const { t } = useTranslation();
  const { replies, loading, fetchReplies, createReply, updateReply, deleteReply, toggleReply } = zustandReplyStore();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<ReplyRule | null>(null);
  const [filterText, setFilterText] = useState('');
  const [tab, setTab] = useState<Tab>('replies');

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
    try { await createReply(data); toast({ title: t('replies.added') }); }
    catch { toast({ title: t('common.create_fail'), variant: 'destructive' }); }
  };
  const handleUpdate = async (data: ReplyFormData) => {
    if (!editingReply) return;
    try { await updateReply(editingReply.id, data); toast({ title: t('replies.updated') }); }
    catch { toast({ title: t('common.update_fail'), variant: 'destructive' }); }
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
          <h1 className="text-2xl font-bold tracking-tight">{t('replies.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('replies.subtitle')}</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b">
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
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t('replies.search_placeholder')} value={filterText} onChange={(e) => setFilterText(e.target.value)} className="pl-9" />
            </div>
            <Button size="sm" className="shrink-0" onClick={() => { setEditingReply(null); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" />{t('replies.add')}</Button>
            <BroadcastBar render="button" />
          </div>
          {loading ? (
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          ) : (
            <ReplyTable replies={replies} onEdit={(r) => { setEditingReply(r); setFormOpen(true); }} onDelete={handleDelete} onToggle={handleToggle} filterText={filterText} />
          )}
          <ReplyMatchPreview replies={replies} />
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
