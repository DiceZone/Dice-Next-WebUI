export const formulaPresets = [
  { id: 'color', formula: String.raw`\textcolor{#E5484D}{ {{nick}} }`, fallback: '{nick}', variables: ['nick'] },
  { id: 'gothic', formula: String.raw`\textcolor{red}{\Large{\mathfrak{Hastur\ is\ watching\ you.}}}`, fallback: 'Hastur is watching you.', variables: [] },
  { id: 'check', formula: String.raw`\boxed{\overset{\huge\mathsf{d100=\textcolor{red}{ {{res}} }/ {{san}} }}{ {{grade}} }}`, fallback: 'D100={res}/{san} {grade}', variables: ['res', 'san', 'grade'] },
  { id: 'sanity', formula: String.raw`\textcolor{#E5484D}{\mathsf{SAN}\quad {{san}} \rightarrow {{final}} \quad (-{{loss}})}`, fallback: 'SAN {san} → {final} (-{loss})', variables: ['san', 'final', 'loss'] },
  { id: 'custom', formula: String.raw`\frac{1}{2}`, fallback: '1/2', variables: [] },
] as const;

// Illustrative values only: runtime rendering and variable validation stay on the server.
export function formulaIllustration(formula: string) {
  const values: Record<string, string> = { nick: String.raw`\text{Alice}`, res: '48', san: '44', grade: String.raw`\text{Failure}`, final: '43', loss: '1' };
  return formula.replace(/\{\{([^{}]+)\}\}/g, (whole, key: string) => values[key] ?? whole);
}
