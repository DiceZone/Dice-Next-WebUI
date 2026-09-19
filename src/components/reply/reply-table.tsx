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
      className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          const limits: string[] = [];
          if ((row.prob ?? 100) < 100) limits.push(`${row.prob}%`);
          if ((row.cooldownSec ?? 0) > 0) limits.push(`CD ${row.cooldownSec}s`);
          if ((row.dayLimit ?? 0) > 0) limits.push(t('replies.daylimit_badge', { n: row.dayLimit }));
          if (row.scopeMode === 'allow') limits.push(t('replies.scope_allow_short'));
          if (row.scopeMode === 'deny') limits.push(t('replies.scope_deny_short'));
          if (row.scopeUsersMode === 'allow') limits.push(t('replies.scope_users_allow_short'));
          if (row.scopeUsersMode === 'deny') limits.push(t('replies.scope_users_deny_short'));
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
        size: 70,
      }),
      columnHelper.accessor('enabled', {
        header: ({ column }) => <SortableHeader column={column} label={t('replies.col_status')} hint={t('replies.sort_hint')} />,
        cell: (info) => {
          const row = info.row.original;
          return (
            <Switch
              checked={info.getValue()}
              onCheckedChange={() => onToggle(row.id)}
            />
          );
        },
        size: 60,
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
              onClick={() => onEdit(info.row.original)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => onDelete(info.row.original.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
        size: 80,
      }),
    ],
    [onEdit, onDelete, onToggle, t, textSorting]
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
    <div className="rounded-md border">
      <Table className="rt">
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
  );
};

export default ReplyTable;
