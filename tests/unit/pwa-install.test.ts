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

describe('install entry visibility', () => {
  it('appears only after the browser offers installation and disappears once installed', async () => {
    const { act, renderHook } = await import('@testing-library/react');
    const { setupPwa, useCanInstall, promptInstall } = await import('../../src/lib/pwa-install');
    setupPwa();
    const { result } = renderHook(() => useCanInstall());
    expect(result.current).toBe(false);
    const makeOffer = () =>
      Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt: () => Promise.resolve(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const }),
      });
    const offer = makeOffer();
    act(() => {
      window.dispatchEvent(offer);
    });
    expect(offer.defaultPrevented).toBe(true);
    expect(result.current).toBe(true);
    await act(async () => {
      expect(await promptInstall()).toBe('accepted');
    });
    expect(result.current).toBe(false);
    act(() => {
      window.dispatchEvent(makeOffer());
    });
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(result.current).toBe(false);
  });
});
