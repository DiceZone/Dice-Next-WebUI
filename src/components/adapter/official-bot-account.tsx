import { useEffect, useState } from 'react';
import { PlatformIcon } from '@/components/platform-icon';
import { cn } from '@/lib/utils';
import type { Adapter } from '@/types/adapter';

export function officialBotNick(adapter: Adapter) {
  return adapter.loginName?.trim() || adapter.name;
}

export function officialBotId(adapter: Adapter) {
  return adapter.appId || adapter.loginId || adapter.id;
}

export function officialBotOptionLabel(adapter: Adapter) {
  return `${officialBotNick(adapter)}(${officialBotId(adapter)})`;
}

/** 普通 QQ 头像。13 位官民号不会命中。 */
export function qqPortrait(uin?: string | number, size: 40 | 100 | 140 | 640 = 100): string {
  const n = String(uin ?? '').trim();
  if (!/^\d{5,12}$/.test(n)) return '';
  return `https://q.qlogo.cn/g?b=qq&nk=${n}&s=${size}`;
}

export function officialBotAvatarSources(adapter: Adapter): string[] {
  const urls: string[] = [];
  if (adapter.avatarUrl && /^https?:\/\//i.test(adapter.avatarUrl)) urls.push(adapter.avatarUrl);
  const qq = qqPortrait(adapter.qqNumber);
  if (qq && !urls.includes(qq)) urls.push(qq);
  return urls;
}

export function officialBotAvatarUrl(adapter: Adapter) {
  return officialBotAvatarSources(adapter)[0];
}

export function OfficialBotAvatar({ adapter, className }: { adapter: Adapter; className?: string }) {
  const urls = officialBotAvatarSources(adapter);
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [adapter.avatarUrl, adapter.qqNumber]);
  if (i < urls.length) {
    return <img src={urls[i]} alt="" referrerPolicy="no-referrer" onError={() => setI((n) => n + 1)}
      className={cn('shrink-0 rounded-full bg-muted object-cover', className)} />;
  }
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-full bg-primary/10', className)}>
      <PlatformIcon platform="qq_official" className="h-1/2 w-1/2" />
    </div>
  );
}

export function OfficialBotOption({ adapter, className }: { adapter: Adapter; className?: string }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <PlatformIcon platform="qq_official" />
      <span className="truncate">{officialBotOptionLabel(adapter)}</span>
    </span>
  );
}

export function OfficialBotIdentity({ adapter }: { adapter: Adapter }) {
  const nick = officialBotNick(adapter);
  const qq = adapter.qqNumber?.trim();
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm">
      <OfficialBotAvatar adapter={adapter} className="h-8 w-8" />
      <span className="min-w-0 truncate">{qq ? `${nick}(${qq})` : nick}</span>
    </span>
  );
}
