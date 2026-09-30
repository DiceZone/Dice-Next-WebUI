import React from 'react';
import type { ReplyRule } from '@/types/reply';
import type { ReplySettingsScope } from '@/lib/reply-scope';
interface ReplyMatchPreviewProps {
    replies: ReplyRule[];
    scope: ReplySettingsScope;
}
export declare const ReplyMatchPreview: React.FC<ReplyMatchPreviewProps>;
export default ReplyMatchPreview;
