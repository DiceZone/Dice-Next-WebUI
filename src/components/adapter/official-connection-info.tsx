import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { officialWebhookUrl } from '@/lib/adapter-connection';
import type { Adapter } from '@/types/adapter';
import { OfficialWebhookWarning } from './official-webhook-warning';

export function OfficialConnectionInfo({ adapter, onClose }: { adapter: Adapter | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const address = typeof document === 'undefined' ? '' : officialWebhookUrl(document.baseURI);
  return <Dialog open={!!adapter} onOpenChange={(open) => { if (!open) { onClose(); setCopied(false); setFailed(false); } }}>
    <DialogContent>
      <DialogHeader><DialogTitle>{t('adapters.connection_mode')}</DialogTitle><DialogDescription>{adapter?.name} · {adapter?.qqReceiveMode === 'webhook' ? 'Webhook' : 'WebSocket'}</DialogDescription></DialogHeader>
      {adapter?.qqReceiveMode === 'webhook' ? <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('adapters.webhook_help')}</p>
        <OfficialWebhookWarning />
        <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted/30 p-3">
          <code className="min-w-0 flex-1 break-all text-sm select-text" data-testid="webhook-url">{address}</code>
          <Button variant="ghost" size="icon" aria-label={t('adapters.copy_callback')} onClick={async () => {
            try { await navigator.clipboard.writeText(address); setCopied(true); setFailed(false); }
            catch { setFailed(true); }
          }}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('adapters.webhook_reachability')}</p>
        {failed && <p role="alert" className="text-sm text-destructive">{t('network_info.copy_failed')}</p>}
      </div> : <p className="text-sm text-muted-foreground">{t('adapters.websocket_help')}</p>}
    </DialogContent>
  </Dialog>;
}
