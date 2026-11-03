import { lazy, Suspense } from 'react';
import { MarkdownExample } from '@/components/reply/markdown-example';

export type SnBannerStyle = 'small_red' | 'quote' | 'plain' | 'custom' | 'off';
export const snBannerStyles: SnBannerStyle[] = ['small_red', 'quote', 'plain', 'custom', 'off'];
export const normalizeSnStyle = (value: unknown): SnBannerStyle =>
  snBannerStyles.includes(value as SnBannerStyle) ? value as SnBannerStyle : 'small_red';
export const validSnTemplate = (value: string) =>
  new TextEncoder().encode(value).length <= 2048 && /\{sn(?:_tex)?\}/.test(value);
export const SN_FORMULA_EXAMPLE = '$\\scriptsize\\textcolor{#E5484D}{\\text{{sn_tex}}}$';

// Loaded only for custom formulas. MathML uses browser fonts, without loading
// KaTeX's full font bundle; trust=false rejects HTML, links and external images.
const Formula = lazy(async () => {
  const { default: katex } = await import('katex');
  return { default: ({ text }: { text: string }) => {
    try {
      const markup = katex.renderToString(text, {
        output: 'mathml', throwOnError: true, strict: 'ignore', trust: false,
        maxExpand: 100, maxSize: 10,
      });
      return <span dangerouslySetInnerHTML={{ __html: markup }} />;
    } catch {
      return <code className="break-all text-destructive">{text}</code>;
    }
  } };
});

function CustomPreview({ text }: { text: string }) {
  // Only unescaped $ delimit a formula. This is an appearance preview of the
  // documented Markdown subset, not an HTML interpreter or QQ action executor.
  const parts = text.split(/(?<!\\)\$([^$\n]+)(?<!\\)\$/g);
  return <div className="space-y-1 break-words">{parts.map((part, index) => index % 2
    ? <Suspense key={index} fallback={<span className="inline-block h-4 w-32 animate-pulse rounded bg-muted" />}>
        <Formula text={part} />
      </Suspense>
    : part && <MarkdownExample key={index} text={part} enabled />)}</div>;
}

export function SnBannerPreview({ mode, template, sample, reply }: {
  mode: SnBannerStyle; template: string; sample: string; reply: string;
}) {
  // The preview sample is a fixed localized string without markup characters.
  // Replacing once also ensures inserted placeholder-looking text isn't evaluated.
  const expanded = template.replace(/\{sn(?:_tex)?\}/g, () => sample);
  const custom = new TextEncoder().encode(expanded).length > 3000 ? sample : expanded;
  return <div data-testid="sn-banner-preview" className="space-y-3 rounded-lg border bg-background p-4 text-sm">
    {mode === 'small_red' && <p className="text-[11px] text-[#E5484D]">{sample}</p>}
    {mode === 'quote' && <blockquote className="border-l-2 border-muted-foreground/40 pl-3 text-muted-foreground">{sample}</blockquote>}
    {mode === 'plain' && <p>{sample}</p>}
    {mode === 'custom' && <CustomPreview text={custom} />}
    <p>{reply}</p>
  </div>;
}
