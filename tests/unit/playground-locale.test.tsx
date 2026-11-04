import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaygroundPage, panelReplyLocale } from '../../src/pages/playground-page';
import english from '../../src/i18n/locales/en.json';
import japanese from '../../src/i18n/locales/ja.json';

afterEach(() => vi.restoreAllMocks());

async function mount(lng: 'en' | 'ja') {
  const i18n = createInstance();
  await i18n.init({ lng, resources: { en: { translation: english }, ja: { translation: japanese } } });
  render(
    <I18nextProvider i18n={i18n}>
      <PlaygroundPage />
    </I18nextProvider>,
  );
  return i18n;
}

describe('Playground reply language', () => {
  it('sends the panel language by default and follows a later language switch', async () => {
    window.HTMLElement.prototype.scrollTo = () => {};
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ reply: 'ok' }), { headers: { 'Content-Type': 'application/json' } }),
      );
    const i18n = await mount('en');
    const input = screen.getByPlaceholderText(english.playground.input_placeholder);
    fireEvent.change(input, { target: { value: '.r' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).locale).toBe('en');
    await i18n.changeLanguage('ja');
    await screen.findByText('ok');
    const jaInput = screen.getByPlaceholderText(japanese.playground.input_placeholder);
    fireEvent.change(jaInput, { target: { value: '.r' } });
    fireEvent.keyDown(jaInput, { key: 'Enter' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).locale).toBe('ja');
  });

  it('maps unknown panel languages to the platform default', () => {
    expect(panelReplyLocale('zh-Hant')).toBe('zh-Hant');
    expect(panelReplyLocale('fr')).toBe('');
    expect(panelReplyLocale(undefined)).toBe('');
  });
});
