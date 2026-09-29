import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type Column,
  type SortingState,
  type SortingFn,
} from '@tanstack/react-table';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { truncate } from '@/lib/utils';
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash2 } from 'lucide-react';
import type { MatchType, ReplyRule } from '@/types/reply';

interface ReplyTableProps {
  replies: ReplyRule[];
  onEdit: (reply: ReplyRule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  filterText: string;
  matchTypeFilter: 'all' | MatchType;
  statusFilter: 'all' | 'enabled' | 'disabled';
}

const columnHelper = createColumnHelper<ReplyRule>();

const SortableHeader = <T,>({
  column,
  label,
  hint,
}: {
  column: Column<ReplyRule, T>;
  label: string;
  hint: string;
}) => {
  const direction = column.getIsSorted();
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => column.toggleSorting(direction === 'asc')}
      title={hint}
    >
      {label}<Icon className={cn('h-3.5 w-3.5', !direction && 'text-muted-foreground/60')} />
    </button>
  );
};

export const ReplyTable: React.FC<ReplyTableProps> = ({
  replies,
  onEdit,
  onDelete,
  onToggle,
  filterText,
  matchTypeFilter,
  statusFilter,
}) => {
  const { t } = useTranslation();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const collator = useMemo(() => new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }), []);
  const textSorting = React.useCallback<SortingFn<ReplyRule>>(
    (rowA, rowB, columnId) => collator.compare(String(rowA.getValue(columnId) ?? ''), String(rowB.getValue(columnId) ?? '')),
    [collator],
  );

  const filtered = useMemo(() => {
    const lower = filterText.trim().toLowerCase();
    // 搜索覆盖全部条件与全部回复（以前只搜第一条，多条件规则的其余条件搜不到）。
    return replies.filter((r) => {
      if (matchTypeFilter !== 'all') {
        const conditions = r.conditions?.length ? r.conditions : [{ type: r.matchType, content: r.matchContent }];
        if (!conditions.some((condition) => condition.type === matchTypeFilter)) return false;
      }
      if (statusFilter === 'enabled' && !r.enabled) return false;
      if (statusFilter === 'disabled' && r.enabled) return false;
      if (!lower) return true;
      const hay = [
        r.matchContent, r.replyContent,
        ...(r.conditions?.map((c) => c.content) ?? []),
        ...(r.results ?? []),
      ].join('\n').toLowerCase();
      return hay.includes(lower);
    });
  }, [replies, filterText, matchTypeFilter, statusFilter]);

  const ruleLimits = React.useCallback((row: ReplyRule) => {
    const limits: string[] = [];
    if ((row.prob ?? 100) < 100) limits.push(`${row.prob}%`);
    if ((row.cooldownSec ?? 0) > 0) limits.push(`CD ${row.cooldownSec}s`);
    if ((row.dayLimit ?? 0) > 0) limits.push(t('replies.daylimit_badge', { n: row.dayLimit }));
    if (row.scopeMode === 'allow') limits.push(t('replies.scope_allow_short'));
    if (row.scopeMode === 'deny') limits.push(t('replies.scope_deny_short'));
    if (row.scopeUsersMode === 'allow') limits.push(t('replies.scope_users_allow_short'));
    if (row.scopeUsersMode === 'deny') limits.push(t('replies.scope_users_deny_short'));
    return limits;
  }, [t]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('matchType', {
        header: ({ column }) => <SortableHeader column={column} label={t('replies.match_type')} hint={t('replies.sort_hint')} />,
        sortingFn: textSorting,
        cell: (info) => {
          const row = info.row.original;
          const extraConds = (row.conditions?.length ?? 1) - 1;
          return (
            <div className="flex items-center gap-1 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {t('replies.mt_' + info.getValue(), info.getValue())}
              </Badge>
              {extraConds > 0 && (
                <Badge variant="outline" className="text-[10px]" title={t('replies.more_conds_hint')}>
                  +{extraConds}
                </Badge>
              )}
            </div>
          );
        },
        size: 110,
      }),
      columnHelper.accessor('matchContent', {
        header: ({ column }) => <SortableHeader column={column} label={t('replies.match_content')} hint={t('replies.sort_hint')} />,
        sortingFn: textSorting,
        cell: (info) => {
          const row = info.row.original;
          const limits = ruleLimits(row);
          return (
            <div>
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                {truncate(info.getValue(), 40)}
              </code>
              {limits.length > 0 && (
                <span className="block text-[10px] text-muted-foreground mt-0.5">{limits.join(' · ')}</span>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('replyContent', {
        header: ({ column }) => <SortableHeader column={column} label={t('replies.reply_content')} hint={t('replies.sort_hint')} />,
        sortingFn: textSorting,
        cell: (info) => {
          const row = info.row.original;
          const extraResults = (row.results?.length ?? 1) - 1;
          return (
            <span className="text-sm text-muted-foreground">
              {truncate(info.getValue(), 50)}
              {extraResults > 0 && (
                <Badge variant="outline" className="ml-1 text-[10px]" title={t('replies.more_results_hint')}>
                  ×{extraResults + 1}
                </Badge>
              )}
            </span>
          );
        },
      }),
      columnHelper.accessor('priority', {
        header: ({ column }) => <SortableHeader column={column} label={t('replies.priority')} hint={t('replies.sort_hint')} />,
        cell: (info) => (
          <span className="text-xs font-mono">{info.getValue()}</span>
        ),
        size: 90,
      }),
      columnHelper.accessor('enabled', {
        header: ({ column }) => <SortableHeader column={column} label={t('replies.col_status')} hint={t('replies.sort_hint')} />,
        cell: (info) => {
          const row = info.row.original;
          return (
            <Switch
              checked={info.getValue()}
              aria-label={`${t('replies.col_status')} · ${row.matchContent}`}
              onCheckedChange={() => onToggle(row.id)}
            />
          );
        },
        size: 84,
      }),
      columnHelper.display({
        id: 'actions',
        header: t('replies.col_actions'),
        cell: (info) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`${t('common.edit')} · ${info.row.original.matchContent}`}
              onClick={() => onEdit(info.row.original)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              aria-label={`${t('common.delete')} · ${info.row.original.matchContent}`}
              onClick={() => onDelete(info.row.original.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
        size: 80,
      }),
    ],
    [onEdit, onDelete, onToggle, t, textSorting, ruleLimits]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
    <div className="space-y-3 sm:hidden">
      <div className="flex items-center gap-2">
        <Select value={sorting[0]?.id || 'default'} onValueChange={(id) => setSorting(id === 'default' ? [] : [{ id, desc: sorting[0]?.desc ?? false }])}>
          <SelectTrigger className="min-w-0 flex-1" aria-label={t('ui_audit.sort_by')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{t('ui_audit.sort_default')}</SelectItem>
            {([['matchType', 'match_type'], ['matchContent', 'match_content'], ['replyContent', 'reply_content'], ['priority', 'priority'], ['enabled', 'col_status']] as const).map(([id, label]) => <SelectItem key={id} value={id}>{t('replies.' + label)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" disabled={!sorting.length} onClick={() => setSorting(([first]) => first ? [{ ...first, desc: !first.desc }] : [])}>
          {sorting[0]?.desc ? <ArrowDown className="mr-1.5 h-4 w-4" /> : <ArrowUp className="mr-1.5 h-4 w-4" />}{t(sorting[0]?.desc ? 'ui_audit.descending' : 'ui_audit.ascending')}
        </Button>
      </div>
      {table.getRowModel().rows.length === 0 ? (
        <div className="rounded-lg border px-4 py-10 text-center text-sm text-muted-foreground">{filterText ? t('replies.no_match') : t('replies.empty')}</div>
      ) : table.getRowModel().rows.map(({ original: row }) => {
        const conditions = row.conditions?.length ? row.conditions : [{ type: row.matchType, content: row.matchContent }];
        const results = row.results?.length ? row.results : [row.replyContent];
        const limits = ruleLimits(row);
        return <article key={row.id} className={cn('overflow-hidden rounded-xl border bg-card shadow-sm', !row.enabled && 'opacity-70')}>
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5"><Badge variant="secondary" className="text-[11px]">{t('replies.mt_' + conditions[0].type, conditions[0].type)}</Badge>{conditions.length > 1 && <Badge variant="outline" className="text-[11px]">+{conditions.length - 1} {t('replies.match_type')}</Badge>}</div>
              <h3 className="mt-2 whitespace-pre-wrap break-words font-mono text-sm font-semibold leading-5">{conditions[0].content}</h3>
            </div>
            <Switch checked={row.enabled} aria-label={`${t('replies.col_status')} · ${row.matchContent}`} onCheckedChange={() => onToggle(row.id)} />
          </div>
          <div className="space-y-3 px-4 py-3">
            {conditions.length > 1 && <p className="line-clamp-2 break-words text-xs text-muted-foreground">{conditions.slice(1).map((condition) => `${t('replies.mt_' + condition.type, condition.type)}: ${condition.content}`).join(' · ')}</p>}
            <div><p className="text-[11px] font-medium text-muted-foreground">{t('replies.reply_content')}</p><p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-5">{results[0]}</p>{results.length > 1 && <span className="mt-1 inline-block text-[11px] text-muted-foreground">+{results.length - 1} {t('replies.result_label')}</span>}</div>
            {limits.length > 0 && <div className="flex flex-wrap gap-1.5">{limits.map((limit) => <Badge key={limit} variant="outline" className="text-[11px] font-normal">{limit}</Badge>)}</div>}
          </div>
          <div className="flex items-center gap-2 border-t bg-muted/20 px-4 py-2">
            <span className="mr-auto text-xs text-muted-foreground">{t('replies.priority')} {row.priority}</span>
            <Button variant="ghost" size="sm" aria-label={`${t('common.edit')} · ${row.matchContent}`} onClick={() => onEdit(row)}><Pencil className="mr-1.5 h-3.5 w-3.5" />{t('common.edit')}</Button>
            <Button variant="ghost" size="sm" className="text-destructive" aria-label={`${t('common.delete')} · ${row.matchContent}`} onClick={() => onDelete(row.id)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />{t('common.delete')}</Button>
          </div>
        </article>;
      })}
    </div>
    <div className="hidden overflow-x-auto rounded-md border sm:block">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  aria-sort={header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : undefined}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                {filterText ? t('replies.no_match') : t('replies.empty')}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.original.enabled ? undefined : 'disabled'}
                className={cn(!row.original.enabled && 'opacity-50')}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} data-label={typeof cell.column.columnDef.header === 'string' ? cell.column.columnDef.header : undefined}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
    </>
  );
};

export default ReplyTable;
