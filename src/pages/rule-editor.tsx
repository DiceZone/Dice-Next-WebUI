import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, FlaskConical } from 'lucide-react';

// 表单内部表示（便于编辑），与规则包 JSON 双向转换。
// h 仅用于 customCmds（自定义指令的帮助文字，对应 add 值的 {output,help} 对象形式）。
interface KV { k: string; v: string; h?: string; }
interface PackForm {
  name: string; fullName: string; version: string; author: string;
  setKeys: string; diceSides: string; successBuiltin: string;
  alias: KV[];      // k=规范名, v=别名(逗号分隔)
  defaults: KV[];   // k=属性, v=默认值
  computed: KV[];   // k=属性, v=公式
  entries: KV[];    // k=词条, v=解释
  disableCmds: string;   // 逗号分隔
  cmdAlias: KV[];   // k=输入词, v=目标指令
  customCmds: KV[]; // k=指令名, v=输出模板（含 {表达式} DSL）
}

const emptyForm = (): PackForm => ({
  name: '', fullName: '', version: '1.0', author: '', setKeys: '', diceSides: '100', successBuiltin: 'coc7',
  alias: [], defaults: [], computed: [], entries: [], disableCmds: '', cmdAlias: [], customCmds: [],
});

function jsonToForm(j: Record<string, unknown>): PackForm {
  const f = emptyForm();
  f.name = (j.name as string) || ''; f.fullName = (j.fullName as string) || '';
  f.version = (j.version as string) || '1.0'; f.author = (j.author as string) || '';
  const set = (j.set as Record<string, unknown>) || {};
  f.diceSides = String((set.diceSides as number) ?? 100);
  f.setKeys = Array.isArray(set.keys) ? (set.keys as string[]).join(', ') : '';
  const succ = (j.successLevels as Record<string, unknown>) || {};
  f.successBuiltin = (succ.builtin as string) || '';
  const objToKV = (o: unknown, joinArr = false): KV[] =>
    o && typeof o === 'object' ? Object.entries(o as Record<string, unknown>).map(([k, v]) =>
      ({ k, v: joinArr && Array.isArray(v) ? (v as string[]).join(', ') : String(v) })) : [];
  f.alias = objToKV(j.alias, true);
  f.defaults = objToKV(j.defaults);
  f.computed = objToKV(j.computed);
  f.entries = objToKV(j.entries);
  const cmds = (j.commands as Record<string, unknown>) || {};
  f.disableCmds = Array.isArray(cmds.disable) ? (cmds.disable as string[]).join(', ') : '';
  f.cmdAlias = objToKV(cmds.alias);
  // commands.add 值可为字符串(=模板) 或 {output, help} 对象；对象形式保留 help。
  if (cmds.add && typeof cmds.add === 'object')
    f.customCmds = Object.entries(cmds.add as Record<string, unknown>).map(([k, v]) =>
      typeof v === 'string'
        ? { k, v }
        : { k, v: String((v as Record<string, unknown>)?.output ?? ''), h: String((v as Record<string, unknown>)?.help ?? '') });
  return f;
}

