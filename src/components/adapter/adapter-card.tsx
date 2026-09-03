import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Cloud, Info, MoreHorizontal, Plug, Unplug, Pencil, Trash2, Wifi, PlugZap, Network } from 'lucide-react';
import type { Adapter } from '@/types/adapter';
import { PlatformIcon, platformLabel } from '@/components/platform-icon';

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

const STATUS_LABEL_KEYS: Record<Adapter['status'], string> = {
  connected: 'adapters.conn_connected',
  connecting: 'adapters.conn_connecting',
  error: 'adapters.conn_error',
  disconnected: 'adapters.conn_disconnected',
  timeout: 'adapters.conn_timeout',
};

const DetailRow: React.FC<{ label: string; children: React.ReactNode; mono?: boolean }> = ({ label, children, mono }) => (
  <div className="grid gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className={cn('min-w-0 break-all text-sm sm:text-right', mono && 'font-mono text-xs')}>{children}</dd>
  </div>
);

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
  const [detailOpen, setDetailOpen] = React.useState(false);
  const identityLabel = adapter.type === 'qq_official' ? t('adapters.detail_app_id') : t('adapters.detail_bot_id');
  const identityValue = adapter.type === 'qq_official' ? adapter.appId : adapter.loginId;
  const modeLabel = adapter.type === 'milky'
    ? adapter.connectionMode === 'forward_ws' ? t('adapters.milky_mode_ws') : t('adapters.milky_mode_webhook')
    : adapter.type === 'qq_official'
    ? t('adapters.detail_official_gateway')
    : adapter.type === 'discord' || adapter.type === 'kook'
      ? t('adapters.detail_gateway')
      : adapter.connectionMode === 'reverse_ws'
        ? t('adapters.mode_reverse_ws')
        : adapter.connectionMode === 'http'
          ? t('adapters.mode_http')
          : t('adapters.mode_forward_ws');
  const endpointValue = adapter.type === 'qq_official'
    ? t('adapters.detail_managed_endpoint')
    : adapter.type === 'discord' || adapter.type === 'kook'
      ? t('adapters.detail_managed_endpoint')
      : adapter.endpoint || '—';
  const secondaryValue = adapter.type === 'milky'
    ? (adapter.endpoint || adapter.name)
    : adapter.type === 'qq_official'
      ? (adapter.qqNumber || adapter.name)
      : adapter.type === 'onebot_v11'
        ? (adapter.endpoint || adapter.name)
        : adapter.name;

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
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                <PlatformIcon platform={adapter.type} className="h-3.5 w-3.5" />
                <span className="truncate">{identityLabel}: {identityValue || '—'}</span>
                </span>
              </div>
              {/* 副信息行：OneBot=连接地址、官方机器人=真实QQ、其余=适配器名称；
                  没有可写内容时回退为适配器名称，避免空行导致卡片样式变形。 */}
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={secondaryValue}>
                {adapter.type === 'qq_official'
                  ? (adapter.qqNumber ? `${t('adapters.detail_real_qq')}: ${adapter.qqNumber}` : adapter.name)
                  : adapter.type === 'onebot_v11' || adapter.type === 'milky'
                    ? (adapter.endpoint ? `${adapter.connectionMode === 'reverse_ws' ? t('adapters.port') : t('adapters.address')}: ${adapter.endpoint}` : adapter.name)
                    : adapter.name}
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

        {/* Footer */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Badge variant={adapter.heartApiKeyConfigured ? 'success' : 'warning'} className="gap-1.5 whitespace-nowrap text-[10px]">
            <Cloud className="h-3 w-3" />
            {adapter.heartApiKeyConfigured ? t('adapters.bdc_cloud_connected') : t('adapters.bdc_cloud_basic')}
          </Badge>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setDetailOpen(true)}>
              <Info className="mr-1 h-3.5 w-3.5" />{t('adapters.detail_btn')}
            </Button>
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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('adapters.detail_title')}</DialogTitle>
            <DialogDescription>{displayName}</DialogDescription>
          </DialogHeader>
          <dl className="rounded-lg border px-4">
            <DetailRow label={t('adapters.detail_platform')}>
              <span className="inline-flex items-center gap-2"><PlatformIcon platform={adapter.type} />{platformLabel(adapter.type)}</span>
            </DetailRow>
            <DetailRow label={t('adapters.name')}>{adapter.name}</DetailRow>
            {adapter.loginName && adapter.loginName !== adapter.name && <DetailRow label={t('adapters.detail_bot_name')}>{adapter.loginName}</DetailRow>}
            <DetailRow label={identityLabel} mono>{identityValue || '—'}</DetailRow>
            {adapter.type === 'qq_official' && <DetailRow label={t('adapters.detail_real_qq')} mono>{adapter.qqNumber || '—'}</DetailRow>}
            <DetailRow label={t('adapters.detail_protocol')}>{modeLabel}</DetailRow>
            <DetailRow label={t('adapters.endpoint')} mono>{endpointValue}</DetailRow>
            {adapter.type === 'milky' && adapter.connectionMode === 'forward_ws' && <DetailRow label={t('adapters.milky_event_endpoint')} mono>{adapter.eventEndpoint || '—'}</DetailRow>}
            {adapter.type === 'milky' && <>
              <DetailRow label={t('adapters.milky_webhook_base_url')} mono>{adapter.webhookBaseUrl || '—'}</DetailRow>
              <DetailRow label={t('adapters.milky_webhook_url')} mono>{adapter.webhookUrl || '—'}</DetailRow>
              <DetailRow label={t('adapters.milky_webhook_token')}>
                {adapter.webhookTokenConfigured ? t('adapters.milky_token_set', { tail: adapter.webhookTokenTail }) : t('adapters.milky_token_unset')}
              </DetailRow>
            </>}
            <DetailRow label={t('adapters.detail_connection_status')}>
              <span className="inline-flex items-center gap-2"><ConnectionStatus status={effectiveStatus} />{t(STATUS_LABEL_KEYS[effectiveStatus])}</span>
            </DetailRow>
            <DetailRow label={t('adapters.detail_enabled')}>{adapter.enabled ? t('adapters.status_on') : t('adapters.status_off')}</DetailRow>
            <DetailRow label={t('adapters.detail_bdc_cloud')}>
              <Badge variant={adapter.heartApiKeyConfigured ? 'success' : 'warning'} className="gap-1.5 whitespace-nowrap text-[10px]">
                <Cloud className="h-3 w-3" />
                {adapter.heartApiKeyConfigured ? t('adapters.bdc_cloud_connected') : t('adapters.bdc_cloud_basic')}
              </Badge>
            </DetailRow>
            <DetailRow label={t('adapters.last_active')}>{adapter.lastActive ? formatDateTime(adapter.lastActive) : '—'}</DetailRow>
            <DetailRow label={t('adapters.detail_created')}>{adapter.createdAt ? formatDateTime(adapter.createdAt) : '—'}</DetailRow>
            <DetailRow label={t('adapters.detail_internal_id')} mono>{adapter.id}</DetailRow>
          </dl>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AdapterCard;
