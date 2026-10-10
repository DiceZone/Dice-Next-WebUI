import { shortcuts } from '../i18n/shortcuts.js';

/** Only shortcut text uses these variables; never replace global player names. */
export function shortcutTemplatePreviewArgs(base: Record<string, string>, key: string, locale: string) {
  if (!key.startsWith('shortcut.')) return base;
  const copy = shortcuts[locale as keyof typeof shortcuts] ?? shortcuts['zh-Hans'];
  return { ...base, shortcut: copy.example_name, source: copy.group, command: copy.example_command,
    list: `[${copy.group}] .&${copy.example_name} → ${copy.example_command}` };
}