function formToJson(f: PackForm): Record<string, unknown> {
  const splitList = (s: string) => s.split(/[,，]/).map((x) => x.trim()).filter(Boolean);
  const kvObj = (rows: KV[], asInt = false) => {
    const o: Record<string, unknown> = {};
    for (const r of rows) if (r.k.trim()) o[r.k.trim()] = asInt ? (parseInt(r.v, 10) || 0) : r.v;
    return o;
  };
  const aliasObj: Record<string, string[]> = {};
  for (const r of f.alias) if (r.k.trim()) aliasObj[r.k.trim()] = splitList(r.v);
  const j: Record<string, unknown> = {
    name: f.name.trim(), fullName: f.fullName.trim() || f.name.trim(), version: f.version.trim(),
    set: { diceSides: parseInt(f.diceSides, 10) || 100, keys: splitList(f.setKeys) },
  };
  if (f.author.trim()) j.author = f.author.trim();
  if (f.successBuiltin) j.successLevels = { builtin: f.successBuiltin };
  if (Object.keys(aliasObj).length) j.alias = aliasObj;
  if (f.defaults.length) j.defaults = kvObj(f.defaults, true);
  if (f.computed.length) j.computed = kvObj(f.computed);
  if (f.entries.length) j.entries = kvObj(f.entries);
  const disable = splitList(f.disableCmds);
  const cmdAlias = kvObj(f.cmdAlias);
  // 自定义指令：有帮助文字→写 {output,help} 对象，否则写纯字符串模板（保持简洁/向后兼容）。
  const customCmds: Record<string, unknown> = {};
  for (const r of f.customCmds)
    if (r.k.trim()) customCmds[r.k.trim()] = r.h && r.h.trim() ? { output: r.v, help: r.h.trim() } : r.v;
  if (disable.length || Object.keys(cmdAlias).length || Object.keys(customCmds).length)
    j.commands = {
      ...(disable.length ? { disable } : {}),
      ...(Object.keys(cmdAlias).length ? { alias: cmdAlias } : {}),
      ...(Object.keys(customCmds).length ? { add: customCmds } : {}),
    };
  return j;
}

interface Props { file: string | null; onClose: () => void; onSaved: () => void; }

