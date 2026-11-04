import { describe, expect, it } from 'vitest';
import { installState } from '../../src/lib/pwa-install';

const base = {
  standalone: false,
  secureContext: true,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/140',
  maxTouchPoints: 0,
  hasPrompt: false,
};

describe('install-as-app state', () => {
  it('explains why installation is unavailable instead of silently hiding it', () => {
    expect(installState({ ...base, standalone: true, hasPrompt: true })).toBe('installed');
    expect(installState({ ...base, hasPrompt: true })).toBe('ready');
    expect(installState({ ...base, secureContext: false })).toBe('insecure');
    expect(
      installState({ ...base, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1' }),
    ).toBe('ios');
    expect(
      installState({
        ...base,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1',
        maxTouchPoints: 5,
      }),
    ).toBe('ios');
    expect(installState(base)).toBe('menu');
  });
});
