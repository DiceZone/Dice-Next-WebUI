import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import {
  VariableTextarea,
  replyVariables,
  captureVariables,
} from '../../src/components/reply/variable-picker';
import { describedVariables, variableDescription } from '../../src/lib/variable-description';
import { visualEditorCopy } from '../../src/i18n/visual-editor';
import { webhookVariables } from '../../src/lib/notice-rules';
import en from '../../src/i18n/locales/en.json';
import hans from '../../src/i18n/locales/zh-Hans.json';
import hant from '../../src/i18n/locales/zh-Hant.json';
import ja from '../../src/i18n/locales/ja.json';

const locales = { en, 'zh-Hans': hans, 'zh-Hant': hant, ja };
async function instance(locale: keyof typeof locales = 'en') {
  const i18n = createInstance();
  await i18n.init({
    lng: locale,
    resources: {
      [locale]: {
        translation: {
          ...locales[locale],
          visual_editor: visualEditorCopy[locale],
        },
      },
    },
  });
  return i18n;
}

describe('Variable help', () => {
  it.each(Object.keys(locales) as (keyof typeof locales)[])(
    'describes built-in options in %s, including math and webhook contexts',
    async (locale) => {
      const { t } = await instance(locale);
      const unknown = t('visual_editor.variables.unknown');
      const options = [
        ...replyVariables,
        ...captureVariables([{ type: 'regex', content: '(a)(b)' }]),
        ...['hp', 'hpmax', 'mp', 'mpmax', 'san', 'sanmax', 'dex'].map((name) => ({
          token: '{' + name + '}',
        })),
      ];
      for (const option of [
        ...options,
        ...options.map((v) => ({ ...v, token: '{' + v.token + '}' })),
        ...webhookVariables.map((name) => ({
          token: '{{' + name + '}}',
          descriptionKey: name === 'time' ? ('noticeTime' as const) : name,
        })),
      ]) {
        const description = variableDescription(option, t);
        expect(description, option.token).toBeTruthy();
        expect(description, option.token).not.toBe(unknown);
        expect(description, option.token).not.toMatch(/^(commands|visual_editor)\./);
      }
    },
  );

  it('preserves command-specific descriptions even when later options have generic help', async () => {
    const { t } = await instance();
    expect(
      describedVariables(
        [
          { token: '{san}' },
          { token: '{san}', description: 'SAN before this check' },
          { token: '{san}', descriptionKey: 'san' },
          { token: '{san}' },
        ],
        t,
      ),
    ).toEqual([['{san}', 'SAN before this check']]);
    expect(variableDescription({ token: '{custom_plugin_value}' }, t)).toBe(
      t('visual_editor.variables.unknown'),
    );
    expect(variableDescription({ token: '{my_deck}', descriptionKey: 'deck' }, t)).toBe(
      t('visual_editor.variables.deck'),
    );
    expect(variableDescription({ token: '{{time}}', descriptionKey: 'noticeTime' }, t)).not.toBe(
      variableDescription({ token: '{{time}}' }, t),
    );
  });

  it('searches descriptions and inserts the original token at the selection', async () => {
    const i18n = await instance();
    function Editor() {
      const [value, setValue] = useState('Before AFTER end');
      return (
        <VariableTextarea
          aria-label="Reply"
          value={value}
          onValueChange={setValue}
          options={replyVariables}
        />
      );
    }
    render(
      <I18nextProvider i18n={i18n}>
        <Editor />
      </I18nextProvider>,
    );
    const user = userEvent.setup();
    const field = screen.getByLabelText('Reply') as HTMLTextAreaElement;
    field.focus();
    field.setSelectionRange(7, 12);
    await user.click(screen.getByRole('button', { name: 'Insert variable' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search variables' }), 'equal probability');
    await user.click(screen.getByRole('button', { name: /\{sample:A\|B\}/ }));
    expect(field).toHaveValue('Before {sample:A|B} end');
    expect(field).toHaveFocus();
    expect(field.selectionStart).toBe(19);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
