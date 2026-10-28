import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDialogs } from '@/hooks/use-dialogs';
import { useToast } from '@/hooks/use-toast';
import apiClient, { ApiError } from '@/lib/api-client';
import { CheckCircle2, Loader2, LogOut, QrCode, RefreshCw, ScanLine, X } from 'lucide-react';

/** GET /api/adapters/{id}/openopq 的返回。 */
export interface OpenOpqStatus {
  stage: 'idle' | 'preparing' | 'downloading' | 'running' | 'backoff' | 'key_rejected' | 'failed' | 'stopped';
  error?: string;
  version?: string;
  restarts?: number;
  account?: string;
  /** 下载协议端时已收到 / 总字节 */
  download?: { bytes: number; total: number };
  console: null | {
    phase: string;
    account?: string;
    online: boolean;
    nickname?: string;
    qr?: string;
    qrExpires?: string | null;
    error?: string;
    notice?: string;
  };
}

interface OpenOpqLoginProps {
  adapterId: string | null;
  adapterName?: string;
  onClose: () => void;
}

const SCANNED_PHASES = new Set(['authenticating', 'securing', 'registering']);
//: 协议端刚起来、还没开始登录的阶段。进到这里就替用户取一次二维码，省得再点一下
const FRESH_PHASES = new Set(['idle', 'ready']);

const toMb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

const errorText = (error: unknown) =>
  error instanceof ApiError ? error.responseMessage : error instanceof Error ? error.message : String(error);

