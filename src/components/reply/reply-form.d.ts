import React from 'react';
import type { ReplyRule, ReplyFormData } from '@/types/reply';
interface ReplyFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: ReplyFormData) => Promise<void>;
    reply?: ReplyRule | null;
    eventTrigger?: 'poke';
    headerSlot?: React.ReactNode;
    onReset?: () => Promise<void>;
    disabled?: boolean;
}
export declare const ReplyForm: React.FC<ReplyFormProps>;
export default ReplyForm;
