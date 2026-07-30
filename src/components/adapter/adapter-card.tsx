import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConnectionStatus } from '@/components/adapter/connection-status';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils';
import { KeyRound, MoreHorizontal, Plug, Unplug, Pencil, Trash2, Wifi, PlugZap, Network } from 'lucide-react';
import type { Adapter } from '@/types/adapter';

interface AdapterCardProps {
  adapter: Adapter;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onReconnect: (id: string) => void;
  onEdit: (adapter: Adapter) => void;
  onDelete: (id: string) => void;
  onTestConnection: (id: string) => void;
  onShowReverseInfo?: (port: string) => void;
}

const MODE_LABELS: Record<string, string> = {
  forward_ws: '正向 WebSocket',
  reverse_ws: '反向 WebSocket',
  http: 'HTTP',
};

const ADAPTER_TYPE_LABELS: Record<string, string> = {
  onebot_v11: 'OneBot v11',
  qq_official: 'QQ 官方机器人 2.0',
  discord: 'Discord',
  kook: 'KOOK',
};

export const AdapterCard: React.FC<AdapterCardProps> = ({
  adapter,
  onConnect,
  onDisconnect,
  onReconnect,
  onEdit,
  onDelete,
  onTestConnection,
  onShowReverseInfo,
}) => {
  // Backend reports connected / timeout / disconnected. An adapter that is enabled
  // but not (yet) connected is actively retrying → show it as 「连接中」(yellow). A
  // 'timeout' adapter (C#38: auto-reconnect paused after 20 fails) is orange and
  // offers a manual reconnect — visually distinct from a deliberately disabled one.
  const effectiveStatus: Adapter['status'] =
    adapter.status === 'connected' ? 'connected'
      : adapter.status === 'timeout' ? 'timeout'
        : adapter.enabled ? 'connecting'
          : 'disconnected';
  const isConnected = effectiveStatus === 'connected';
  const isConnecting = effectiveStatus === 'connecting';
  const isTimeout = effectiveStatus === 'timeout';
  const displayName = isConnected && adapter.loginName ? adapter.loginName : adapter.name;
  const avatarQQ = adapter.type === 'qq_official' ? (adapter.qqNumber || '')
    : adapter.type === 'onebot_v11' ? (adapter.loginId || '') : '';   // Discord/KOOK 无 QQ 头像
  const { t } = useTranslation();

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-md',
      )}
    >
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between">
          <div className={cn('flex items-center gap-3 min-w-0', !adapter.enabled && 'opacity-50')}>
            {/* QQ avatar with connection status overlay */}
            <div className="relative shrink-0">
              {avatarQQ ? (
                <img
                  src={`https://q1.qlogo.cn/g?b=qq&nk=${avatarQQ}&s=100`}
                  alt={adapter.loginName || adapter.name}
                  className="h-10 w-10 rounded-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <PlugZap className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <ConnectionStatus status={effectiveStatus} className="absolute -bottom-0.5 -right-0.5" />
            </div>
            {/* C#105：flex-1 给出确定宽度，超长名称 truncate 成省略号 */}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold truncate">{displayName}</h3>
              <p className="text-xs text-muted-foreground">
                {adapter.loginId && <span>{adapter.type === 'onebot_v11' ? 'QQ:' : 'Bot:'}{adapter.loginId} · </span>}
                {adapter.type === 'qq_official' && adapter.qqNumber && <span>QQ:{adapter.qqNumber} · </span>}
                {ADAPTER_TYPE_LABELS[adapter.type] || adapter.type} · {adapter.type === 'onebot_v11'
                  ? (MODE_LABELS[adapter.connectionMode] || adapter.connectionMode)
                  : adapter.type === 'qq_official' ? '官方 Gateway WebSocket' : 'Gateway WebSocket'}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onTestConnection(adapter.id)}>
                <Wifi className="mr-2 h-4 w-4" />{t('adapters.test_connection')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(adapter)}>
                <Pencil className="mr-2 h-4 w-4" />{t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete(adapter.id)}>
                <Trash2 className="mr-2 h-4 w-4" />{t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Endpoint / Port */}
        <div className={cn('mt-3', !adapter.enabled && 'opacity-50')}>
          <p className="font-mono text-xs text-muted-foreground truncate" title={adapter.endpoint}>
            {adapter.type === 'qq_official'
              ? `AppID: ${adapter.appId || '—'}`
              : adapter.connectionMode === 'reverse_ws'
              ? `${t('adapters.port')}: ${adapter.endpoint}`
              : `${t('adapters.address')}: ${adapter.endpoint}`}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <div className={cn('flex items-center gap-2', !adapter.enabled && 'opacity-50')}>
            <Badge variant={adapter.enabled ? 'success' : 'secondary'} className="text-[10px] whitespace-nowrap shrink-0">
              {adapter.enabled ? t('adapters.status_on') : t('adapters.status_off')}
            </Badge>
            <Badge variant={adapter.heartApiKeyConfigured ? 'outline' : 'secondary'} className="gap-1 text-[10px] whitespace-nowrap">
              <KeyRound className="h-3 w-3" />
              {adapter.heartApiKeyConfigured
                ? t('adapters.heart_key_ready', { tail: adapter.heartApiKeyTail })
                : t('adapters.heart_key_missing')}
            </Badge>
            {adapter.lastActive && (
              <span className="text-[10px] text-muted-foreground">
                {t('adapters.last_active')}: {formatDateTime(adapter.lastActive)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {adapter.connectionMode === 'reverse_ws' && onShowReverseInfo && (
              <Button variant="outline" size="sm" onClick={() => onShowReverseInfo(adapter.endpoint)}
                className="text-purple-600 border-purple-200 bg-purple-50 hover:bg-purple-100 hover:text-purple-700" title={t('adapters.reverse_title')}>
                <Network className="mr-1 h-3.5 w-3.5" />{t('adapters.reverse_btn')}
              </Button>
            )}
            {isTimeout ? (
              // C#38: timed-out (paused) adapter — offer a manual reconnect, labeled 「启用」
              // (not 「解除禁用」: it was never disabled, just paused after repeated failures).
              <Button variant="outline" size="sm" onClick={() => onReconnect(adapter.id)}
                className="text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100 hover:text-orange-700">
                <Plug className="mr-1 h-3.5 w-3.5" />{t('common.enable')}
              </Button>
            ) : adapter.enabled ? (
              <Button variant="outline" size="sm" onClick={() => onDisconnect(adapter.id)}
                className="text-red-600 border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-700">
                <Unplug className="mr-1 h-3.5 w-3.5" />{t('common.disable')}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => onConnect(adapter.id)} disabled={isConnecting}
                className="text-emerald-500 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 hover:text-emerald-600">
                <Plug className="mr-1 h-3.5 w-3.5" />
                {isConnecting ? t('adapters.connecting') : t('common.undisable')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdapterCard;
