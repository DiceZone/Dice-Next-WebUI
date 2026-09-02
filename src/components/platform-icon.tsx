import type { ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const PLATFORM_META: Record<string, { label: string; icon: string }> = {
  onebot_v11: { label: 'QQ / OneBot', icon: '/platform-icons/onebot.svg' },
  milky: { label: 'Milky', icon: '/platform-icons/milky.svg' },
  qq_official: { label: 'QQ 官方机器人', icon: '/platform-icons/qq-official.svg' },
  discord: { label: 'Discord', icon: '/platform-icons/discord.svg' },
  kook: { label: 'KOOK', icon: '/platform-icons/kook.svg' },
};

const PLATFORM_ALIASES: Record<string, string> = {
  qq: 'onebot_v11',
  onebot: 'onebot_v11',
  onebot11: 'onebot_v11',
  'onebot-v11': 'onebot_v11',
  qqofficial: 'qq_official',
  'qq-official': 'qq_official',
};

export function normalizePlatform(platform?: string | null): string {
  const value = String(platform || '').trim().toLowerCase();
  return PLATFORM_ALIASES[value] || value;
}

export function platformLabel(platform?: string | null): string {
  const normalized = normalizePlatform(platform);
  return PLATFORM_META[normalized]?.label || platform || '未知平台';
}

type PlatformIconProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  platform?: string | null;
  alt?: string;
};

export function PlatformIcon({ platform, className, alt, title, ...props }: PlatformIconProps) {
  const meta = PLATFORM_META[normalizePlatform(platform)];
  if (!meta) return null;
  return (
    <img
      src={meta.icon}
      alt={alt ?? ''}
      title={title ?? meta.label}
      className={cn('inline-block h-4 w-4 shrink-0 object-contain', className)}
      draggable={false}
      {...props}
    />
  );
}

export function PlatformAccount({
  platform,
  account,
  className,
}: {
  platform?: string | null;
  account?: string | null;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <PlatformIcon platform={platform} />
      <span className="truncate">{account || '—'}</span>
    </span>
  );
}
