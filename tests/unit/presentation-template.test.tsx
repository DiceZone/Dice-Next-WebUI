import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import {
  presentationComponents,
  replaceComponent,
  variablesOutsidePresentation,
} from '../../src/lib/presentation-template';
import { PresentationTemplateEditor } from '../../src/components/reply/presentation-template-editor';
import { MarkdownExample } from '../../src/components/reply/markdown-example';
import { visualEditorCopy } from '../../src/i18n/visual-editor';

describe('Editable presentation components', () => {
  it('edits only the chosen component inside nested sample text', () => {
    const text = '{sample:正文A [[action:重投|/rc 力量-20]]|正文B [[action:看卡|.pc show]]}';
    const parts = presentationComponents(text);
    expect(parts).toHaveLength(2);
    const edited = replaceComponent(text, parts[0], ['重试', '/rc 力量-10']);
    expect(edited).toBe('{sample:正文A [[action:重试|/rc 力量-10]]|正文B [[action:看卡|.pc show]]}');
    expect(replaceComponent(text, parts[1], null)).toBe('{sample:正文A [[action:重投|/rc 力量-20]]|正文B }');
  });
  it('separates TeX groups from template variables', () => {
    const text = String.raw`[[math:\textcolor{red}{\frac{ {{roll}} }{ {{rate}} }}|{roll}/{rate}]] [[bar:HP|{hp}|{hpmax}]]`;
    expect(variablesOutsidePresentation(text)).toEqual(['roll', 'rate', 'roll', 'rate']);
  });
  it('can change prose, edit an existing button, and add or remove components without losing text', async () => {
    const i18n = createInstance();
    await i18n.init({
      lng: 'en',
      resources: { en: { translation: { visual_editor: visualEditorCopy.en } } },
    });
    function Editor() {
      const [text, setText] = useState('My roll\n[[action:Again|.r]]');
      return (
        <>
          <textarea aria-label="Source" value={text} onChange={(event) => setText(event.target.value)} />
          <PresentationTemplateEditor text={text} onChange={setText} />
        </>
      );
    }
    render(
      <I18nextProvider i18n={i18n}>
        <Editor />
      </I18nextProvider>,
    );
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Source'));
    await user.type(screen.getByLabelText('Source'), 'Edited roll\n[[[[action:Again|.r]]');
    await user.clear(screen.getByLabelText('Command to fill 1'));
    await user.type(screen.getByLabelText('Command to fill 1'), '/rc 力量-20');
    expect(screen.getByLabelText('Source')).toHaveValue('Edited roll\n[[action:Again|/rc 力量-20]]');
    await user.click(screen.getByRole('button', { name: 'Add formula' }));
    expect((screen.getByLabelText('Source') as HTMLTextAreaElement).value).toContain('[[math:');
    await user.click(screen.getByRole('button', { name: 'Remove component 1' }));
    expect((screen.getByLabelText('Source') as HTMLTextAreaElement).value).toContain('Edited roll');
    expect((screen.getByLabelText('Source') as HTMLTextAreaElement).value).not.toContain('[[action:');
  });
  it('previews formulas using bounded, untrusted TeX rendering', async () => {
    const { container } = render(<MarkdownExample enabled text={String.raw`Result $\frac{42}{60}$`} />);
    await screen.findByText('42');
    expect(container.querySelector('math')).not.toBeNull();
  });
});
