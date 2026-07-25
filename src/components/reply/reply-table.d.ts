import React from 'react';
import type { ReplyRule } from '@/types/reply';
interface ReplyTableProps {
    replies: ReplyRule[];
    onEdit: (reply: ReplyRule) => void;
    onDelete: (id: string) => void;
    onToggle: (id: string) => void;
    filterText: string;
}
export declare const ReplyTable: React.FC<ReplyTableProps>;
export default ReplyTable;
