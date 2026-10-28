// 第三方登录：后台地址、发起授权与回调结果。
import { panelRoot } from './webui-version.js';

export interface SsoLoginProvider { id: string; kind: 'bdc' | 'oidc'; name: string; logo: string; }

/** BDC uses its bundled official mark; relative paths retain the active UI directory. */
export function ssoProviderLogo(provider: Pick<SsoLoginProvider, 'kind' | 'logo'>): string {
  return provider.kind === 'bdc' ? './icons/dicezone-account.svg' : provider.logo;
}

/** 浏览器所在的后台根地址（含反代路径前缀，不带结尾斜杠）。 */
export function panelBase(location: Partial<Pick<Location, 'origin' | 'pathname'>> = window.location): string {
  const path = panelRoot(location?.pathname || '');
  return `${location?.origin || ''}${path}`;
}

export function isHttpsPanel(location: Partial<Pick<Location, 'protocol'>> = window.location): boolean {
  return location?.protocol === 'https:';
}

export function ssoStartUrl(provider: string, purpose: 'login' | 'bind' = 'login'): string {
  const path = purpose === 'bind' ? '/api/auth/sso/bind/start' : '/api/auth/sso/start';
  return `${path}?provider=${encodeURIComponent(provider)}&base=${encodeURIComponent(panelBase())}`;
}

const KNOWN_ERRORS = ['state', 'denied', 'provider', 'token', 'userinfo', 'qq', 'forbidden', 'unbound', 'save'] as const;

/** 读出并清掉回调带回来的 ?sso= / ?sso_error=，返回需要显示的翻译键。 */
export function takeSsoResult(): { error?: string; done?: string } {
  if (typeof window === 'undefined' || !window.location?.search) return {};
  const params = new URLSearchParams(window.location.search);
  const error = params.get('sso_error');
  const done = params.get('sso');
  if (!error && !done) return {};
  params.delete('sso_error');
  params.delete('sso');
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  return {
    error: error ? `sso.error_${(KNOWN_ERRORS as readonly string[]).includes(error) ? error : 'provider'}` : undefined,
    done: done || undefined,
  };
}
