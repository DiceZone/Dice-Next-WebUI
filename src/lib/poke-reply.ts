import type { ReplyRule } from '../types/reply';
import { replyResults } from './reply-results.js';

export interface PokeSettings {
  poke?: string;
  poke_default?: string;
  poke_command?: string;
  poke_enabled?: boolean;
  poke_reply?: Partial<ReplyRule> | null;
  overrides?: Record<string, unknown>;
}

export const POKE_KEYS = ['poke_reply', 'poke', 'poke_command', 'poke_enabled'];

export function pokeReplyRule(settings: PokeSettings): ReplyRule {
  const saved = settings.poke_reply;
  const raw = saved ?? { results: [settings.poke || settings.poke_default || ''], command: settings.poke_command || '' };
  const normalized = replyResults({ ...raw, replyContent: raw.replyContent ?? '' });
  return {
    id: 'poke', matchType: 'keyword', matchContent: '', replyContent: normalized.texts[0],
    conditions: [], logic: 'or', priority: 100, createdAt: '', updatedAt: '',
    ...raw, results: normalized.texts, resultWeights: normalized.weights,
    enabled: settings.poke_enabled !== false && raw.enabled !== false,
  };
}