export const RuleEditor: React.FC<Props> = ({ file, onClose, onSaved }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const isNew = file === '';
  const [form, setForm] = useState<PackForm>(emptyForm);
  const [raw, setRaw] = useState('');        // 源文件模式内容
  const [mode, setMode] = useState<'form' | 'raw'>('form');
  const [saving, setSaving] = useState(false);
  // 实时测试（C#12 可视化生成器）：对当前未保存的表单内容求值一条指令。
  const [testCmd, setTestCmd] = useState('');
  const [testAttrs, setTestAttrs] = useState('');
  const [testOut, setTestOut] = useState<{ reply: string; matched: boolean; status: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    if (isNew) { setForm(emptyForm()); return; }
    try {
      const r = await fetch(`/api/rules/file?file=${encodeURIComponent(file!)}`); const j = await r.json();
      if (j.code === 0) { setRaw(j.data.content); setForm(jsonToForm(JSON.parse(j.data.content))); }
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
  }, [file, isNew, toast]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    let content: string;
    if (mode === 'raw') {
      try { JSON.parse(raw); } catch { toast({ title: t('ruleed.bad_json'), variant: 'destructive' }); return; }
      content = raw;
    } else {
      if (!form.name.trim()) { toast({ title: t('ruleed.need_name'), variant: 'destructive' }); return; }
      content = JSON.stringify(formToJson(form), null, 2);
    }
    setSaving(true);
    try {
      const fname = isNew ? (form.name.trim() || 'rule') + '.json' : file!;
      if (isNew) await fetch('/api/rules/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: fname, content }) }).then((r) => r.json()).then((j) => { if (j.code !== 0) throw new Error(j.message); });
      else await fetch('/api/rules/save', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: fname, content }) }).then((r) => r.json()).then((j) => { if (j.code !== 0) throw new Error(j.message); });
      toast({ title: t('common.save_success') }); onSaved();
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  // 切到源文件模式时，把当前表单序列化出来给用户看/改。
  const toRaw = () => { setRaw(JSON.stringify(formToJson(form), null, 2)); setMode('raw'); };
  const toForm = () => { try { setForm(jsonToForm(JSON.parse(raw))); setMode('form'); } catch { toast({ title: t('ruleed.bad_json'), variant: 'destructive' }); } };

  // 实时测试：以当前表单(form 模式)或源文件(raw 模式)为规则包，对一条指令求值。
  // 测试属性默认取表单「默认值」，可在测试框里用 "力量=50, 敏捷=60" 覆盖。
  const runTest = async () => {
    setTesting(true); setTestOut(null);
    try {
      const attrs: Record<string, number> = {};
      for (const d of form.defaults) { const n = parseInt(d.v, 10); if (d.k.trim() && !isNaN(n)) attrs[d.k.trim()] = n; }
      for (const part of testAttrs.split(/[,，]/)) {
        const m = part.split(/[=＝:：]/); const n = parseInt((m[1] || '').trim(), 10);
        if (m.length >= 2 && m[0].trim() && !isNaN(n)) attrs[m[0].trim()] = n;
      }
      const content = mode === 'raw' ? raw : JSON.stringify(formToJson(form));
      const r = await fetch('/api/rules/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, command: testCmd, attrs, nick: t('ruleed.test_nick') }),
      });
      const j = await r.json(); if (j.code !== 0) throw new Error(j.message);
      setTestOut(j.data);
    } catch (e) { toast({ title: (e as Error).message, variant: 'destructive' }); }
    finally { setTesting(false); }
  };

  const testPanel = (
    <div className="rounded-md border border-dashed p-3 space-y-2">
      <Label className="text-xs font-medium flex items-center gap-1.5"><FlaskConical className="h-3.5 w-3.5" />{t('ruleed.test_title')}</Label>
      <div className="flex gap-1">
        <Input className="h-8 text-sm flex-1 font-mono" placeholder={t('ruleed.test_cmd_ph')} value={testCmd}
          onChange={(e) => setTestCmd(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && testCmd.trim()) runTest(); }} />
        <Button size="sm" className="h-8 shrink-0" onClick={runTest} disabled={testing || !testCmd.trim()}>{t('ruleed.test_run')}</Button>
      </div>
      <Input className="h-8 text-xs font-mono" placeholder={t('ruleed.test_attrs_ph')} value={testAttrs} onChange={(e) => setTestAttrs(e.target.value)} />
      {testOut && (
        <div className="rounded bg-muted px-2 py-1.5 text-sm">
          {testOut.status === 'render_fail' ? <span className="text-destructive">{t('ruleed.test_render_fail')}</span>
            : testOut.status === 'disabled' ? <span className="text-amber-600">{t('ruleed.test_disabled')}</span>
              : !testOut.matched ? <span className="text-muted-foreground">{t('ruleed.test_nomatch')}</span>
                : <span className="whitespace-pre-wrap break-all font-mono">{testOut.reply}</span>}
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-muted-foreground">{t('ruleed.test_hint')}</p>
    </div>
  );

  // 一个 {k,v} 列表编辑器。
  const kvEditor = (label: string, kLabel: string, vLabel: string, rows: KV[], set: (r: KV[]) => void) => (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-1">
            <Input className="w-32 h-8 text-xs" placeholder={kLabel} value={r.k} onChange={(e) => set(rows.map((x, j) => j === i ? { ...x, k: e.target.value } : x))} />
            <Input className="flex-1 h-8 text-xs" placeholder={vLabel} value={r.v} onChange={(e) => set(rows.map((x, j) => j === i ? { ...x, v: e.target.value } : x))} />
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => set(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" className="h-7" onClick={() => set([...rows, { k: '', v: '' }])}><Plus className="mr-1 h-3 w-3" />{t('common.add')}</Button>
      </div>
    </div>
  );

  // 自定义指令编辑器：指令名 + 输出模板 + 帮助文字（写入 add 的 {output,help} 对象）。
  const customCmdEditor = (rows: KV[], set: (r: KV[]) => void) => (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{t('ruleed.custom')}</Label>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-1 items-start rounded-md border border-input p-1.5">
            <div className="flex-1 space-y-1">
              <div className="flex gap-1">
                <Input className="w-32 h-8 text-xs" placeholder={t('ruleed.cmd_name')} value={r.k} onChange={(e) => set(rows.map((x, j) => j === i ? { ...x, k: e.target.value } : x))} />
                <Input className="flex-1 h-8 text-xs" placeholder={t('ruleed.cmd_tmpl')} value={r.v} onChange={(e) => set(rows.map((x, j) => j === i ? { ...x, v: e.target.value } : x))} />
              </div>
              <Input className="h-8 text-xs" placeholder={t('ruleed.cmd_help')} value={r.h ?? ''} onChange={(e) => set(rows.map((x, j) => j === i ? { ...x, h: e.target.value } : x))} />
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => set(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" className="h-7" onClick={() => set([...rows, { k: '', v: '', h: '' }])}><Plus className="mr-1 h-3 w-3" />{t('common.add')}</Button>
      </div>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{isNew ? t('ruleed.new') : t('ruleed.edit', { file })}</span>
            <Button size="sm" variant="ghost" onClick={mode === 'form' ? toRaw : toForm}>
              {mode === 'form' ? t('ruleed.raw_mode') : t('ruleed.form_mode')}
            </Button>
          </DialogTitle>
        </DialogHeader>

        {mode === 'raw' ? (
          <Textarea className="font-mono text-xs h-[60vh]" value={raw} onChange={(e) => setRaw(e.target.value)} spellCheck={false} />
        ) : (
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">{t('ruleed.name')}</Label><Input className="h-8 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="coc7" /></div>
              <div><Label className="text-xs">{t('ruleed.full_name')}</Label><Input className="h-8 text-sm" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
              <div><Label className="text-xs">{t('ruleed.version')}</Label><Input className="h-8 text-sm" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></div>
              <div><Label className="text-xs">{t('ruleed.author')}</Label><Input className="h-8 text-sm" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
              <div><Label className="text-xs">{t('ruleed.dice_sides')}</Label><Input className="h-8 text-sm" value={form.diceSides} onChange={(e) => setForm({ ...form, diceSides: e.target.value })} /></div>
              <div><Label className="text-xs">{t('ruleed.set_keys')}</Label><Input className="h-8 text-sm" value={form.setKeys} onChange={(e) => setForm({ ...form, setKeys: e.target.value })} placeholder="coc7, coc" /></div>
              <div><Label className="text-xs">{t('ruleed.success')}</Label>
                <Select value={form.successBuiltin || '__none__'} onValueChange={(v) => setForm({ ...form, successBuiltin: v === '__none__' ? '' : v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coc7">COC7 ({t('ruleed.success_builtin')})</SelectItem>
                    <SelectItem value="__none__">{t('ruleed.success_none')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {kvEditor(t('ruleed.alias'), t('ruleed.canon'), t('ruleed.alias_list'), form.alias, (r) => setForm({ ...form, alias: r }))}
            {kvEditor(t('ruleed.computed'), t('ruleed.attr'), t('ruleed.formula'), form.computed, (r) => setForm({ ...form, computed: r }))}
            {kvEditor(t('ruleed.defaults'), t('ruleed.attr'), t('ruleed.value'), form.defaults, (r) => setForm({ ...form, defaults: r }))}
            {kvEditor(t('ruleed.entries'), t('ruleed.term'), t('ruleed.explain'), form.entries, (r) => setForm({ ...form, entries: r }))}
            {kvEditor(t('ruleed.cmd_alias'), t('ruleed.cmd_in'), t('ruleed.cmd_target'), form.cmdAlias, (r) => setForm({ ...form, cmdAlias: r }))}
            {customCmdEditor(form.customCmds, (r) => setForm({ ...form, customCmds: r }))}
            <p className="text-[11px] leading-relaxed text-muted-foreground -mt-2">{t('ruleed.custom_hint')}</p>
            <div><Label className="text-xs">{t('ruleed.disable')}</Label><Input className="h-8 text-sm" value={form.disableCmds} onChange={(e) => setForm({ ...form, disableCmds: e.target.value })} placeholder="jrrp, gugu" /></div>
          </div>
        )}

        {testPanel}

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={save} disabled={saving}>{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
