import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import { AdapterForm } from '../../src/components/adapter/adapter-form';
import type { Adapter } from '../../src/types/adapter';
import english from '../../src/i18n/locales/en.json';

const adapter: Adapter = {
  id: 'fixture',
  name: 'Test bot',
  type: 'onebot_v11',
  connectionMode: 'reverse_ws',
  endpoint: '18089',
  enabled: true,
  status: 'connected',
  createdAt: '',
  heartApiKeyConfigured: true,
};

async function editor(submit = vi.fn(async () => {}), fixture: Adapter = adapter) {
  const i18n = createInstance();
  await i18n.init({ lng: 'en', resources: { en: { translation: english } } });
  const close = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <AdapterForm open adapter={fixture} onOpenChange={close} onSubmit={submit} />
    </I18nextProvider>,
  );
  return {
    submit,
    close,
    user: userEvent.setup(),
    save: screen.getByRole('button', { name: english.adapters.save_edit }),
  };
}

describe('Adapter editor', () => {
  it.each(['onebot_v11', 'milky', 'qq_official', 'discord', 'kook'] as const)(
    'saves %s with the empty OpenOPQ transport returned by the API',
    async (type) => {
      const { user, save, submit, close } = await editor(
        vi.fn(async () => {}),
        {
          ...adapter,
          type,
          openopqTransport: '' as Adapter['openopqTransport'],
          appId: '123456',
          qqReceiveMode: 'webhook',
          endpoint: type === 'milky' ? 'http://localhost:3000' : adapter.endpoint,
          eventEndpoint: 'ws://localhost:3000/event',
          qqRichReplies: 'off',
          qqInteractions: 'links',
          subscribeGroupMemberEvents: false,
          autoAcknowledgeInteractions: false,
        },
      );
      await user.click(save);
      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
      expect(close).toHaveBeenCalledWith(false);
      if (type === 'qq_official') {
        expect(screen.getByRole('alert')).toHaveTextContent(english.adapters.webhook_public_required);
        expect(submit.mock.calls[0][0]).toMatchObject({
          qqReceiveMode: 'webhook',
          qqRichReplies: 'off',
          qqInteractions: 'links',
          subscribeGroupMemberEvents: false,
          autoAcknowledgeInteractions: false,
        });
        expect(submit.mock.calls[0][0]).not.toHaveProperty('qqNumber');
        expect(submit.mock.calls[0][0]).not.toHaveProperty('appSecret');
      }
    },
  );
  it('keeps advanced settings collapsed and switches between credentials and a square QR area', async () => {
    const { user, save, submit } = await editor(
      vi.fn(async () => {}),
      { ...adapter, type: 'qq_official', appId: '123456' },
    );
    expect(screen.queryByRole('switch', { name: /./ })).not.toHaveAttribute('id', 'forceVerifyImageResource');
    const advanced = screen.getByRole('button', { name: english.adapters.advanced_options });
    expect(advanced).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('qqNumber')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: english.adapters.qr_switch }));
    expect(screen.queryByLabelText('AppID')).not.toBeInTheDocument();
    expect(document.querySelector('.aspect-square')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Manually enter/ }));
    expect(screen.getByLabelText('AppID')).toHaveValue('123456');
    await user.click(advanced);
    expect(advanced).toHaveAttribute('aria-expanded', 'true');
    await user.click(save);
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({
      qqRichReplies: 'markdown',
      qqInteractions: 'buttons',
      subscribeGroupMemberEvents: true,
      autoAcknowledgeInteractions: true,
    });
  });
  it('submits defaults without clearing an existing private key', async () => {
    const { user, save, submit, close } = await editor();
    await user.click(save);
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({
      name: 'Test bot',
      endpoint: '18089',
      connectionMode: 'reverse_ws',
      enabled: true,
      autoAcknowledgeInteractions: true,
    });
    expect(submit.mock.calls[0][0]).not.toHaveProperty('heartApiKey');
    expect(close).toHaveBeenCalledWith(false);
  });
  it('links schema validation to the field and never sends an invalid name', async () => {
    const { user, save, submit } = await editor();
    const name = screen.getByRole('textbox', { name: english.adapters.name });
    await user.clear(name);
    await user.click(save);
    await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'));
    expect(submit).not.toHaveBeenCalled();
    expect(
      document.getElementById(name.getAttribute('aria-describedby')!.split(' ').at(-1)!),
    ).toHaveTextContent(/.+/);
  });
  it('keeps the draft open and editable when a save fails', async () => {
    const submit = vi.fn(async () => {
      throw new Error('Server rejected fixture');
    });
    const { user, save, close } = await editor(submit);
    const name = screen.getByRole('textbox', { name: english.adapters.name });
    await user.clear(name);
    await user.type(name, 'My new name');
    await user.click(save);
    expect(await screen.findByRole('alert')).toHaveTextContent('Server rejected fixture');
    expect(close).not.toHaveBeenCalled();
    expect(name).toHaveValue('My new name');
    expect(name).toBeEnabled();
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
