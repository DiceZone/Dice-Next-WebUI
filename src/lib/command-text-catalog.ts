import { templateSummary } from './weighted-templates.js';
export const COMMAND_CATEGORIES = ['掷骰', 'COC', 'DND', '团务', '互动', '工具', '管理', '权限', '系统'] as const;

/** Read both the updated catalog and an older backend without losing rows. */
export function commandCategory(category: string): string {
  const aliases: Record<string, string> = { BRP: 'COC', 跑团: '团务', 牌堆: '互动', 娱乐: '互动', AI: '互动', 人物卡: '工具' };
  return aliases[category] ?? category;
}

export interface CatalogCommand {
  cmd: string;
  title: string;
  category: string;
  example: string;
  replies: { key: string; example?: string }[];
}
export interface EditableText {
  key: string;
  group: string;
  default: string;
  override: string | null;
  v2key?: string;
}
export interface TextMetadata {
  description: string;
  example: string;
  categories: string[];
}

export function buildTextMetadata(commands: readonly CatalogCommand[], label: (key: string) => string): Map<string, TextMetadata> {
  const out = new Map<string, TextMetadata>();
  // Use documented per-reply examples where available. Never invent a command
  // from the key, and do not present a sample reply as an executable example.
  for (const command of commands) {
    for (const reply of command.replies) {
      const category = commandCategory(command.category);
      const previous = out.get(reply.key);
      if (previous) {
        if (!previous.categories.includes(category)) previous.categories.push(category);
        continue;
      }
      const suffix = label(reply.key);
      out.set(reply.key, {
        description: suffix ? `${command.title} · ${suffix}` : command.title,
        example: reply.example || command.example.split(' / ')[0] || '',
        categories: [category],
      });
    }
  }
  return out;
}

export type TextSortField = 'example' | 'description' | 'key' | 'text';
export interface TextSort { field: TextSortField; direction: 'asc' | 'desc'; }
export type DescribedText<T extends EditableText = EditableText> = T & TextMetadata;

export function filterAndSortTexts<T extends EditableText>(
  texts: readonly DescribedText<T>[], query: string, category: string,
  sort: TextSort, locale = 'zh-Hans',
): DescribedText<T>[] {
  const queryWords = query.trim().toLocaleLowerCase(locale).split(/\s+/).filter(Boolean);
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const value = (text: DescribedText<T>) => sort.field === 'text' ? templateSummary(text.override ?? text.default) : text[sort.field];
  return texts.filter((text) => {
    if (category && !text.categories.includes(category)) return false;
    const content = [text.key, text.v2key, text.description, text.example, templateSummary(text.override ?? text.default), ...text.categories]
      .filter(Boolean).join(' ').toLocaleLowerCase(locale);
    return queryWords.every((word) => content.includes(word));
  }).sort((a, b) => {
    const av = value(a), bv = value(b);
    // Rows without a command example belong last in either direction.
    if (!av !== !bv) return av ? -1 : 1;
    const result = collator.compare(av, bv);
    return (sort.direction === 'desc' ? -result : result) || collator.compare(a.key, b.key);
  });
}
