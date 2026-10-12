import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FeatureHelp } from '@/components/ui/feature-help';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { chooseLanAddress, reverseWsAddress } from '@/lib/network-info';
import type { ServerNetworkView } from '@/hooks/use-server-network-info';

interface ReverseWsInfoProps {
  open: boolean;
  onClose: () => void;
  port: string;
  network: ServerNetworkView;
  onRefresh: () => Promise<void>;
}
export const ReverseWsInfo: React.FC<ReverseWsInfoProps> = ({ open, onClose, port, network, onRefresh }) => {
  const { t } = useTranslation();
  const [selectedLan, setSelectedLan] = useState('');
  const [copied, setCopied] = useState('');
  const [copyFailed, setCopyFailed] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => { setSelectedLan((old) => chooseLanAddress(network.data, old)); }, [network.data]);
  useEffect(() => {
    setCopied(''); setCopyFailed(false);
    return () => { if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, [open, port]);
  const busy = network.loading || network.data?.refreshing === true;
  const local = reverseWsAddress('127.0.0.1', port);
  const lan = reverseWsAddress(chooseLanAddress(network.data, selectedLan), port);
  const wan = reverseWsAddress(network.data?.wan.addresses[0], port);
  const placeholder = (type: 'lan' | 'wan') => {
    if (!local) return t('network_info.invalid_port');
    if (!network.error && !network.data && network.loading) return t('network_info.reading');
    if (network.data?.[type].status === 'detecting') return t('adapters.detecting');
    return t(type === 'lan' ? 'network_info.lan_failed' : 'network_info.wan_failed');
  };
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label); setCopyFailed(false);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(''), 2000);
    } catch { setCopyFailed(true); }
  };
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">{t('adapters.reverse_title')}
            <FeatureHelp title={t('adapters.reverse_title')} description={t('network_info.help')} />
          </DialogTitle>
          <DialogDescription>{t('adapters.reverse_desc')}</DialogDescription>
        </DialogHeader>
        {network.error && <p role="alert" className="text-sm text-destructive">{t('network_info.' + network.error)}</p>}
        {(network.data?.lan.addresses.length ?? 0) > 1 && <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('network_info.interface')}</span>
          <Select value={chooseLanAddress(network.data, selectedLan)} onValueChange={setSelectedLan}>
            <SelectTrigger aria-label={t('network_info.interface')} className="h-8 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{network.data?.lan.addresses.map((ip) => <SelectItem key={ip} value={ip}>{ip}</SelectItem>)}</SelectContent>
          </Select>
        </div>}
        <div className="space-y-3">
          {[
            { id: 'local', label: t('adapters.reverse_local'), addr: local, fallback: t('network_info.invalid_port'), stale: false },
            { id: 'lan', label: t('adapters.reverse_lan'), addr: lan, fallback: placeholder('lan'), stale: network.data?.lan.stale },
            { id: 'wan', label: t('adapters.reverse_wan'), addr: wan, fallback: placeholder('wan'), stale: network.data?.wan.stale },
          ].map(({ id, label, addr, fallback, stale }) => (
            <div key={id} className="grid grid-cols-[3rem_minmax(0,1fr)_2.5rem] items-center gap-2">
              <span className="text-xs text-muted-foreground">{label}{stale && <span className="block text-[10px] text-amber-600 dark:text-amber-400">{t('network_info.stale_label')}</span>}</span>
              <code className="select-text break-all rounded bg-muted px-3 py-2 text-sm font-mono">{addr ?? fallback}</code>
              <Button variant="ghost" size="icon" disabled={!addr} aria-label={[t('common.copy'), label].join(' ')} onClick={() => { if (addr) void copy(addr, id); }}>
                {copied === id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ))}
        </div>
        {(network.data?.lan.stale || network.data?.wan.stale) && <p role="status" className="text-xs text-amber-600 dark:text-amber-400">{t('network_info.stale')}</p>}
        {copyFailed && <p role="alert" className="text-xs text-destructive">{t('network_info.copy_failed')}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t('network_info.cached')}</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void onRefresh()}>
            <RefreshCw className={cn('mr-2 h-3.5 w-3.5', busy && 'animate-spin')} />{t(network.data?.refreshing ? 'network_info.refreshing' : network.loading ? 'network_info.reading' : 'network_info.refresh')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('network_info.reachability')}</p>
      </DialogContent>
    </Dialog>
  );
};
export default ReverseWsInfo;
