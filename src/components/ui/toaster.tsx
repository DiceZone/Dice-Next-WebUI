import { Toaster as SonnerToaster } from 'sonner';
import { useTranslation } from 'react-i18next';
import { zustandAppStore } from '@/store/app-store';

export function Toaster() {
  const { t } = useTranslation();
  const theme = zustandAppStore((state) => state.theme);
  return <SonnerToaster theme={theme} position="bottom-right" closeButton richColors visibleToasts={4}
    offset={16} mobileOffset={16} containerAriaLabel={t('nav.notice')}
    toastOptions={{ closeButtonAriaLabel: t('common.close'),
      classNames: { toast: 'font-sans [overflow-wrap:anywhere]', description: 'whitespace-pre-wrap' } }} />;
}
