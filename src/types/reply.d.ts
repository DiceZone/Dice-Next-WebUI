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
/** 生效范围：'' 不限 | allow 仅指定群 | deny 排除指定群 */
export type ReplyScopeMode = '' | 'allow' | 'deny';
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
    prob?: number;
    cooldownSec?: number;
    scopeMode?: ReplyScopeMode;
    scopeIds?: string;
    cooldownNotice?: string;
    dayLimit?: number;
    dayLimitNotice?: string;
    scopeUsersMode?: ReplyScopeMode;
    scopeUsers?: string;
    createdAt: string;
    updatedAt: string;
}
export interface ReplyFormData {
    conditions: ReplyCondition[];
    logic: ReplyLogic;
    results: string[];
    priority: number;
    prob?: number;
    cooldownSec?: number;
    scopeMode?: ReplyScopeMode;
    scopeIds?: string;
    cooldownNotice?: string;
    dayLimit?: number;
    dayLimitNotice?: string;
    scopeUsersMode?: ReplyScopeMode;
    scopeUsers?: string;
    matchType?: MatchType;
    matchContent?: string;
    replyContent?: string;
}
/** Human-readable labels for match types.
 *  注意：keyword 是「整条消息完全相等」（原版 Match 语义），不是包含；
 *  「出现即回」用 search。界面文案统一走 i18n 的 replies.mt_*，这里仅作兜底。 */
export declare const MATCH_TYPE_LABELS: Record<MatchType, string>;
/** Default priority for new reply rules. */
export declare const DEFAULT_REPLY_PRIORITY = 100;
