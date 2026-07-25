import React from 'react';
import type { ReplyRule, ReplyFormData } from '@/types/reply';
interface ReplyFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: ReplyFormData) => Promise<void>;
    reply?: ReplyRule | null;
}
export declare const ReplyForm: React.FC<ReplyFormProps>;
export default ReplyForm;
