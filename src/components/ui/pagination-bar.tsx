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
}

export const PaginationBar: React.FC<PaginationBarProps> = ({ total, page, pageSize, onPageChange, onPageSizeChange, label, fixedSize }) => {
  const { t } = useTranslation();
  const [jump, setJump] = useState('');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1 && total <= pageSize) return null;

  const goJump = () => {
    const n = parseInt(jump, 10);
    if (!isNaN(n)) onPageChange(Math.min(totalPages, Math.max(1, n)));
    setJump('');
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{label ?? t('pagination.total', { n: total })}</span>
        {!fixedSize && onPageSizeChange && (
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{t('pagination.per_page', { n: s })}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1).map((n, i, arr) => (
          <React.Fragment key={n}>
            {i > 0 && arr[i - 1] !== n - 1 && <span key={'e' + n} className="text-xs text-muted-foreground px-1">…</span>}
            <Button key={n} variant={page === n ? 'default' : 'outline'} size="icon" className="h-8 w-8 text-xs" onClick={() => onPageChange(n)}>{n}</Button>
          </React.Fragment>
        ))}
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        {/* 输入页码跳转（Enter 或失焦生效） */}
        <input
          value={jump}
          onChange={(e) => setJump(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') goJump(); }}
          onBlur={() => { if (jump) goJump(); }}
          placeholder={`${page}/${totalPages}`}
          title={t('pagination.jump')}
          inputMode="numeric"
          className="h-8 w-16 rounded-md border border-input bg-background px-2 text-center text-xs outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>
    </div>
  );
};

export default PaginationBar;
