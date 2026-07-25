/**
 * C#29 + C#66: Causal Rule Editor — 重做为「更贴近真人操作」的向导式编辑器。
 * 设计要点：①模板库一键套用（解决「没实例」）；②自然语言「当…就…」句式行；
 * ③大白话下拉映射到正确后端类型（修掉 keyword=完全等于 的误导）；④每类型专属输入 +
 * 行内范例提示；⑤回复变量膠囊一键插入。后端数据模型不变。
 */
import React from 'react';
import type { CausalRule } from '@/types/causal';
interface Props {
    rule: CausalRule;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (rule: CausalRule) => void;
}
export declare const CausalRuleEditor: React.FC<Props>;
export default CausalRuleEditor;
