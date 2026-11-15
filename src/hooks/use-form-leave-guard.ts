import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useTourActive, useTourState } from '@/components/onboarding/tour-data';
import { useDialogs } from './use-dialogs';
import { useUnsavedChanges } from './use-unsaved-changes';

/** Use edit for input changes and accept for values confirmed by the server. */
export function useSettingsDraft<T>(initial: T, example: T) {
  const [value, edit] = useTourState(initial, example);
  const [saved, setSaved] = useState(initial);
  const accept = (next: T) => { setSaved(next); edit(next); };
  return [value, edit, accept, JSON.stringify(value) !== JSON.stringify(saved)] as const;
}

export function useFormLeaveGuard(dirty: boolean, saving: boolean, discard?: () => void) {
  const { t } = useTranslation();
  const dialogs = useDialogs(t);
  const tour = useTourActive();
  const confirmDiscard = () => dialogs.confirm({
    title: t('ui_refresh.discard'), description: t('common.unsaved_leave_hint'),
    cancelText: t('ui_refresh.keep_editing'), confirmText: t('ui_refresh.discard_edits'), destructive: true,
  });
  useUnsavedChanges(!tour && (dirty || saving), async () => !saving && (!dirty || await confirmDiscard()), discard);
  return { node: dialogs.node, confirmDiscard };
}
