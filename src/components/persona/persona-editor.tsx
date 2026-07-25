/**
 * C#28-B: Persona Editor — inline key→value editing for persona entries
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Trash2, Save, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { PersonaTemplate, PersonaEntry } from '@/types/persona';

interface Props {
  persona: PersonaTemplate;
  onClose: () => void;
  onChanged: () => void;
}

export const PersonaEditor: React.FC<Props> = ({ persona, onClose, onChanged }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [entries, setEntries] = useState<PersonaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingValues, setEditingValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<PersonaEntry[]>(`/personas/${persona.id}/entries`);
      setEntries(res.data || []);
      setEditingValues({});
    } catch {
      toast({ title: t('common.load_fail'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [persona.id, toast, t]);

  useEffect(() => { void fetchEntries(); }, [fetchEntries]);

  const handleAdd = async () => {
    if (!newKey.trim()) { toast({ title: t('persona.ed.need_key'), variant: 'destructive' }); return; }
    try {
      await apiClient.put(`/personas/${persona.id}/entries`, {
        locale: 'zh-Hans', key: newKey.trim(), value: newValue,
      });
      toast({ title: t('persona.ed.added') });
      setNewKey(''); setNewValue('');
      void fetchEntries(); onChanged();
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleSave = async (entry: PersonaEntry) => {
    const newValue = editingValues[entry.id];
    if (newValue === undefined) return;
    setSaving(true);
    try {
      await apiClient.put(`/personas/${persona.id}/entries`, {
        locale: entry.locale, key: entry.key, value: newValue,
      });
      toast({ title: t('common.save_success') });
      setEditingValues((prev) => { const n = { ...prev }; delete n[entry.id]; return n; });
      void fetchEntries(); onChanged();
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: PersonaEntry) => {
    try {
      await apiClient.delete(`/personas/${persona.id}/entries`, {
        body: { locale: entry.locale, key: entry.key },
      });
      toast({ title: t('common.delete_success') });
      void fetchEntries(); onChanged();
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  };

  const filtered = entries.filter((e) =>
    !filter || e.key.toLowerCase().includes(filter.toLowerCase()) || e.value.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('persona.ed.title', { name: persona.name })}</DialogTitle>
        </DialogHeader>

        {/* Add new entry */}
        <div className="flex items-end gap-2 py-2 border-b pb-3">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">{t('persona.ed.key_label')}</Label>
            <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="dice.roll.result" className="h-8 text-sm" />
          </div>
          <div className="flex-[2] space-y-1">
            <Label className="text-xs">{t('persona.ed.value_label')}</Label>
            <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder={t('persona.ed.value_ph')} className="h-8 text-sm" />
          </div>
          <Button size="sm" onClick={handleAdd}><Plus className="mr-1 h-4 w-4" />{t('common.add')}</Button>
        </div>

        {/* Search */}
        <div className="relative py-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('persona.ed.search')} className="pl-9 h-8 text-sm" />
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto space-y-1 min-h-[200px]">
          {loading ? (
            <div className="h-32 animate-pulse rounded-lg bg-muted" />
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              {entries.length === 0 ? t('persona.ed.empty') : t('persona.ed.no_match')}
            </div>
          ) : (
            filtered.map((entry) => {
              const isEditing = editingValues[entry.id] !== undefined;
              const currentValue = isEditing ? editingValues[entry.id] : entry.value;
              return (
                <div key={entry.id} className="flex items-start gap-2 rounded-md border p-2">
                  <div className="w-1/3 shrink-0">
                    <code className="text-xs font-mono text-muted-foreground break-all">{entry.key}</code>
                    <span className="text-[10px] text-muted-foreground ml-1">({entry.locale})</span>
                  </div>
                  <div className="flex-1">
                    <Input
                      value={currentValue}
                      onChange={(e) => setEditingValues((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                      className="h-7 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isEditing && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={t('common.save')} onClick={() => handleSave(entry)} disabled={saving}>
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {isEditing && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={t('common.cancel')} onClick={() => setEditingValues((prev) => { const n = { ...prev }; delete n[entry.id]; return n; })}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title={t('common.delete')} onClick={() => handleDelete(entry)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <span className="text-xs text-muted-foreground mr-auto">{t('persona.ed.count', { count: entries.length })}</span>
          <Button variant="outline" onClick={onClose}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PersonaEditor;
