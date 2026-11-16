import { useState } from 'react';
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

export function officialBotAvatarUrl(adapter: Adapter) {
  if (adapter.avatarUrl && /^https?:\/\//i.test(adapter.avatarUrl)) return adapter.avatarUrl;
  if (adapter.qqNumber && /^[1-9]\d{0,19}$/.test(adapter.qqNumber))
    return `https://q1.qlogo.cn/g?b=qq&nk=${adapter.qqNumber}&s=100`;
  return undefined;
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
  const src = officialBotAvatarUrl(adapter);
  const [failed, setFailed] = useState(false);
  const nick = officialBotNick(adapter);
  const qq = adapter.qqNumber?.trim();
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
        {src && !failed
          ? <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
          : <PlatformIcon platform="qq_official" className="h-4 w-4" />}
      </span>
      <span className="min-w-0 truncate">{qq ? `${nick}(${qq})` : nick}</span>
    </span>
  );
}
