import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhHant from './locales/zh-Hant.json';
import zhHans from './locales/zh-Hans.json';
import en from './locales/en.json';
import ja from './locales/ja.json';

/**
 * Front-end i18n setup (繁體中文 / 简体中文 / English).
 *
 * Single source of truth for which languages exist; the language
 * switcher and any future UI iterate over SUPPORTED_LANGUAGES.
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'zh-Hant', label: '繁體中文' },
  { code: 'zh-Hans', label: '简体中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const STORAGE_KEY = 'dice-lang';

/** Pick the initial language: saved choice → browser hint → 简体中文. */
function detectInitialLanguage(): LanguageCode {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
    return saved as LanguageCode;
  }
  const nav = navigator.language || 'zh-Hans';
  if (nav.startsWith('ja')) return 'ja';
  if (nav.startsWith('en')) return 'en';
  if (nav === 'zh-TW' || nav === 'zh-HK' || nav === 'zh-MO' || nav.includes('Hant')) {
    return 'zh-Hant';
  }
  return 'zh-Hans';
}

const initialLanguage = detectInitialLanguage();

i18n.use(initReactI18next).init({
  resources: {
    'zh-Hant': { translation: zhHant },
    'zh-Hans': { translation: zhHans },
    en: { translation: en },
    ja: { translation: ja },
  },
  lng: initialLanguage,
  fallbackLng: 'zh-Hans',
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

// Pick the <html lang> tag. Using "zh-Hans"/"zh-Hant" directly makes Chrome think
// the page language differs from the user's region preference (e.g. zh-CN / zh-HK)
// → it keeps offering to translate. So we honor the user's EXACT browser region
// tag when it belongs to the same script family as the shown content; otherwise
// fall back to a sensible default. (zh-HK 香港 / zh-MO 澳門 / zh-TW are all 繁體.)
function htmlLangFor(code: LanguageCode): string {
  const nav = navigator.language || '';
  if (code === 'zh-Hant') {
    if (/^zh-(HK|MO|TW)$/i.test(nav) || /Hant/i.test(nav)) return nav;  // 香港/澳門/台灣
    return 'zh-TW';
  }
  if (code === 'zh-Hans') {
    if (/^zh-(CN|SG)$/i.test(nav) || /Hans/i.test(nav)) return nav;
    return 'zh-CN';
  }
  if (code === 'en') return nav.toLowerCase().startsWith('en') ? nav : 'en';
  return code;
}

// Keep the <html lang> attribute in sync for accessibility / CSS / translate prompt.
document.documentElement.lang = htmlLangFor(initialLanguage);

/** Change the active language and persist the choice. */
export function changeLanguage(code: LanguageCode): void {
  localStorage.setItem(STORAGE_KEY, code);
  void i18n.changeLanguage(code);
  document.documentElement.lang = htmlLangFor(code);
}

export default i18n;
