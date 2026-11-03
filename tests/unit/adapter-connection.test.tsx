import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import { adapterConnectionKey, officialWebhookUrl } from '../../src/lib/adapter-connection';
import { AdapterCard } from '../../src/components/adapter/adapter-card';
import type { Adapter } from '../../src/types/adapter';
import english from '../../src/i18n/locales/en.json';

const official: Adapter = {
  id: 'qq1',
  name: 'Official webhook bot',
  type: 'qq_official',
  connectionMode: 'forward_ws',
  endpoint: '',
  appId: '123456',
  qqReceiveMode: 'webhook',
  enabled: true,
  status: 'connected',
  createdAt: '',
};
describe('Adapter connection details', () => {
  it.each([
    ['https://dice.example/#/adapters', 'https://dice.example/qq-official/webhook'],
    ['https://dice.example/bot/index.html?x=1#/adapters', 'https://dice.example/bot/qq-official/webhook'],
    ['http://localhost:18088/bot/', 'http://localhost:18088/bot/qq-official/webhook'],
    ['https://user:secret@dice.example/dice', 'https://dice.example/dice/qq-official/webhook'],
  ])('builds a callback from %s without leaking URL state', (base, expected) => {
    expect(officialWebhookUrl(base)).toBe(expected);
  });
  it('uses the official receive mode and distinguishes forward/reverse transports', () => {
    expect(adapterConnectionKey(official)).toBe('adapters.transport_webhook');
    expect(adapterConnectionKey({ ...official, qqReceiveMode: 'gateway' })).toBe(
      'adapters.transport_websocket',
    );
    expect(adapterConnectionKey({ ...official, type: 'onebot_v11', connectionMode: 'reverse_ws' })).toBe(
      'adapters.mode_reverse_ws',
    );
    expect(adapterConnectionKey({ ...official, type: 'milky' })).toBe('adapters.mode_forward_ws');
    expect(adapterConnectionKey({ ...official, type: 'openopq', openopqTransport: 'reverse_ws' })).toBe(
      'adapters.mode_reverse_ws',
    );
  });
  it('shows Webhook on the card and offers a copyable callback in the connection dialog', async () => {
    const i18n = createInstance();
    await i18n.init({ lng: 'en', resources: { en: { translation: english } } });
    const user = userEvent.setup();
    render(
      <I18nextProvider i18n={i18n}>
        <AdapterCard
          adapter={official}
          onConnect={vi.fn()}
          onDisconnect={vi.fn()}
          onReconnect={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onTestConnection={vi.fn()}
        />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('adapter-card')).toHaveTextContent('Webhook');
    expect(screen.getByTestId('adapter-card')).not.toHaveTextContent('Gateway');
    await user.click(screen.getByRole('button', { name: english.adapters.reverse_btn }));
    const address = screen.getByTestId('webhook-url').textContent!;
    expect(address).toBe(officialWebhookUrl(document.baseURI));
    await user.click(screen.getByRole('button', { name: english.adapters.copy_callback }));
    expect(await navigator.clipboard.readText()).toBe(address);
  });
});
