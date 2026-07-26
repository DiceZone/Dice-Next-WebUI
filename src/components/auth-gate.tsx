import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background text-foreground px-4">
      {/* 动态背景：仅 transform 动画的渐变光晕（GPU 合成，低消耗） */}
      <div aria-hidden className="login-orb login-orb-a" />
      <div aria-hidden className="login-orb login-orb-b" />

      <form onSubmit={login} className="relative w-full max-w-sm rounded-xl border bg-card/95 p-8 shadow-lg backdrop-blur-sm">
        <div className="mb-7 text-center">
          <img src="/favicon.svg" alt="Dice!Next" className="mx-auto mb-4 h-16 w-16" />
          <h1 className="text-2xl font-bold tracking-tight">Dice!Next</h1>
          <p className="mt-0.5 text-sm font-medium text-muted-foreground">{t('header.panel_title')}</p>
        </div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="login-pw">{t('auth.password')}</label>
        <input
          id="login-pw"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder={t('auth.prompt')}
          className="mb-4 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
        />
        {err && <p className="mb-3 text-sm text-destructive">{err}</p>}
        <button
          type="submit"
          disabled={busy || !pw}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? t('auth.logging_in') : t('auth.login')}
        </button>
      </form>

      <p className="relative mt-6 text-xs text-muted-foreground">Dice!Next © 2025-2026 DiceZone</p>
    </div>
  );
};

export default AuthGate;
