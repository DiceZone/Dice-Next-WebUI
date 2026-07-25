import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';

/**
 * WebUI 登录门（C#34）。挂在 AppRouter 外层：
 * - 先查 /api/auth/status；未设口令或已登录 → 直接渲染应用。
 * - 设了口令且未登录 → 显示登录框，登录成功后写入会话 Cookie（浏览器自动随后续请求带上）。
 * 探测失败（后端不可达）时放行，避免把用户锁在外面。
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<'loading' | 'login' | 'ok'>('loading');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const check = async () => {
    try {
      const r = await fetch('/api/auth/status');
      const j = await r.json();
      const d = j.data || {};
      setState(d.required && !d.authed ? 'login' : 'ok');
    } catch {
      setState('ok');
    }
  };
  useEffect(() => { void check(); }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (!r.ok) { setErr(t('auth.wrong')); setBusy(false); return; }
      setPw('');
      setState('ok');
    } catch {
      setErr(t('auth.error'));
    }
    setBusy(false);
  };

  if (state === 'loading') return null;
  if (state === 'ok') return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground px-4">
      <form onSubmit={login} className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600/10 text-brand-600">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">🎲 Dice!Next</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('auth.prompt')}</p>
        </div>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder={t('auth.password')}
          className="mb-3 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-600/40"
        />
        {err && <p className="mb-3 text-sm text-red-500">{err}</p>}
        <button
          type="submit"
          disabled={busy || !pw}
          className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? t('auth.logging_in') : t('auth.login')}
        </button>
      </form>
    </div>
  );
};

export default AuthGate;
