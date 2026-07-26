import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HelpCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '@/hooks/use-toast';
import type { Adapter, AdapterFormData, AdapterType } from '@/types/adapter';
import apiClient from '@/lib/api-client';

/** Auto-correct URL to proper ws:// or wss:// format */
function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  // Already starts with ws:// or wss:// → keep
  if (/^wss?:\/\//.test(t)) return t;
  // https:// → wss://
  if (/^https:\/\//.test(t)) return t.replace(/^https/, 'wss');
  // http:// → ws://
  if (/^http:\/\//.test(t)) return t.replace(/^http/, 'ws');
  // No protocol → prepend ws://
  return 'ws://' + t;
}

const adapterFormSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(['onebot_v11', 'qq_official'] as const),
  // C#55: HTTP 是单向的、不适合使用，已移除。仅保留 正向 / 反向 WS。
  connectionMode: z.enum(['forward_ws', 'reverse_ws'] as const).optional(),
  endpoint: z.string().optional(),
  accessToken: z.string().optional(),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  qqNumber: z.string().regex(/^\d{0,12}$/, 'QQ 号只能由最多 12 位数字组成').optional(),
  enabled: z.boolean().optional().default(true),
});

type FormValues = z.infer<typeof adapterFormSchema>;
type FormMode = NonNullable<FormValues['connectionMode']>;

interface AdapterFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AdapterFormData) => Promise<void>;
  adapter?: Adapter | null;
}

