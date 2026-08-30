export const ADMIN_PASSWORD_MAX_LENGTH = 64;

export function sanitizeAdminPassword(value: string): string {
  return value.replace(/[^\x21-\x7E]/g, '').slice(0, ADMIN_PASSWORD_MAX_LENGTH);
}

export function isValidAdminPassword(value: string, allowEmpty = false): boolean {
  if (!value) return allowEmpty;
  return /^[\x21-\x7E]{8,64}$/.test(value)
    && /[A-Z]/.test(value)
    && /[a-z]/.test(value)
    && /[0-9]/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}