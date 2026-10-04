export interface TraySettings {
  text: string;
  port: number;
  tooltip: string;
  supported: boolean;
}

export const TRAY_TEXT_LIMIT = 10;
export const trayTextLength = (text: string) => Array.from(text.trim()).length;
export const trayTextError = (text: string): 'limit' | 'invalid' | null => {
  const value = text.trim();
  if (trayTextLength(value) > TRAY_TEXT_LIMIT) return 'limit';
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029\ud800-\udfff]/u.test(value)) return 'invalid';
  return null;
};
export const trayTooltip = (text: string, port: number) => `${text.trim() || 'Dice!Next'}(${port})`;

// Missing/older backend support must not masquerade as editable settings.
export function readTraySettings(data: unknown): TraySettings {
  const value = data as Partial<TraySettings> | null;
  if (!value || typeof value.text !== 'string' || typeof value.supported !== 'boolean' ||
      typeof value.tooltip !== 'string' || !Number.isInteger(value.port) ||
      (value.port ?? 0) < 1 || (value.port ?? 0) > 65535 || trayTextError(value.text))
    throw new Error('Invalid tray settings response');
  return value as TraySettings;
}
