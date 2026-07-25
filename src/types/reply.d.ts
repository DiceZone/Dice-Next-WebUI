/**
 * Custom reply rule type definitions.
 *
 * Reply rules define keyword-triggered auto-responses for the bot.
 */
export type MatchType = 'keyword' | 'prefix' | 'regex' | 'search';
export type ReplyLogic = 'and' | 'or';
export interface ReplyCondition {
    type: MatchType;
    content: string;
}
export interface ReplyRule {
    id: string;
    matchType: MatchType;
    matchContent: string;
    replyContent: string;
    conditions?: ReplyCondition[];
    logic?: ReplyLogic;
    results?: string[];
    enabled: boolean;
    priority: number;
    createdAt: string;
    updatedAt: string;
}
export interface ReplyFormData {
    conditions: ReplyCondition[];
    logic: ReplyLogic;
    results: string[];
    priority: number;
    matchType?: MatchType;
    matchContent?: string;
    replyContent?: string;
}
/** Human-readable labels for match types. */
export declare const MATCH_TYPE_LABELS: Record<MatchType, string>;
/** Default priority for new reply rules. */
export declare const DEFAULT_REPLY_PRIORITY = 100;
