/** Open a bind/login URL: the phone WebView bridge hands it to QQ/system; browsers open a tab. */
export function openExternalUrl(url: string) {
  const bridge = (window as Window & { DiceNext?: { openUrl?: (u: string) => void } }).DiceNext;
  if (bridge?.openUrl) {
    bridge.openUrl(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Jump-to-QQ is for the embedded app and phones; desktop still shows the QR code. */
export function prefersJumpLogin(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & { DiceNext?: { openUrl?: (u: string) => void } };
  if (w.DiceNext?.openUrl) return true;
  if (/Android|iPhone|iPod|Mobile/i.test(navigator.userAgent || '')) return true;
  try {
    if (window.matchMedia('(pointer: coarse) and (max-width: 56rem)').matches) return true;
  } catch {
    /* ignore */
  }
  return false;
}
