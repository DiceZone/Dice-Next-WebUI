import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './use-toast';
import { confirmPageLeave } from '@/lib/navigation-guard';
import { logoutPanel } from '@/lib/panel-session';

export function usePanelLogout() {
  const { t } = useTranslation();
  const toast = useToast();
  const active = useRef(false);
  const [busy, setBusy] = useState(false);
  const logout = async () => {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    try {
      if (await confirmPageLeave()) await logoutPanel();
    } catch {
      toast({ title: t('settings.logout_failed'), variant: 'destructive' });
    } finally {
      active.current = false;
      setBusy(false);
    }
  };
  return { logout, busy };
}
