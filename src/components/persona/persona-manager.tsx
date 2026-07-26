/**
 * C#28-B: Persona Manager — list / create / copy / edit / delete / activate
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useDialogs } from '@/hooks/use-dialogs';
import { Sparkles, Plus, Copy, Trash2, Edit3, Check, FileDown, Upload, Users } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { PersonaTemplate, PersonaExport } from '@/types/persona';
import { PersonaEditor } from './persona-editor';

export const PersonaManagerCard: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const dlg = useDialogs(t);
  const [personas, setPersonas] = useState<PersonaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingPersona, setEditingPersona] = useState<PersonaTemplate | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');

  const fetchPersonas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<PersonaTemplate[]>('/personas');
      setPersonas(res.data || []);
      const activeRes = await apiClient.get<{ activeId: number }>('/personas/active');
      setActiveId(activeRes.data.activeId || 0);
    } catch {
      toast({ title: t('common.load_fail'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { void fetchPersonas(); }, [fetchPersonas]);

  const handleCreate = async () => {
    if (!newName.trim()) { toast({ title: t('persona.need_name'), variant: 'destructive' }); return; }
    try {
      await apiClient.post('/personas', { name: newName.trim(), description: newDesc.trim() });
      toast({ title: t('common.create_success') });
      setCreateOpen(false); setNewName(''); setNewDesc('');
      void fetchPersonas(); onChanged?.();
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleActivate = async (p: PersonaTemplate) => {
    try {
      await apiClient.post(`/personas/${p.id}/activate`, { groupId: '' });
      setActiveId(p.id);
      toast({ title: t('persona.activated', { name: p.name }) });
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleCopy = async (p: PersonaTemplate) => {
    const name = await dlg.prompt({
      title: t('persona.copy_title'),
      description: t('persona.copy_desc', { name: p.name }),
      defaultValue: t('persona.copy_default', { name: p.name }),
    });
    if (!name) return;    try {
      await apiClient.post(`/personas/${p.id}/copy`, { newName: name });
      toast({ title: t('persona.copied', { name }) });
      void fetchPersonas(); onChanged?.();
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleDelete = async (p: PersonaTemplate) => {
    if (p.isBuiltin) { toast({ title: t('persona.builtin_no_del'), variant: 'destructive' }); return; }
    if (!(await dlg.confirm({ title: t('common.confirm_delete'), description: t('persona.del_confirm', { name: p.name }), destructive: true, confirmText: t('common.delete') }))) return;
    try {
      await apiClient.delete(`/personas/${p.id}`);
      toast({ title: t('common.delete_success') });
      void fetchPersonas(); onChanged?.();
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleExport = async (p: PersonaTemplate) => {
    try {
      const res = await apiClient.get<PersonaExport>(`/personas/${p.id}/export`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `persona-${p.name}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleImport = async () => {
    try {
      const data = JSON.parse(importText);
      await apiClient.post('/personas/import', data);
      toast({ title: t('persona.imported') });
      setImportOpen(false); setImportText('');
      void fetchPersonas(); onChanged?.();
    } catch (e) {
      toast({ title: t('persona.import_fail', { msg: (e as Error).message }), variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          {t('persona.title')}
        </CardTitle>
        <CardDescription>
          {t('persona.desc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />{t('persona.new')}</Button>
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="mr-2 h-4 w-4" />{t('persona.import')}</Button>
          <Button size="sm" variant="outline" onClick={fetchPersonas}>{t('common.refresh')}</Button>
        </div>

        {loading ? (
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        ) : personas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Users className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">{t('persona.empty')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {personas.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    {p.isBuiltin && <Badge variant="secondary" className="text-xs">{t('persona.builtin')}</Badge>}
                    {activeId === p.id && <Badge variant="success" className="text-xs">{t('persona.current_badge')}</Badge>}
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>}
                  <p className="text-xs text-muted-foreground">{t('persona.entry_count', { count: p.entryCount })}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {activeId !== p.id && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" title={t('persona.activate')} onClick={() => handleActivate(p)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" title={t('persona.edit_entries')} onClick={() => setEditingPersona(p)}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title={t('persona.copy')} onClick={() => handleCopy(p)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title={t('persona.export')} onClick={() => handleExport(p)}>
                    <FileDown className="h-4 w-4" />
                  </Button>
                  {!p.isBuiltin && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title={t('common.delete')} onClick={() => handleDelete(p)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeId > 0 && (
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              await apiClient.post(`/personas/0/activate`, { groupId: '' });
              setActiveId(0);
              toast({ title: t('persona.switched_default') });
            } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
          }}>{t('persona.switch_default')}</Button>
        )}
      </CardContent>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('persona.new')}</DialogTitle>
            <DialogDescription>{t('persona.new_desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>{t('persona.name')}</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('persona.name_ph')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('persona.desc_label')}</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('persona.desc_ph')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreate}>{t('persona.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('persona.import_title')}</DialogTitle>
            <DialogDescription>{t('persona.import_desc')}</DialogDescription>
          </DialogHeader>
          <textarea
            className="w-full min-h-[200px] rounded-md border bg-muted/20 p-3 font-mono text-xs"
            placeholder='{"name":"...","entries":[...]}'
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            spellCheck={false}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleImport} disabled={!importText.trim()}>{t('persona.import')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor dialog */}
      {editingPersona && (
        <PersonaEditor
          persona={editingPersona}
          onClose={() => setEditingPersona(null)}
          onChanged={fetchPersonas}
        />
      )}

      {dlg.node}
    </Card>
  );
};

export default PersonaManagerCard;
