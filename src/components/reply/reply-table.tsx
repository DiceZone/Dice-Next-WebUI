import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
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
import { Pencil, Trash2 } from 'lucide-react';
import type { ReplyRule } from '@/types/reply';

interface ReplyTableProps {
  replies: ReplyRule[];
  onEdit: (reply: ReplyRule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  filterText: string;
}

const columnHelper = createColumnHelper<ReplyRule>();

export const ReplyTable: React.FC<ReplyTableProps> = ({
  replies,
  onEdit,
  onDelete,
  onToggle,
  filterText,
}) => {
  const { t } = useTranslation();
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const filtered = useMemo(() => {
    if (!filterText) return replies;
    const lower = filterText.toLowerCase();
    return replies.filter(
      (r) =>
        r.matchContent.toLowerCase().includes(lower) ||
        r.replyContent.toLowerCase().includes(lower)
    );
  }, [replies, filterText]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('matchType', {
        header: t('replies.match_type'),
        cell: (info) => (
          <Badge variant="secondary" className="text-xs">
            {t('replies.mt_' + info.getValue(), info.getValue())}
          </Badge>
        ),
        size: 100,
      }),
      columnHelper.accessor('matchContent', {
        header: t('replies.match_content'),
        cell: (info) => (
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
            {truncate(info.getValue(), 40)}
          </code>
        ),
      }),
      columnHelper.accessor('replyContent', {
        header: t('replies.reply_content'),
        cell: (info) => (
          <span className="text-sm text-muted-foreground">
            {truncate(info.getValue(), 50)}
          </span>
        ),
      }),
      columnHelper.accessor('priority', {
        header: t('replies.priority'),
        cell: (info) => (
          <span className="text-xs font-mono">{info.getValue()}</span>
        ),
        size: 70,
      }),
      columnHelper.accessor('enabled', {
        header: t('replies.col_status'),
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
    [onEdit, onDelete, onToggle, t]
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
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
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
                  <TableCell key={cell.id}>
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
