import { useState } from 'react';
import { UserRound, Users2 } from 'lucide-react';
import { normalizePlatform } from '@/components/platform-icon';
import { cn } from '@/lib/utils';

type EntityAvatarProps = {
  kind: 'user' | 'group';
  id: string;
  platform: string;
  virtualId?: boolean;
  className?: string;
};

export function entityAvatarSource({ kind, id, platform, virtualId }: EntityAvatarProps): string | undefined {
  const normalized = normalizePlatform(platform);
  // OpenIDs and generated identity IDs are not QQ numbers, even if numeric.
  if (virtualId || !['onebot_v11', 'milky'].includes(normalized) || !/^[1-9]\d{0,19}$/.test(id)) return undefined;
  return kind === 'group'
    ? `https://p.qlogo.cn/gh/${id}/${id}/100`
    : `https://q1.qlogo.cn/g?b=qq&nk=${id}&s=100`;
}

/** The same avatar and failure fallback in list, card and detail views. */
export function EntityAvatar(props: EntityAvatarProps) {
  const source = entityAvatarSource(props);
  const [failedSource, setFailedSource] = useState<string>();
  const Fallback = props.kind === 'group' ? Users2 : UserRound;
  return <span aria-hidden="true" className={cn(
    'flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden bg-primary/10 text-primary',
    props.kind === 'group' ? 'rounded-md' : 'rounded-full', props.className,
  )}>
    {source && source !== failedSource ? <img key={source} src={source} alt="" loading="lazy" decoding="async"
      referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={() => setFailedSource(source)} />
      : <Fallback className="h-1/2 w-1/2" />}
  </span>;
}
