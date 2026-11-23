import type { RecentLogEntry } from '../types/dashboard';

type Batch = { entries: RecentLogEntry[]; reset: boolean };
type Request = (after: string, stream: boolean, signal: AbortSignal) => Promise<Response>;

/** Both transports share a cursor. Polling continues while an SSE probe is
 * waiting for its first frame (HTTP headers alone don't prove a CDN streams). */
export function startLogFeed(request: Request, publish: (rows: RecentLogEntry[]) => void,
  initial: RecentLogEntry[] = []) {
  let rows = initial, cursor = rows[rows.length - 1]?.id ?? '', stopped = false, streaming = false;
  let poll: AbortController | undefined, stream: AbortController | undefined;
  let pollTimer: ReturnType<typeof setTimeout>, probeTimer: ReturnType<typeof setTimeout>;
  let failures = 0, retry = 5000;
  function accept(batch: Batch, requestedAfter: string) {
    if (!Array.isArray(batch?.entries) || typeof batch.reset !== 'boolean') throw Error('invalid log batch');
    const last = batch.entries[batch.entries.length - 1];
    if (!last || rows.some(r => r.id === last.id)) return;
    // Polling may have advanced while the proxy was holding this probe.
    // Never replace newer rows with an older snapshot or move the cursor back.
    if (cursor !== requestedAfter) {
      const overlap = batch.entries.findIndex(r => r.id === cursor);
      if (overlap < 0) throw Error('stale probe');
      batch = { reset: false, entries: batch.entries.slice(overlap + 1) };
    }
    const known = new Set(rows.map(r => r.id));
    rows = (batch.reset ? batch.entries : [...rows, ...batch.entries.filter(r => !known.has(r.id))]).slice(-500);
    cursor = last.id;
    publish(rows);
  }
  async function fetchBatch() {
    if (stopped || streaming || poll) return;
    const controller = poll = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const after = cursor;
      const response = await request(after, false, controller.signal);
      if (!response.ok) throw Error('poll unavailable');
      const envelope = await response.json();
      if (!stopped && !streaming && !controller.signal.aborted) {
        accept(envelope.data, after);
        failures = 0;
      }
    } catch { failures++; } finally {
      clearTimeout(timeout);
      poll = undefined;
      if (!stopped && !streaming) pollTimer = setTimeout(fetchBatch, Math.min(15000, 1000 * 2 ** Math.min(failures, 4)));
    }
  }
  async function probe() {
    if (stopped) return;
    const controller = stream = new AbortController();
    let watchdog = setTimeout(() => controller.abort(), 5000);
    let rotate = false;
    try {
      let after = cursor;
      const response = await request(after, true, controller.signal);
      if (!response.ok || !response.headers.get('content-type')?.startsWith('text/event-stream') || !response.body)
        throw Error('stream unavailable');
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buffer = '';
      while (!controller.signal.aborted) {
        const part = await reader.read();
        if (part.done || controller.signal.aborted) break;
        buffer = (buffer + decoder.decode(part.value, { stream: true })).replace(/\r\n/g, '\n');
        if (buffer.length > 16 * 1024 * 1024) throw Error('stream frame too large');
        let end: number;
        while ((end = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          if (frame.startsWith('event: rotate')) { rotate = true; return; }
          if (frame.startsWith('data: ')) {
            const batch: Batch = JSON.parse(frame.slice(6));
            accept(batch, after);
            after = batch.entries[batch.entries.length - 1]?.id ?? after;
          }
          else if (!frame.startsWith(':')) continue;
          streaming = true;
          poll?.abort(); clearTimeout(pollTimer);
          clearTimeout(watchdog);
          watchdog = setTimeout(() => controller.abort(), 25000);
        }
      }
    } catch { /* Per-request failure, never a global connection error. */ }
    finally {
      clearTimeout(watchdog); controller.abort();
      streaming = false;
      if (!stopped) {
        clearTimeout(pollTimer);
        void fetchBatch();
        probeTimer = setTimeout(probe, rotate ? 250 : retry);
        retry = rotate ? 5000 : Math.min(120000, retry * 2);
      }
    }
  }
  void fetchBatch(); void probe();
  return () => {
    stopped = true; poll?.abort(); stream?.abort();
    clearTimeout(pollTimer); clearTimeout(probeTimer);
  };
}
