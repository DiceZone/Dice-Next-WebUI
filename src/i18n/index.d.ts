import i18n from 'i18next';
/**
 * Front-end i18n setup (繁體中文 / 简体中文 / English).
 *
 * Single source of truth for which languages exist; the language
 * switcher and any future UI iterate over SUPPORTED_LANGUAGES.
 */
export declare const SUPPORTED_LANGUAGES: readonly [{
    readonly code: "zh-Hant";
    readonly label: "繁體中文";
}, {
    readonly code: "zh-Hans";
    readonly label: "简体中文";
}, {
    readonly code: "en";
    readonly label: "English";
}, {
    readonly code: "ja";
    readonly label: "日本語";
}];
export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];
/** Change the active language and persist the choice. */
export declare function changeLanguage(code: LanguageCode): void;
export default i18n;
