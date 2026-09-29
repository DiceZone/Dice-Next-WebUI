import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZES = [5, 7, 10, 15, 20, 50];

interface PaginationBarProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (s: number) => void;
  label?: string;
  /** Hide the page-size selector (fixed page size). */
  fixedSize?: boolean;
  /** Fixed two-row layout for narrow split-pane lists. */
  compact?: boolean;
  disabled?: boolean;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({ total, page, pageSize, onPageChange, onPageSizeChange, label, fixedSize, compact = false, disabled = false }) => {
  const { t } = useTranslation();
  const [jump, setJump] = useState('');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1 && total <= pageSize) return null;

  const goJump = () => {
    if (disabled || !jump) return;
    const n = parseInt(jump, 10);
    if (!isNaN(n)) onPageChange(Math.min(totalPages, Math.max(1, n)));
    setJump('');
  };

  // A bounded list avoids allocating one item for every page. Narrow panes
  // show first/current/last; arrows still step through every adjacent page.
  const pageNumbers = [...new Set([1, ...(compact ? [page] : [page - 1, page, page + 1]), totalPages])]
    .filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const summary = (
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <span>{label ?? t('pagination.total', { n: total })}</span>
        {!fixedSize && onPageSizeChange && (
          <Select disabled={disabled} value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{t('pagination.per_page', { n: s })}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
  );
  const pageControls = (
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto" data-pagination-pages>
        <Button aria-label={t('ui_refresh.previous')} variant="outline" size="icon" className="h-8 w-8 shrink-0" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        {pageNumbers.map((n, i, arr) => (
          <React.Fragment key={n}>
            {i > 0 && arr[i - 1] !== n - 1 && <span key={'e' + n} className="text-xs text-muted-foreground px-1">…</span>}
            <Button aria-current={page === n ? 'page' : undefined} disabled={disabled} key={n} variant={page === n ? 'default' : 'outline'} size="icon" className="h-8 min-w-8 w-auto shrink-0 px-2 text-xs tabular-nums" onClick={() => onPageChange(n)}>{n}</Button>
          </React.Fragment>
        ))}
        <Button aria-label={t('ui_refresh.next')} variant="outline" size="icon" className="h-8 w-8 shrink-0" disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
  );
  const jumpInput = (
        <input
          aria-label={t('pagination.jump')}
          disabled={disabled}
          value={jump}
          onChange={(e) => setJump(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') goJump(); }}
          onBlur={() => { if (jump) goJump(); }}
          placeholder={`${page}/${totalPages}`}
          title={t('pagination.jump')}
          inputMode="numeric"
          className="h-8 w-16 shrink-0 rounded-md border border-input bg-background px-2 text-center text-xs outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
        />
  );
  return compact ? (
    <div data-pagination-layout="compact" className="grid min-w-0 gap-2 pt-2">
      {pageControls}
      <div className="flex min-w-0 items-center justify-between gap-2">{summary}{jumpInput}</div>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
      {summary}
      <div className="flex min-w-0 items-center gap-2">{pageControls}{jumpInput}</div>
    </div>
  );
};

export default PaginationBar;
