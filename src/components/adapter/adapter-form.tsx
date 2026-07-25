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
import type { Adapter, AdapterFormData, AdapterType } from '@/types/adapter';

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
  type: z.enum(['onebot_v11'] as const),
  // C#55: HTTP 是单向的、不适合使用，已移除。仅保留 正向 / 反向 WS。
  connectionMode: z.enum(['forward_ws', 'reverse_ws'] as const),
  endpoint: z.string().min(1),
  accessToken: z.string().optional(),
  enabled: z.boolean().optional().default(true),
});

type FormValues = z.infer<typeof adapterFormSchema>;
type FormMode = FormValues['connectionMode'];   // 'forward_ws' | 'reverse_ws'

interface AdapterFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AdapterFormData) => Promise<void>;
  adapter?: Adapter | null;
}

export const AdapterForm: React.FC<AdapterFormProps> = ({ open, onOpenChange, onSubmit, adapter }) => {
  const { t } = useTranslation();
  const isEdit = !!adapter;

  const { register, handleSubmit, setValue, watch, reset, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(adapterFormSchema),
    defaultValues: {
      name: adapter?.name ?? '',
      type: (adapter?.type as AdapterType) ?? 'onebot_v11',
      connectionMode: (adapter?.connectionMode as FormMode | undefined),   // C#54: 新增时不预选，渐进式引导
      endpoint: adapter?.endpoint ?? '',
      accessToken: adapter?.accessToken ?? '',
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
        enabled: adapter?.enabled ?? true,
      });
    }
  }, [open, adapter, reset]);

  const handleFormSubmit = async (data: FormValues) => {
    const mode = data.connectionMode;
    const raw = data.endpoint.trim();

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

  const mode = watch('connectionMode');
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
              <SelectContent><SelectItem value="onebot_v11">OneBot v11</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={isSubmitting || !modeChosen}>{isSubmitting ? t('common.saving') : isEdit ? t('adapters.save_edit') : t('adapters.add')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
export default AdapterForm;
