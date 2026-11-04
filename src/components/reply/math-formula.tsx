import { lazy, Suspense } from 'react';

const Formula = lazy(async () => {
  const { default: katex } = await import('katex');
  return { default: ({ text }: { text: string }) => {
    try {
      const markup = katex.renderToString(text, {
        output: 'mathml', throwOnError: true, strict: 'ignore', trust: false,
        maxExpand: 100, maxSize: 10,
      });
      return <span data-math-preview dangerouslySetInnerHTML={{ __html: markup }} />;
    } catch {
      return <code className="break-all text-destructive">{text}</code>;
    }
  } };
});
export function MathFormula({ text }: { text: string }) {
  return <Suspense fallback={<span className="inline-block h-4 w-24 animate-pulse rounded bg-muted" />}><Formula text={text} /></Suspense>;
}