export const AdapterForm: React.FC<AdapterFormProps> = ({ open, onOpenChange, onSubmit, adapter }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const isEdit = !!adapter;
  const [qr, setQr] = React.useState<{ sessionId: string; url: string } | null>(null);
  const [qrBusy, setQrBusy] = React.useState(false);
  const qrPollingRef = React.useRef(false);

  const { register, handleSubmit, setValue, watch, getValues, reset, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(adapterFormSchema),
    defaultValues: {
      name: adapter?.name ?? '',
      type: (adapter?.type as AdapterType) ?? 'onebot_v11',
      connectionMode: (adapter?.connectionMode as FormMode | undefined),   // C#54: 新增时不预选，渐进式引导
      endpoint: adapter?.endpoint ?? '',
      accessToken: adapter?.accessToken ?? '',
      appId: adapter?.appId ?? '',
      appSecret: '',
      qqNumber: adapter?.qqNumber ?? '',
      enabled: adapter?.enabled ?? true,
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: adapter?.name ?? '',
        type: (adapter?.type as AdapterType) ?? 'onebot_v11',
        connectionMode: (adapter?.connectionMode as FormMode | undefined),   // C#54: 新增时不预选，渐进式引导
        endpoint: adapter?.endpoint ?? '',
        accessToken: adapter?.accessToken ?? '',
        appId: adapter?.appId ?? '',
        appSecret: '',
        qqNumber: adapter?.qqNumber ?? '',
        enabled: adapter?.enabled ?? true,
      });
    }
  }, [open, adapter, reset]);

  React.useEffect(() => () => { qrPollingRef.current = false; }, []);

  const handleFormSubmit = async (data: FormValues) => {
    if (data.type === 'qq_official') {
      if (!data.appId?.trim() || (!isEdit && !data.appSecret?.trim())) {
        setError('appId', { message: '请输入 AppID 和 AppSecret，或使用扫码绑定。' });
        return;
      }
      data.endpoint = '';
      data.connectionMode = 'forward_ws';
      await onSubmit(data as AdapterFormData);
      onOpenChange(false);
      return;
    }
    const mode = data.connectionMode;
    if (!mode) return;
    const raw = (data.endpoint ?? '').trim();

    if (mode === 'reverse_ws') {
      // Strict port validation
      const num = parseInt(raw, 10);
      if (isNaN(num) || num < 1 || num > 65535 || !/^\d+$/.test(raw)) {
        setError('endpoint', { message: t('adapters.port_error') });
        return;
      }
      data.endpoint = String(num);
    } else {
      // URL validation + auto-correction
      const corrected = normalizeUrl(raw);
      data.endpoint = corrected;
      try {
        const url = new URL(corrected);
        if (!['ws:', 'wss:'].includes(url.protocol)) {
          setError('endpoint', { message: t('adapters.url_error') });
          return;
        }
      } catch {
        setError('endpoint', { message: t('adapters.url_error') });
        return;
      }
    }

    clearErrors('endpoint');
    await onSubmit(data as AdapterFormData);
    onOpenChange(false);
  };

  const startQrLogin = async () => {
    qrPollingRef.current = false;
    setQrBusy(true);
    try {
      const start = await apiClient.post<{ sessionId: string; url: string }>('/adapters/qq-official/qr/start');
      const session = start.data;
      setQr(session);
      qrPollingRef.current = true;
      const poll = async (): Promise<void> => {
        if (!qrPollingRef.current) return;
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        if (!qrPollingRef.current) return;
        const result = await apiClient.get<{ status: string; appId?: string; appSecret?: string }>(`/adapters/qq-official/qr/${encodeURIComponent(session.sessionId)}`);
        if (result.data.status === 'completed' && result.data.appId && result.data.appSecret) {
          setValue('appId', result.data.appId); setValue('appSecret', result.data.appSecret); qrPollingRef.current = false; setQr(null); setQrBusy(false);
          const current = getValues();
          const name = current.name.trim() || `QQ 官方机器人 ${result.data.appId}`;
          await onSubmit({ name, type: 'qq_official', connectionMode: 'forward_ws', endpoint: '', accessToken: '', appId: result.data.appId, appSecret: result.data.appSecret, enabled: current.enabled ?? true });
          toast({ title: 'QQ 官方机器人已添加，正在连接' }); onOpenChange(false); return;
        }
        if (result.data.status === 'expired') { qrPollingRef.current = false; setQr(null); setQrBusy(false); return; }
        await poll();
      };
      await poll();
    } catch (error) {
      qrPollingRef.current = false;
      const message = error instanceof Error ? error.message : '无法创建 QQ 官方机器人扫码任务。';
      setError('appId', { message });
      toast({ title: 'QQ 官方机器人扫码绑定失败', description: message, variant: 'destructive' });
      setQr(null); setQrBusy(false);
    }
  };

  const mode = watch('connectionMode');
  const type = watch('type');
  const official = type === 'qq_official';
  const isReverse = mode === 'reverse_ws';
  const modeChosen = mode === 'forward_ws' || mode === 'reverse_ws';   // C#54: gate later fields
  // Label: "连接地址" for forward/http, "端口" for reverse
  const endpointLabel = isReverse ? t('adapters.port') : t('adapters.address');
  const endpointPlaceholder = isReverse
    ? t('adapters.port_placeholder')
    : 'ws://192.168.6.245:3001';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('adapters.edit_title') : t('adapters.add_title')}</DialogTitle>
          <DialogDescription>{isEdit ? t('adapters.edit_subtitle') : t('adapters.add_subtitle')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" autoComplete="off">
          <div className="space-y-2">
            <Label htmlFor="name">{t('adapters.name')}</Label>
            <Input id="name" placeholder={t('adapters.name_placeholder')} {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">{t('adapters.type_label')}</Label>
            {/* C#55: 编辑时不允许修改适配器平台 */}
            <Select value={watch('type')} onValueChange={(v) => setValue('type', v as AdapterType)} disabled={isEdit}>
              <SelectTrigger id="type"><SelectValue placeholder={t('adapters.type_label')} /></SelectTrigger>
              <SelectContent><SelectItem value="onebot_v11">OneBot v11</SelectItem><SelectItem value="qq_official">QQ 官方机器人 2.0</SelectItem></SelectContent>
            </Select>
          </div>
          {official ? <>
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">QQ 官方机器人使用官方 Gateway WebSocket，不使用 OneBot 或 Webhook。可直接填写凭据，或扫码后自动填入。</div>
           <div className="rounded-md border p-3 space-y-2"><Button type="button" variant="outline" size="sm" onClick={startQrLogin} disabled={qrBusy}>{qrBusy ? '等待扫码中…' : '扫码绑定 QQ 官方机器人'}</Button>{qr && <><QRCodeSVG className="mx-auto h-44 w-44" value={qr.url} size={176} level="M" includeMargin aria-label="QQ 官方机器人绑定二维码" /><p className="text-xs text-muted-foreground">请使用手机 QQ 扫码；成功后会自动填入 AppID 和 AppSecret。</p></>}</div>
           <div className="space-y-2"><Label htmlFor="appId">AppID</Label><Input id="appId" autoComplete="off" {...register('appId')} />{errors.appId && <p className="text-xs text-destructive">{errors.appId.message}</p>}</div>
           <div className="space-y-2"><Label htmlFor="appSecret">AppSecret{isEdit ? '（留空保持不变）' : ''}</Label><Input id="appSecret" type="password" autoComplete="new-password" {...register('appSecret')} /></div>
           <div className="space-y-2"><Label htmlFor="qqNumber">官方机器人真实 QQ 号（可选）</Label><Input id="qqNumber" inputMode="numeric" autoComplete="off" placeholder="仅用于显示 QQ 头像，不参与官方 API 通信" {...register('qqNumber')} />{errors.qqNumber && <p className="text-xs text-destructive">{errors.qqNumber.message}</p>}</div>
          </> : <><div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="mode">{t('adapters.connection_mode')}</Label>
              {/* C#55: 正向/反向连接细节提示（鼠标悬停） */}
              <span title={`${t('adapters.mode_forward_hint')}\n\n${t('adapters.mode_reverse_hint')}`} className="inline-flex cursor-help text-muted-foreground">
                <HelpCircle className="h-3.5 w-3.5" />
              </span>
            </div>
            <Select value={mode ?? ''} onValueChange={(v) => setValue('connectionMode', v as FormMode)}>
              <SelectTrigger id="mode"><SelectValue placeholder={t('adapters.choose_mode')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="forward_ws">{t('adapters.mode_forward_ws')}</SelectItem>
                <SelectItem value="reverse_ws">{t('adapters.mode_reverse_ws')}</SelectItem>
              </SelectContent>
            </Select>
            {modeChosen && (
              <p className="text-xs text-muted-foreground">{isReverse ? t('adapters.mode_reverse_hint') : t('adapters.mode_forward_hint')}</p>
            )}
          </div>
          {/* C#54: 选完连接方式后才出现连接地址等信息，渐进式引导 */}
          {modeChosen && (
            <>
              <div className="space-y-2">
                <Label htmlFor="endpoint">{endpointLabel}</Label>
                <Input
                  id="endpoint"
                  placeholder={endpointPlaceholder}
                  inputMode={isReverse ? 'numeric' : 'url'}
                  autoComplete="off"
                  {...register('endpoint')}
                />
                {errors.endpoint && <p className="text-xs text-destructive">{errors.endpoint.message}</p>}
                {isReverse && <p className="text-xs text-muted-foreground">{t('adapters.reverse_hint')}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="accessToken">{t('adapters.access_token')}</Label>
                <Input id="accessToken" type="password" autoComplete="new-password" placeholder={t('adapters.token_placeholder')} {...register('accessToken')} />
              </div>
            </>
          )}
          </>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={isSubmitting || (!official && !modeChosen)}>{isSubmitting ? t('common.saving') : isEdit ? t('adapters.save_edit') : t('adapters.add')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
export default AdapterForm;
