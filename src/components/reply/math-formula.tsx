import { lazy, Suspense } from 'react';

const Formula = lazy(async () => {
  const [{ default: katex }] = await Promise.all([
    import('katex'),
    import('katex/dist/katex.min.css'),
  ]);
  return { default: ({ text }: { text: string }) => {
    try {
      const markup = katex.renderToString(text, {
        // MathML-only output relies on browser support for menclose, sizing and
        // fonts. KaTeX HTML + its bundled CSS renders boxes consistently too.
        output: 'htmlAndMathml', throwOnError: true, strict: 'ignore', trust: false,
        maxExpand: 100, maxSize: 10,
      });
      return <span data-math-preview className="inline-block max-w-full overflow-x-auto align-middle" dangerouslySetInnerHTML={{ __html: markup }} />;
    } catch {
      return <code className="break-all text-destructive">{text}</code>;
    }
  } };
});
export function MathFormula({ text }: { text: string }) {
  return <Suspense fallback={<span className="inline-block h-4 w-24 animate-pulse rounded bg-muted" />}><Formula text={text} /></Suspense>;
}
