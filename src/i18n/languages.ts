// Side-effect-free list of panel languages. Import this (not '@/i18n') from
// modules that must not initialise i18next or touch localStorage.
export const SUPPORTED_LANGUAGES = [
  { code: 'zh-Hant', label: '繁體中文' },
  { code: 'zh-Hans', label: '简体中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];
