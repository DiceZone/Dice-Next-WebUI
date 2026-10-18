import { validWeights, writeTemplateVariants, type TemplateVariant } from './weighted-templates.js';

export interface HelpFile { name: string; content: string; }
export type HelpKind = 'custom' | 'builtin' | 'plugin' | 'rule' | 'helpdoc' | 'other';
export const HELP_KINDS: HelpKind[] = ['custom', 'builtin', 'plugin', 'rule', 'helpdoc', 'other'];
export interface HelpEntry {
  key: string; content: string; source: string; kind?: HelpKind; i18nKey?: string;
  locale?: string; contentLocale?: string; format?: 'plain' | 'markdown';
  editable: boolean; customized?: boolean; shadowed?: boolean;
}
export function helpSourceKind(source: string): HelpKind {
  if (source === 'builtin') return 'builtin';
  if (source === 'custom' || source.startsWith('file:')) return 'custom';
  if (source === 'plugin' || source.startsWith('plugin:') || source.startsWith('lua:')) return 'plugin';
  if (source.startsWith('rule:')) return 'rule';
  if (source.startsWith('helpdoc:')) return 'helpdoc';
  return 'other';
}
export const isHelpTemplateKey = (key: string) => key.startsWith('help.topic.') && key.length > 11;
export const canEditHelp = (entry: HelpEntry) => entry.editable && (entry.source.startsWith('file:')
  || (['builtin', 'custom'].includes(entry.source) && !!entry.i18nKey && isHelpTemplateKey(entry.i18nKey)));
/** Keep persona editing and command usage text; route standalone global topics to Help. */
export const belongsInCommandTexts = (key: string, commandText: boolean, personaId: number) =>
  !isHelpTemplateKey(key) || commandText || personaId > 0;

export interface HelpTemplateRecord { locale: string; key: string; content: string; format: 'plain' | 'markdown'; }
export interface HelpArchive { kind: 'dicenext.help'; version: 1; files: HelpFile[]; templates: HelpTemplateRecord[]; }

/** Include historical DB topics and built-in help customizations in backups. */
export function helpArchive(files: HelpFile[], overrides: Record<string, Record<string, unknown>>): HelpArchive {
  const templates: HelpTemplateRecord[] = [];
  for (const [locale, entries] of Object.entries(overrides)) {
    for (const [key, value] of Object.entries(entries)) {
      if (!isHelpTemplateKey(key)) continue;
      if (typeof value === 'string') templates.push({ locale, key, content: value, format: 'plain' });
      else if (value && typeof value === 'object' && 'value' in value && typeof value.value === 'string') {
        const record = value as { value: string; format?: unknown; variants?: TemplateVariant[] };
        if (record.variants && (!validWeights(record.variants) || record.variants.some(item => typeof item.text !== 'string'))) throw new Error('help_invalid_import');
        templates.push({ locale, key, content: record.variants ? writeTemplateVariants(record.variants) : record.value,
          format: record.format === 'markdown' ? 'markdown' : 'plain' });
      } else throw new Error('help_invalid_import');
    }
  }
  return { kind: 'dicenext.help', version: 1, files, templates };
}

export function parseHelpArchive(filename: string, text: string): HelpArchive {
  const data: unknown = /\.json$/i.test(filename) ? JSON.parse(text) : null;
  if (!data || typeof data !== 'object' || !('kind' in data) || data.kind !== 'dicenext.help')
    return { kind: 'dicenext.help', version: 1, files: parseHelpImport(filename, text), templates: [] };
  if (!('version' in data) || data.version !== 1 || !('files' in data) || !Array.isArray(data.files)
    || !('templates' in data) || !Array.isArray(data.templates)) throw new Error('help_invalid_import');
  const files = data.files.length ? parseHelpImport('files.json', JSON.stringify(data.files)) : [];
  const templates: HelpTemplateRecord[] = [];
  const seen = new Set<string>();
  for (const entry of data.templates) {
    if (!entry || typeof entry.locale !== 'string' || !/^[A-Za-z][A-Za-z0-9-]{0,63}$/.test(entry.locale)
      || typeof entry.key !== 'string' || !isHelpTemplateKey(entry.key) || /[\x00-\x1f]/.test(entry.key)
      || typeof entry.content !== 'string' || !['plain', 'markdown'].includes(entry.format)) throw new Error('help_invalid_import');
    const id = JSON.stringify([entry.locale, entry.key]);
    if (seen.has(id)) throw new Error('help_invalid_import');
    seen.add(id); templates.push({ locale: entry.locale, key: entry.key, content: entry.content, format: entry.format });
  }
  if (!files.length && !templates.length) throw new Error('help_invalid_import');
  return { kind: 'dicenext.help', version: 1, files, templates };
}

export function validHelpName(name: string): boolean {
  return !!name.trim() && name === name.trim() && !/[\\/\x00-\x1f]/.test(name) && name !== '.' && name !== '..';
}

/** Validate the whole bundle before any request; never silently drop entries. */
export function parseHelpImport(filename: string, text: string): HelpFile[] {
  let files: HelpFile[];
  if (/\.json$/i.test(filename)) {
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== 'object') throw new Error('help_invalid_import');
    if (Array.isArray(data)) {
      files = data.map((item) => {
        if (!item || typeof item !== 'object') throw new Error('help_invalid_import');
        return { name: item.name ?? item.key, content: item.content };
      });
    } else files = Object.entries(data).map(([name, content]) => ({ name, content: content as string }));
  } else if (/\.(md|txt)$/i.test(filename)) files = [{ name: filename.replace(/\.(md|txt)$/i, ''), content: text }];
  else throw new Error('help_invalid_import');
  const names = new Set<string>();
  if (!files.length) throw new Error('help_invalid_import');
  for (const file of files) {
    if (typeof file.name !== 'string' || !validHelpName(file.name) || typeof file.content !== 'string' || names.has(file.name)) throw new Error('help_invalid_import');
    names.add(file.name);
  }
  return files;
}
