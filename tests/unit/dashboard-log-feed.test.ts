import { afterEach, expect, it, vi } from 'vitest';
import { startLogFeed } from '../../src/lib/dashboard-log-feed';

afterEach(() => vi.useRealTimers());
const batch = (id: string) => ({ reset: false, entries: [{ id, message: id }] });

it('detects a stream that goes silent after connecting and resumes fetching', async () => {
  vi.useFakeTimers();
  const cursors: string[] = [];
  const stop = startLogFeed(async (after, stream, signal) => {
    if (!stream) {
      cursors.push(after);
      return Response.json({ data: { reset: false, entries: [] } });
    }
    return new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('data: ' + JSON.stringify(batch('live')) + '\n\n'));
          signal.addEventListener('abort', () => c.close());
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream' } },
    );
  }, vi.fn());
  try {
    await vi.advanceTimersByTimeAsync(24000);
    expect(cursors).toEqual(['']);
    await vi.advanceTimersByTimeAsync(1100);
    expect(cursors).toEqual(['', 'live']);
  } finally {
    stop();
  }
});

it('keeps polling behind a buffering proxy, retries SSE and resumes fetch at its last ID', async () => {
  vi.useFakeTimers();
  const cursors: string[] = [];
  let probes = 0;
  let channel: ReadableStreamDefaultController<Uint8Array> | undefined;
  const publish = vi.fn();
  const stop = startLogFeed(async (after, stream, signal) => {
    if (!stream) {
      cursors.push(after);
      return Response.json({ data: batch(after || 'a') });
    }
    probes++;
    return new Response(
      new ReadableStream({
        start(c) {
          channel = c;
          signal.addEventListener('abort', () => {
            try {
              c.close();
            } catch {
              /* already closed */
            }
          });
        },
      }),
      { headers: { 'content-type': 'text/event-stream' } },
    );
  }, publish);
  try {
    await vi.advanceTimersByTimeAsync(10100);
    expect(probes).toBe(2);
    expect(cursors.length).toBeGreaterThan(5);
    const send = (s: string) => channel!.enqueue(new TextEncoder().encode(s));
    send(': ready\r');
    send('\n\r\n');
    send('data: ' + JSON.stringify(batch('b')) + '\n\n');
    await vi.advanceTimersByTimeAsync(0);
    expect(publish.mock.lastCall?.[0].map((r: { id: string }) => r.id)).toEqual(['a', 'b']);
    const before = cursors.length;
    await vi.advanceTimersByTimeAsync(2000);
    expect(cursors).toHaveLength(before);
    channel!.close();
    await vi.advanceTimersByTimeAsync(0);
    expect(cursors.at(-1)).toBe('b');
    expect(publish).toHaveBeenCalledTimes(2);
  } finally {
    stop();
  }
});

it('retries failed requests without clearing history or starting overlapping polls', async () => {
  vi.useFakeTimers();
  let polls = 0;
  const publish = vi.fn();
  const stop = startLogFeed(async (after, stream, signal) => {
    if (stream) throw Error('SSE unavailable');
    polls++;
    if (polls === 1) return Response.json({ data: batch('old') });
    if (polls === 2)
      return new Promise<Response>((_, reject) =>
        signal.addEventListener('abort', () => reject(Error('timeout'))),
      );
    expect(after).toBe('old');
    return Response.json({ data: { ...batch('new'), reset: true } });
  }, publish);
  try {
    await vi.advanceTimersByTimeAsync(7500);
    expect(polls).toBe(2);
    expect(publish).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4500);
    expect(publish.mock.lastCall?.[0].map((r: { id: string }) => r.id)).toEqual(['new']);
  } finally {
    stop();
  }
  const stopped = polls;
  await vi.advanceTimersByTimeAsync(120000);
  expect(polls).toBe(stopped);
});
