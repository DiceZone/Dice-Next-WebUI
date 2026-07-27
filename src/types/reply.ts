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
  // Enhanced engine (always present from the API):
  conditions?: ReplyCondition[];
  logic?: ReplyLogic;
  results?: string[];
  enabled: boolean;
  priority: number;
  // 触发限制（对齐原版每条规则自带的限制项）：
  prob?: number;         // 0-100，默认 100
  cooldownSec?: number;  // 冷却秒，默认 0
  scopeMode?: ReplyScopeMode;
  scopeIds?: string;     // 逗号分隔群号
  cooldownNotice?: string;   // 冷却中回这句（空=沉默）
  dayLimit?: number;         // 每日上限（按 规则×窗口；0=不限）
  dayLimitNotice?: string;   // 达到日限回这句（空=沉默）
  scopeUsersMode?: ReplyScopeMode;
  scopeUsers?: string;       // 逗号分隔用户ID
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
  // legacy single fields kept for back-compat with any old callers
  matchType?: MatchType;
  matchContent?: string;
  replyContent?: string;
}

/** Human-readable labels for match types.
 *  注意：keyword 是「整条消息完全相等」（原版 Match 语义），不是包含；
 *  「出现即回」用 search。界面文案统一走 i18n 的 replies.mt_*，这里仅作兜底。 */
export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  keyword: '完全匹配',
  prefix: '前缀匹配',
  regex: '正则匹配',
  search: '包含匹配',
};

/** Default priority for new reply rules. */
export const DEFAULT_REPLY_PRIORITY = 100;
