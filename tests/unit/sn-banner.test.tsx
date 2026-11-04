import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownExample } from '../../src/components/reply/markdown-example';
import {
  SnBannerPreview,
  validSnTemplate,
  SN_FORMULA_EXAMPLE,
  normalizeSnColor,
  validSnColor,
} from '../../src/components/settings/sn-banner-preview';

describe('SN status presentation', () => {
  it('previews quotes, plain text and hidden status without changing the reply', () => {
    const props = { sample: '希亚 SAN50 HP0/0 DEX0', reply: 'D100=50', template: '> {sn}' };
    const view = render(<SnBannerPreview {...props} mode="quote" />);
    expect(screen.getByText(props.sample).tagName).toBe('BLOCKQUOTE');
    view.rerender(<SnBannerPreview {...props} mode="plain" />);
    expect(screen.getByText(props.sample).tagName).toBe('P');
    view.rerender(<SnBannerPreview {...props} mode="off" />);
    expect(screen.queryByText(props.sample)).not.toBeInTheDocument();
    expect(screen.getByText(props.reply)).toBeVisible();
  });

  it('renders the custom formula as MathML, with red small text and no raw placeholder', async () => {
    const view = render(
      <SnBannerPreview mode="custom" template={SN_FORMULA_EXAMPLE} sample="希亚 SAN50" reply="D100=50" />,
    );
    const math = await screen.findByRole('math');
    expect(math).toHaveTextContent('希亚');
    expect(math.querySelector('[mathcolor="#E5484D"]')).not.toBeNull();
    expect(math.querySelector('[mathsize="0.7em"]')).not.toBeNull();
    expect(view.container.textContent).not.toContain('{sn_tex}');
  });

  it('colors the small status line with a validated #RRGGBB value only', () => {
    const props = { sample: '希亚 SAN50', reply: 'D100=50', template: '> {sn}' };
    const view = render(<SnBannerPreview {...props} mode="small_red" color="#0090ff" />);
    expect(screen.getByText(props.sample)).toHaveStyle({ color: 'rgb(0, 144, 255)' });
    view.rerender(<SnBannerPreview {...props} mode="small_red" color="red;background:url(x)" />);
    expect(screen.getByText(props.sample)).toHaveStyle({ color: 'rgb(229, 72, 77)' });
    expect(validSnColor('#30A46C')).toBe(true);
    expect(validSnColor('30A46C')).toBe(false);
    expect(normalizeSnColor('#30a46c')).toBe('#30A46C');
    expect(normalizeSnColor(undefined)).toBe('#E5484D');
  });

  it('rejects missing placeholders and measures UTF-8 bytes instead of character count', () => {
    expect(validSnTemplate('**{sn}**')).toBe(true);
    expect(validSnTemplate(SN_FORMULA_EXAMPLE)).toBe(true);
    expect(validSnTemplate('{nick}')).toBe(false);
    expect(validSnTemplate('字'.repeat(681) + '{sn}')).toBe(true);
    expect(validSnTemplate('字'.repeat(682) + '{sn}')).toBe(false);
  });

  it('collapses oversized repeated status placeholders to one readable line', () => {
    const sample = '希亚 SAN50 HP0/0 DEX0';
    render(<SnBannerPreview mode="custom" template={'{sn}'.repeat(300)} sample={sample} reply="D100=50" />);
    expect(screen.getByTestId('sn-banner-preview')).toHaveTextContent(`${sample}D100=50`);
    expect(screen.getAllByText(sample)).toHaveLength(1);
  });

  it('never turns custom preview links into executable URLs', () => {
    render(<MarkdownExample enabled text="[bad](javascript:alert%281%29) [ok](https://example.test)" />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://example.test');
  });
});
