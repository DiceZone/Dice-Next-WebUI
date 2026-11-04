// Install-as-app support. Browsers decide whether a site is installable; the
// panel can only meet their requirements and explain what is missing.

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallState =
  | 'installed'      // already running as an installed app
  | 'ready'          // the browser handed us an install prompt
  | 'insecure'       // http:// on a non-localhost address: no browser allows installing
  | 'ios'            // Safari on iOS/iPadOS: Share → Add to Home Screen
  | 'menu';          // installable from the browser menu (or browser does not support it)

export interface InstallEnvironment {
  standalone: boolean;
  secureContext: boolean;
  userAgent: string;
  maxTouchPoints: number;
  hasPrompt: boolean;
}

export function installState(env: InstallEnvironment): InstallState {
  if (env.standalone) return 'installed';
  if (env.hasPrompt) return 'ready';
  if (!env.secureContext) return 'insecure';
  const ua = env.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && env.maxTouchPoints > 1);
  if (ios) return 'ios';
  return 'menu';
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function subscribeInstallPrompt(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const pendingInstallPrompt = () => deferred;

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (!event) return 'unavailable';
  deferred = null; notify();
  await event.prompt();
  return (await event.userChoice).outcome;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Called once at startup. Registration needs a secure context (HTTPS or localhost). */
export function setupPwa(base = './') {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return;
  const register = () => navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
    /* Installation stays available from supporting browsers' menus. */
  });
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => void register(), { once: true });
}
