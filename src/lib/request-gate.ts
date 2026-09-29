/** Ignore responses from an older selection or an earlier request. */
export function createRequestGate() {
  let key = '';
  let generation = 0;
  return {
    select(next: string) { if (next !== key) { key = next; generation++; } },
    start() { const ticket = ++generation; return () => ticket === generation; },
    capture() { const ticket = generation; return () => ticket === generation; },
    invalidate() { generation++; },
  };
}
