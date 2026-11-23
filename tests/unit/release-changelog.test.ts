import { afterEach, describe, expect, it, vi } from 'vitest';
import { previewReleaseNotes, recentReleaseNotes, loadReleaseNotes, STATIC_RELEASES_URL, RECENT_RELEASES_URL } from '../../src/lib/release-changelog';

const sample = `相较于 [v3.0.0-beta.960](https://github.com/DiceZone/Dice-Next/releases/tag/v3.0.0-beta.960)，本次包含以下改动。

## 问题修复

- 导入的通知窗口可以再编辑（[\`主程序 · 441ed93\`](https://github.com/DiceZone/Dice-Next/commit/441ed93)）

## 源码与完整比较

- 主程序完整改动

<details>
<summary>完整提交记录</summary>
隐藏内容
</details>
`;

describe('release notes shown on the about page', () => {
  it('keeps the disclosed summary and drops the commit history', () => {
    const notes = previewReleaseNotes(sample);
    expect(notes).toContain('相较于 v3.0.0-beta.960，本次包含以下改动。');
    expect(notes).toContain('问题修复');
    expect(notes).toContain('主程序 · 441ed93');
    expect(notes).not.toContain('源码与完整比较');
    expect(notes).not.toContain('隐藏内容');
    expect(notes).not.toContain('https://');
  });

  it('accepts only the five newest published Dice!Next releases', () => {
    const parsed = recentReleaseNotes([
      {
        draft: true,
        tag_name: 'v3.0.0-beta.957',
        html_url: 'https://github.com/DiceZone/Dice-Next/releases/tag/v3.0.0-beta.957',
        body: 'draft',
      },
      {
        tag_name: 'v3.0.0-beta.961',
        html_url: 'https://github.com/DiceZone/Dice-Next/releases/tag/v3.0.0-beta.961',
        published_at: '2026-11-01T09:54:37Z',
        body: sample,
      },
      {
        tag_name: 'v2.7.0',
        html_url: 'https://github.com/Dice-Developer-Team/Dice/releases/tag/v2.7.0',
        body: '原版',
      },
      { tag_name: 'not-a-release', html_url: 'javascript:alert(1)', body: 'bad' },
      {
        tag_name: 'v3.0.0-beta.960',
        html_url: 'https://evil.example/DiceZone/Dice-Next/releases/tag/v3.0.0-beta.960',
        body: 'mirror',
      },
      {
        tag_name: 'v3.0.0',
        html_url: 'https://github.com/DiceZone/Dice-Next/releases/tag/v3.0.0?extra=1',
        published_at: '2026-06-01T00:00:00Z',
        body: '',
      },
    ]);
    expect(parsed.map((item) => item.tag)).toEqual(['v3.0.0-beta.961']);
    expect(parsed[0].url).toBe('https://github.com/DiceZone/Dice-Next/releases/tag/v3.0.0-beta.961');
    expect(parsed[0].publishedOn).toBe('2026-11-01');
    expect(parsed[0].notes).toContain('问题修复');
  });
});

const release = { tag_name: 'v3.0.0-beta.986',
  html_url: 'https://github.com/DiceZone/Dice-Next/releases/tag/v3.0.0-beta.986',
  published_at: '2026-11-23T06:00:00Z', body: sample };
const response = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); localStorage.clear(); });
describe('release feed availability', () => {
  it('prefers the documentation snapshot, follows redirects and sends no panel credentials', async () => {
    const fetcher = vi.fn(async () => response({ schema: 1, repository: 'DiceZone/Dice-Next', releases: [release] }));
    vi.stubGlobal('fetch', fetcher);
    const result = await loadReleaseNotes(new AbortController().signal);
    expect(result.source).toBe('docs');
    expect(result.notes[0].tag).toBe(release.tag_name);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(STATIC_RELEASES_URL, expect.objectContaining({ credentials: 'omit', redirect: 'follow' }));
    expect(fetcher.mock.calls[0][1].headers).toEqual({ Accept: 'application/json' });
  });
  it.each(['http', 'html', 'schema', 'network'])('falls back to GitHub after a %s failure', async (kind) => {
    const fetcher = vi.fn().mockImplementationOnce(async () => {
      if (kind === 'network') throw new TypeError('offline');
      if (kind === 'html') return new Response('<html>301 Moved Permanently</html>');
      if (kind === 'schema') return response({ schema: 2, releases: [release] });
      return response({}, 503);
    }).mockResolvedValueOnce(response([release]));
    vi.stubGlobal('fetch', fetcher);
    expect((await loadReleaseNotes(new AbortController().signal)).source).toBe('github');
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([STATIC_RELEASES_URL, RECENT_RELEASES_URL]);
  });
  it('shows a marked cached result only when both services fail', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response([release])).mockRejectedValue(new TypeError('offline'));
    vi.stubGlobal('fetch', fetcher);
    await loadReleaseNotes(new AbortController().signal);
    const result = await loadReleaseNotes(new AbortController().signal);
    expect(result.source).toBe('cache');
    expect(result.notes[0].tag).toBe(release.tag_name);
  });
  it('does not use a corrupted cache or treat errors as empty successful notes', async () => {
    localStorage.setItem('dice-release-notes-v1', 'broken');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(loadReleaseNotes(new AbortController().signal)).rejects.toThrow('unavailable');
  });
  it('falls back after a stalled request times out', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')));
    })).mockResolvedValueOnce(response([release]));
    vi.stubGlobal('fetch', fetcher);
    const pending = loadReleaseNotes(new AbortController().signal);
    await vi.advanceTimersByTimeAsync(8000);
    expect((await pending).source).toBe('github');
  });
  it('does not start another request or show stale results after the page is closed', async () => {
    const controller = new AbortController(); controller.abort();
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(loadReleaseNotes(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