export const OpenOpqLogin: React.FC<OpenOpqLoginProps> = ({ adapterId, adapterName, onClose }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const dlg = useDialogs(t);
  const [status, setStatus] = React.useState<OpenOpqStatus | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [loadError, setLoadError] = React.useState('');
  //: 每次打开窗口只自动取一次：取失败了交给用户手动重试，不能一直自动重来
  const autoRequested = React.useRef(false);

  const refresh = React.useCallback(async () => {
    if (!adapterId) return;
    try {
      const res = await apiClient.get<OpenOpqStatus>(`/adapters/${encodeURIComponent(adapterId)}/openopq`);
      setStatus(res.data);
      setLoadError('');
    } catch (error) {
      setLoadError(errorText(error));
    }
  }, [adapterId]);

  React.useEffect(() => {
    setStatus(null);
    setLoadError('');
    autoRequested.current = false;
    if (!adapterId) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(timer);
  }, [adapterId, refresh]);

  const act = async (action: 'login' | 'cancel' | 'disconnect') => {
    if (!adapterId) return;
    if (action === 'disconnect' && !(await dlg.confirm({
      title: t('adapters.openopq_disconnect'),
      description: t('adapters.openopq_disconnect_confirm'),
      destructive: true,
    }))) return;
    setBusy(true);
    try {
      const res = await apiClient.post<OpenOpqStatus>(`/adapters/${encodeURIComponent(adapterId)}/openopq/${action}`);
      setStatus(res.data);
    } catch (error) {
      toast({ title: t('common.operation_fail'), description: errorText(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const stage = status?.stage;
  const consoleState = status?.console ?? null;
  const phase = consoleState?.phase ?? '';
  const online = phase === 'online' && !!consoleState?.online;
  const waiting = phase === 'waiting' || phase === 'requesting';
  const scanned = SCANNED_PHASES.has(phase);
  const qrExpired = phase === 'waiting' && !consoleState?.qr;
  const running = stage === 'running' && !!consoleState;
  const starting = stage === 'running' && !consoleState;
  const qrLoading = phase === 'requesting' || (busy && !consoleState?.qr);
  const download = stage === 'downloading' && status?.download && status.download.total > 0 ? status.download : null;
  const downloadPercent = download ? Math.min(100, Math.round((download.bytes / download.total) * 100)) : 0;

  // 协议端起来了、还没开始登录：直接替用户取一次二维码
  React.useEffect(() => {
    if (!running || busy || autoRequested.current || !FRESH_PHASES.has(phase)) return;
    autoRequested.current = true;
    void act('login');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, busy, phase]);

  const stageText = !status
    ? t('common.loading')
    : stage === 'running' && !consoleState
      ? t('adapters.openopq_stage_starting')
      : t(`adapters.openopq_stage_${stage}`, { defaultValue: stage });

  const phaseText = online
    ? t('adapters.openopq_phase_online', { name: consoleState?.nickname || consoleState?.account || status?.account })
    : phase === 'requesting'
      ? t('adapters.openopq_phase_requesting')
      : qrExpired
        ? t('adapters.openopq_qr_expired')
        : phase === 'waiting'
          ? t('adapters.openopq_phase_waiting')
          : scanned
            ? t('adapters.openopq_phase_scanned')
            : phase === 'offline'
              ? t('adapters.openopq_phase_offline')
              : phase === 'error'
                ? t('adapters.openopq_phase_error')
                : t('adapters.openopq_phase_ready');

  // 阶段性错误（取清单失败、进程退出）与登录错误分开显示
  const detail = !running ? status?.error : (consoleState?.error || consoleState?.notice || '');

  return (
    <Dialog open={!!adapterId} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <QrCode className="h-4 w-4" />{t('adapters.openopq_title')}
            <Badge variant="warning" className="whitespace-nowrap text-[10px]">{t('adapters.openopq_experimental')}</Badge>
          </DialogTitle>
          <DialogDescription>{adapterName}{status?.account ? ` · QQ ${status.account}` : ''}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{stageText}</p>
            {running && <p className="mt-1 text-muted-foreground">{phaseText}</p>}
            {download && (
              <div className="mt-2 space-y-1" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={downloadPercent}>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${downloadPercent}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('adapters.openopq_download_progress', { done: toMb(download.bytes), total: toMb(download.total), percent: downloadPercent })}
                </p>
              </div>
            )}
            {detail && <p role="alert" className="mt-1 break-all text-xs text-destructive">{detail}</p>}
            {loadError && <p role="alert" className="mt-1 break-all text-xs text-destructive">{loadError}</p>}
          </div>

          {(running || starting) && !online && (
            <div className="relative mx-auto flex h-[220px] w-[220px] items-center justify-center overflow-hidden rounded-md border bg-background">
              {consoleState?.qr && phase === 'waiting' ? (
                <img src={consoleState.qr} alt={t('adapters.openopq_qr_alt')} className="h-full w-full object-contain [image-rendering:pixelated]" />
              ) : scanned ? (
                <ScanLine className="h-10 w-10 animate-pulse text-muted-foreground" />
              ) : starting || qrLoading ? (
                <div className="flex flex-col items-center gap-2 px-4 text-center text-xs text-muted-foreground" role="status">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  {starting ? t('adapters.openopq_stage_starting') : t('adapters.openopq_qr_loading')}
                </div>
              ) : (
                <QrCode className="h-16 w-16 text-muted-foreground/40" />
              )}
            </div>
          )}

          {online && (
            <div className="flex items-center justify-center gap-2 py-6 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
              <span className="text-sm font-medium">{phaseText}</span>
            </div>
          )}

          {status?.version && (
            <p className="text-center text-xs text-muted-foreground">
              {t('adapters.openopq_version')}: {status.version}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {running && online && (
            <Button type="button" variant="outline" onClick={() => void act('disconnect')} disabled={busy}
              className="text-red-600 border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-700">
              <LogOut className="mr-1.5 h-4 w-4" />{t('adapters.openopq_disconnect')}
            </Button>
          )}
          {running && (waiting || scanned) && (
            <Button type="button" variant="outline" onClick={() => void act('cancel')} disabled={busy}>
              <X className="mr-1.5 h-4 w-4" />{t('adapters.openopq_cancel')}
            </Button>
          )}
          {running && !online && !scanned && (
            <Button type="button" onClick={() => void act('login')} disabled={busy || phase === 'requesting'}>
              {phase === 'waiting' || phase === 'error' || phase === 'offline'
                ? <><RefreshCw className="mr-1.5 h-4 w-4" />{t('adapters.openopq_restart_qr')}</>
                : <><ScanLine className="mr-1.5 h-4 w-4" />{t('adapters.openopq_start')}</>}
            </Button>
          )}
          {!running && (
            <Button type="button" variant="outline" onClick={onClose}>{t('common.close')}</Button>
          )}
        </DialogFooter>
        {dlg.node}
      </DialogContent>
    </Dialog>
  );
};

export default OpenOpqLogin;
