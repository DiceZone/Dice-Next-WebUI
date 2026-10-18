export const DEFAULT_BOT_MESSAGE = 'Dice!Next 测试群：933145116\n如有故障或建议欢迎加群反馈\n使用 .help 查看帮助';
export const BOT_MESSAGE_LIMIT = 65536;

export interface BotMessageSettings {
  message: string;
  legacyHeader: string;
  defaultLocale: string;
  overridden: boolean;
}

export function readBotMessageSettings(data: unknown): BotMessageSettings {
  const root = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const values = root.values && typeof root.values === 'object' ? root.values as Record<string, unknown> : {};
  const overrides = root.overrides && typeof root.overrides === 'object' ? root.overrides : {};
  return {
    message: typeof values.bot_msg === 'string' ? values.bot_msg : DEFAULT_BOT_MESSAGE,
    legacyHeader: typeof values.bot_header === 'string' ? values.bot_header : '',
    defaultLocale: typeof root.default_locale === 'string' ? root.default_locale : 'zh-Hans',
    overridden: root.scope !== 'global' && ['bot_msg', 'bot_header'].some((key) => Object.prototype.hasOwnProperty.call(overrides, key)),
  };
}

// Never serialize editable branding/version/compiler/engine fields. Blank text
// is intentional and must not silently turn back into the default notice.
export function botMessageValues(message: string, legacyHeader: string) {
  return { bot_msg: message, bot_header: legacyHeader };
}

export function validBotMessage(message: string, legacyHeader: string): boolean {
  return [message, legacyHeader].every((value) => new TextEncoder().encode(value).length <= BOT_MESSAGE_LIMIT);
}
