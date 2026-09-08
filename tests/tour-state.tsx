// Browser regression test without another testing dependency. Served only by
// the development server; not imported by the application or production build.
import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { TourDataContext, useTourState } from '../src/components/onboarding/tour-data';

const container = document.querySelector('#probe')!;
const root = createRoot(container);
let setDraft: React.Dispatch<React.SetStateAction<string>>;
const results: string[] = [];
function Probe() {
  const [draft, set] = useTourState('live', 'sample');
  setDraft = set;
  useEffect(() => { if (draft === 'sample') set('sample-derived value'); }, [draft, set]);
  return <output>{draft}</output>;
}
async function render(active: boolean) {
  await act(async () => { root.render(<TourDataContext.Provider value={active}><Probe /></TourDataContext.Provider>); });
}
function check(expected: string, message: string) {
  if (container.textContent !== expected) throw Error(`${message}: got ${container.textContent}, expected ${expected}`);
  results.push(`PASS: ${message}`);
}
try {
  await render(false);
  check('live', 'live values are the default');
  await act(async () => setDraft('unsaved draft'));
  const completeLiveRequest = setDraft;
  await render(true);
  check('sample', 'tutorial renders samples');
  await act(async () => setDraft('must not persist'));
  check('sample', 'sample-mode setters cannot change the projection');
  await render(false);
  check('unsaved draft', 'exit restores the draft, ignoring sample-derived effects');
  await render(true);
  await act(async () => completeLiveRequest('live response during tutorial'));
  check('sample', 'late real response cannot replace the on-screen sample');
  await render(false);
  check('live response during tutorial', 'late real response is retained after exit');
  await act(async () => setDraft('editable again'));
  check('editable again', 'normal setters work again after exit');
  await act(async () => root.unmount());
  document.querySelector('#result')!.textContent = results.join('\n');
} catch (error) {
  document.querySelector('#result')!.textContent = `${results.join('\n')}\nFAIL: ${String(error)}`;
  throw error;
}
