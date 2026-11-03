import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CleanupSettingsCard } from '../../src/components/settings/cleanup-settings-card';
import apiClient from '../../src/lib/api-client';
import english from '../../src/i18n/locales/en.json';

afterEach(() => vi.restoreAllMocks());
const settings = {
  days: 0,
  groupDays: 0,
  userRecordDays: 180,
  groupRecordDays: 90,
  groupLimit: 20,
  maxGroupSize: 0,
};
async function mount() {
  const i18n = createInstance();
  await i18n.init({ lng: 'en', resources: { en: { translation: english } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <CleanupSettingsCard />
    </I18nextProvider>,
  );
}
describe('Cleanup settings', () => {
  it('keeps imported retention separate from platform actions and saves all fields', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: settings } as any);
    const put = vi.spyOn(apiClient, 'put').mockImplementation(async (_, body) => ({ data: body }) as any);
    await mount();
    const group = await screen.findByLabelText(english.friendclean.group_days);
    expect(group).toHaveValue(0);
    expect(screen.getByLabelText(english.friendclean.user_record_days)).toHaveValue(180);
    expect(screen.getByLabelText(english.friendclean.group_record_days)).toHaveValue(90);
    fireEvent.change(group, { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: english.common.save, exact: true }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/system/friend-clean', { ...settings, groupDays: 60 }),
    );
    expect(screen.getByLabelText(english.friendclean.days)).toHaveValue(0);
  });
  it('does not save blank, fractional or out-of-range input', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: settings } as any);
    const put = vi.spyOn(apiClient, 'put');
    await mount();
    const input = await screen.findByLabelText(english.friendclean.group_days);
    for (const value of ['', '-1', '1.5', '3651']) {
      fireEvent.change(input, { target: { value } });
      expect(screen.getByRole('button', { name: english.common.save, exact: true })).toBeDisabled();
    }
    expect(put).not.toHaveBeenCalled();
  });
  it('shows load errors and retries without presenting zeroes as saved settings', async () => {
    const get = vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('offline'));
    await mount();
    expect(await screen.findByRole('alert')).toHaveTextContent(english.common.load_fail);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    get.mockResolvedValue({ data: settings } as any);
    fireEvent.click(screen.getByRole('button', { name: english.common.retry }));
    expect(await screen.findByLabelText(english.friendclean.group_record_days)).toHaveValue(90);
  });
});
