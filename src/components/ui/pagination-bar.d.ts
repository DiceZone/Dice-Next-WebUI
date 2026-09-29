import React from 'react';
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
export declare const PaginationBar: React.FC<PaginationBarProps>;
export default PaginationBar;
