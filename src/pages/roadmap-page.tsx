import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Loader2, CheckCircle2, Circle, Map, ChevronDown, ChevronRight } from 'lucide-react';

interface Item { done: boolean; text: string; }
interface Section { title: string; items: Item[]; subLabels: Record<number, string>; }
interface MarkdownTable { title: string; headers: string[]; rows: string[][]; }
interface RoadmapData { sections: Section[]; tables: MarkdownTable[]; done: number; total: number; }

// Strip inline markdown to plain text: **bold**, `code`, [text](url), trailing notes.
function clean(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // links → text
    .replace(/\*\*([^*]+)\*\*/g, '$1')          // bold
    .replace(/`([^`]+)`/g, '$1')                // code
    .trim();
}

function tableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed.slice(1, -1).split('|').map((cell) => clean(cell.trim()));
}

function isTableDivider(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseRoadmap(md: string): RoadmapData {
  const lines = md.split('\n');
  const sections: Section[] = [];
  const tables: MarkdownTable[] = [];
  let cur: Section | null = null;
  let currentTitle = '';
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];
    const line = raw.trimEnd();
    if (line.startsWith('## ')) {
      currentTitle = clean(line.slice(3).replace(/^[✅⬜]\s*/, ''));
      cur = { title: currentTitle, items: [], subLabels: {} };
      sections.push(cur);
      continue;
    }
    if (!cur) continue;
    const headers = tableRow(line);
    const divider = index + 1 < lines.length ? tableRow(lines[index + 1]) : null;
    if (headers && divider && headers.length === divider.length && isTableDivider(divider)) {
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length) {
        const row = tableRow(lines[index]);
        if (!row || row.length !== headers.length) break;
        rows.push(row);
        index++;
      }
      index--;
      tables.push({ title: currentTitle, headers, rows });
      continue;
    }
    if (line.startsWith('### ')) {
      cur.subLabels[cur.items.length] = clean(line.slice(4));
      continue;
    }
    // bold-only line = sub-group label (e.g. **第一梯队（核心 TRPG 体验）**)
    const subM = line.match(/^\*\*(.+)\*\*$/);
    if (subM) { cur.subLabels[cur.items.length] = clean(subM[1]); continue; }
    // checklist / bullet
    const m = line.match(/^- (\[[ xX]\] )?(.+)$/);
    if (m) {
      const mark = m[1] || '';
      const done = mark === '' ? true : /\[[xX]\]/.test(mark); // plain bullet (under 已完成) = done
      cur.items.push({ done, text: clean(m[2]) });
    }
  }
  const all = sections.flatMap((s) => s.items);
  const trackedRows = tables
    .filter((table) => table.title.includes('已完成功能摘要') || table.title.includes('进行中与计划中'))
    .flatMap((table) => table.rows);
  return {
    sections: sections.filter((s) => s.items.length),
    tables,
    done: trackedRows.length ? trackedRows.filter((row) => row[0]?.includes('✅')).length : all.filter((i) => i.done).length,
    total: trackedRows.length || all.length,
  };
}

export const RoadmapPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/roadmap');
      const j = await r.json();
      if (j.code !== 0) throw new Error(j.message);
      setData(parseRoadmap(j.data.content || ''));
    } catch { toast({ title: t('common.load_fail'), variant: 'destructive' }); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { void load(); }, [load]);

  const pct = data && data.total ? Math.round((data.done / data.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Map className="h-5 w-5" />{t('roadmap.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('roadmap.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{t('common.refresh')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : !data ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Map className="h-12 w-12 mb-3" /><p>{t('common.load_fail')}</p>
        </div>
      ) : (
        <>
          {/* overall progress */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{t('roadmap.overall')}</span>
              <span className="text-sm text-muted-foreground">{data.done} / {data.total} · {pct}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-green-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {data.tables.map((table, ti) => {
            const isCompleted = table.title.includes('已完成功能摘要');
            const open = !isCompleted || completedOpen;
            return (
              <div key={`${table.title}-${ti}`} className="rounded-lg border">
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-base font-semibold">{table.title}</h2>
                    <span className="text-xs text-muted-foreground">{table.rows.length}</span>
                  </div>
                  {isCompleted && (
                    <Button variant="ghost" size="sm" onClick={() => setCompletedOpen((open) => !open)} aria-expanded={completedOpen}>
                      {completedOpen ? t('roadmap.hide_completed') : t('roadmap.show_completed')}
                      {completedOpen ? <ChevronDown className="ml-1 h-4 w-4" /> : <ChevronRight className="ml-1 h-4 w-4" />}
                    </Button>
                  )}
                </div>
                {open && (
                  <div className="overflow-x-auto border-t">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-muted/50 text-left text-muted-foreground">
                        <tr>{table.headers.map((header, hi) => <th key={hi} className="px-3 py-2 font-medium">{header}</th>)}</tr>
                      </thead>
                      <tbody>
                        {table.rows.map((row, ri) => (
                          <tr key={ri} className="border-t align-top hover:bg-muted/30">
                            {row.map((cell, ci) => <td key={ci} className="px-3 py-2 leading-5">{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {data.sections.map((sec, si) => {
            const sdone = sec.items.filter((i) => i.done).length;
            return (
              <div key={si} className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-base font-semibold">{sec.title}</h2>
                  <span className="text-xs text-muted-foreground">{sdone}/{sec.items.length}</span>
                </div>
                <div className="space-y-1">
                  {sec.items.map((it, ii) => (
                    <React.Fragment key={ii}>
                      {sec.subLabels[ii] && (
                        <p className="text-xs font-medium text-muted-foreground pt-2 pl-1">{sec.subLabels[ii]}</p>
                      )}
                      <div className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-muted/40">
                        {it.done
                          ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          : <Circle className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />}
                        <span className={`text-sm ${it.done ? 'text-muted-foreground' : 'text-foreground'}`}>{it.text}</span>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default RoadmapPage;
