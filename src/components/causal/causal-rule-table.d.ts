/**
 * C#29: Causal Rule Table — list / search / toggle / delete rules
 */
import React from 'react';
import type { CausalRule } from '@/types/causal';
interface Props {
    rules: CausalRule[];
    loading: boolean;
    filterText: string;
    onFilterChange: (text: string) => void;
    onEdit: (rule: CausalRule) => void;
    onDelete: (id: number) => void;
    onToggle: (id: number) => void;
    onCreate: () => void;
}
export declare const CausalRuleTable: React.FC<Props>;
export default CausalRuleTable;
