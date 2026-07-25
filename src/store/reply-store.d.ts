import type { ReplyRule, ReplyFormData } from '@/types/reply';
interface ReplyState {
    replies: ReplyRule[];
    loading: boolean;
    error: string | null;
    fetchReplies: () => Promise<void>;
    createReply: (data: ReplyFormData) => Promise<ReplyRule>;
    updateReply: (id: string, data: Partial<ReplyFormData>) => Promise<void>;
    deleteReply: (id: string) => Promise<void>;
    toggleReply: (id: string) => Promise<void>;
    clearError: () => void;
}
export declare const zustandReplyStore: import("zustand").UseBoundStore<import("zustand").StoreApi<ReplyState>>;
export {};
