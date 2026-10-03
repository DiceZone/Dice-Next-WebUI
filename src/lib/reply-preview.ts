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
