import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdapterCard } from '@/components/adapter/adapter-card';
import { AdapterForm } from '@/components/adapter/adapter-form';
import { ReverseWsInfo } from '@/components/adapter/reverse-ws-info';
import { Button } from '@/components/ui/button';
import { zustandAdapterStore } from '@/store/adapter-store';
import { useToast } from '@/hooks/use-toast';
import { Plus, PlugZap } from 'lucide-react';
import type { Adapter, AdapterFormData } from '@/types/adapter';

export const AdaptersPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    adapters, loading, error, fetchAdapters,
    createAdapter, updateAdapter, deleteAdapter, toggleAdapter, reconnectAdapter, testConnection,
  } = zustandAdapterStore();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingAdapter, setEditingAdapter] = useState<Adapter | null>(null);
  const [reverseWsPort, setReverseWsPort] = useState<string | null>(null);

  // Initial load + live polling so connect/disconnect shows up without a manual
  // refresh (an enabled-but-not-yet-connected adapter renders as 黄色「连接中…」).
  useEffect(() => {
    void fetchAdapters();
    const id = setInterval(() => { void fetchAdapters(); }, 4000);
    return () => clearInterval(id);
  }, [fetchAdapters]);

  const handleCreate = async (data: AdapterFormData) => {
    try { await createAdapter(data); toast({ title: t('adapters.added') }); }
    catch { toast({ title: t('adapters.add_fail'), variant: 'destructive' }); }
  };
  const handleUpdate = async (data: AdapterFormData) => {
    if (!editingAdapter) return;
    try { await updateAdapter(editingAdapter.id, data); toast({ title: t('adapters.updated') }); }
    catch { toast({ title: t('common.update_fail'), variant: 'destructive' }); }
  };
  const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
  const handleDelete = async (id: string) => {
    try { await deleteAdapter(id); toast({ title: t('adapters.deleted') }); }
    catch (error) { toast({ title: t('common.delete_fail'), description: errorText(error), variant: 'destructive' }); }
  };
  const handleToggle = async (id: string) => {
    try {
      const a = adapters.find((x) => x.id === id);
      await toggleAdapter(id);
      toast({ title: a?.enabled ? t('adapters.disabled_toast') : t('adapters.enabled_toast') });
    } catch (error) { toast({ title: t('common.operation_fail'), description: errorText(error), variant: 'destructive' }); }
  };
  const handleReconnect = async (id: string) => {
    try { await reconnectAdapter(id); toast({ title: t('adapters.reconnecting') }); }
    catch { toast({ title: t('common.operation_fail'), variant: 'destructive' }); }
  };
  const handleTest = async (id: string) => {
    const r = await testConnection(id);
    toast({ title: r.success ? t('common.test_success') : t('common.test_fail'), description: r.success ? undefined : r.message, variant: r.success ? undefined : 'destructive' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><PlugZap className="h-5 w-5" />{t('adapters.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('adapters.subtitle')}</p>
        </div>
        <Button data-tour="adapters-add" size="sm" onClick={() => { setEditingAdapter(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />{t('adapters.add')}
        </Button>
      </div>
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      <div data-tour="adapters-list">
      {loading && adapters.length === 0 ? (
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(400px,100%),1fr))]">
          {[...Array(4)].map((_, i) => (<div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />))}
        </div>
      ) : adapters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-muted p-4"><Plus className="h-8 w-8 text-muted-foreground" /></div>
          <h3 className="text-lg font-semibold mb-1">{t('adapters.no_adapters')}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t('adapters.no_adapters_hint')}</p>
          <Button onClick={() => { setEditingAdapter(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />{t('adapters.add')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(400px,100%),1fr))]">
          {adapters.map((a) => (
            <AdapterCard key={a.id} adapter={a} onConnect={handleToggle} onDisconnect={handleToggle} onReconnect={handleReconnect}
              onEdit={(a) => { setEditingAdapter(a); setFormOpen(true); }} onDelete={handleDelete} onTestConnection={handleTest}
              onShowReverseInfo={a.connectionMode === 'reverse_ws' ? (port) => setReverseWsPort(port) : undefined} />
          ))}
        </div>
      )}
      </div>
      <AdapterForm open={formOpen} onOpenChange={setFormOpen}
        onSubmit={editingAdapter ? handleUpdate : handleCreate} adapter={editingAdapter} />
      <ReverseWsInfo open={!!reverseWsPort} onClose={() => setReverseWsPort(null)} port={reverseWsPort ?? ''} />
    </div>
  );
};
export default AdaptersPage;
