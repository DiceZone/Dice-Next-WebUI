import type { ReplySettingsScope } from './reply-scope';

export const MAX_REPLY_REGEX_BYTES = 400;

// Syntax-only coarse validation. Matching is always done by the backend;
// never run an untrusted pattern against preview text in the browser.
export function replyRegexError(pattern: string): string | null {
  if (new TextEncoder().encode(pattern).length > MAX_REPLY_REGEX_BYTES)
    return `pattern too long (max ${MAX_REPLY_REGEX_BYTES} UTF-8 bytes)`;
  try { new RegExp(pattern, 'i'); return null; } catch (error) { return String(error); }
}

export function replyMatchTestBody(text: string, groupId: string, scope: ReplySettingsScope) {
  return {
    text, // Leading/trailing spaces and line breaks are part of the message.
    groupId: groupId.trim() || undefined,
    scope: scope.scope,
    platform: scope.platform || undefined,
    adapterId: scope.scope === 'account' ? scope.target : undefined,
  };
}

export const PREVIEW_PLATFORMS = ['qq_group', 'qq_private', 'qq_channel', 'kook', 'discord', 'plain'] as const;
export type PreviewPlatform = typeof PREVIEW_PLATFORMS[number];
export interface ReplyPreview {
  text: string;
  plain: string;
  markdown: boolean;
  payload: Record<string, unknown> | null;
  actions: { label: string; text: string }[];
}
export function readReplyPreview(data: unknown): ReplyPreview | null {
  if (!data || typeof data !== 'object') return null;
  const p = (data as { preview?: ReplyPreview }).preview;
  if (!p || typeof p.text !== 'string' || typeof p.plain !== 'string' || typeof p.markdown !== 'boolean'
    || (p.payload !== null && (typeof p.payload !== 'object' || Array.isArray(p.payload)))
    || !Array.isArray(p.actions) || !p.actions.every(a => a && typeof a.label === 'string' && typeof a.text === 'string')) return null;
  return p;
}
