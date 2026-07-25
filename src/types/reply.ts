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
  // Enhanced engine (always present from the API):
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
  // legacy single fields kept for back-compat with any old callers
  matchType?: MatchType;
  matchContent?: string;
  replyContent?: string;
}

/** Human-readable labels for match types. */
export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  keyword: '关键词匹配',
  prefix: '前缀匹配',
  regex: '正则匹配',
  search: '搜索匹配',
};

/** Default priority for new reply rules. */
export const DEFAULT_REPLY_PRIORITY = 100;
