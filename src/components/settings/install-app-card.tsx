import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppWindow, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FeatureHelp } from '@/components/ui/feature-help';
import { useToast } from '@/hooks/use-toast';
import { installState, isStandalone, pendingInstallPrompt, promptInstall, subscribeInstallPrompt } from '@/lib/pwa-install';

const environment = () => ({
  standalone: isStandalone(),
  secureContext: typeof window !== 'undefined' && window.isSecureContext,
  userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
  maxTouchPoints: typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints || 0,
  hasPrompt: !!pendingInstallPrompt(),
});

export function InstallAppCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const [state, setState] = React.useState(() => installState(environment()));
  React.useEffect(() => subscribeInstallPrompt(() => setState(installState(environment()))), []);
  const install = async () => {
    const outcome = await promptInstall();
    setState(installState(environment()));
    if (outcome === 'accepted') toast({ title: t('pwa.installed_toast') });
  };
  return <Card data-setting-anchor="webui-install">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base"><AppWindow className="h-4 w-4" />{t('pwa.title')}
        <FeatureHelp title={t('pwa.title')} description={<><p>{t('pwa.help')}</p><p>{t('pwa.help_https')}</p></>} />
      </CardTitle>
      <CardDescription>{t('pwa.desc')}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3 text-sm">
      {state === 'ready' && <Button size="sm" onClick={() => void install()}><Download className="mr-1.5 h-3.5 w-3.5" />{t('pwa.install')}</Button>}
      <p role="status" data-install-state={state}
        className={state === 'insecure' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>{t(`pwa.state_${state}`)}</p>
    </CardContent>
  </Card>;
}
