const NOTE_LIMIT = 3200;
const STOP_MARKERS = ['## 源码与完整比较', '## Source', '<details>'];
const TAG = /^v\d+\.\d+\.\d+(?:-beta\.\d+)?$/;

export const RECENT_RELEASES_URL =
  'https://api.github.com/repos/DiceZone/Dice-Next/releases?per_page=5';

export interface ReleaseNote {
  tag: string;
  url: string;
  publishedOn: string;
  notes: string;
}

/** Keep the disclosed user-facing notes, not the collapsed commit history. */
export function previewReleaseNotes(text: string): string {
  let source = text;
  for (const marker of STOP_MARKERS) {
    const pos = source.indexOf(marker);
    if (pos >= 0) source = source.slice(0, pos);
  }
  let plain = '';
  for (let i = 0; i < source.length; i += 1) {
    const current = source[i];
    if (current === '<' && i + 1 < source.length) {
      const next = source[i + 1];
      const isTag = (next >= 'a' && next <= 'z') || next === '/' || next === '!';
      if (isTag) {
        const end = source.indexOf('>', i + 1);
        const newline = source.indexOf('\n', i + 1);
        if (end >= 0 && (newline < 0 || end < newline)) {
          i = end;
          continue;
        }
      }
    }
    if (current === '\r' || current === '`') continue;
    plain += current;
  }
  let pos = 0;
  while (pos < plain.length) {
    if (plain[pos] === '#') {
      let end = pos;
      while (end < plain.length && plain[end] === '#') end += 1;
      if (plain[end] === ' ') plain = plain.slice(0, pos) + plain.slice(end + 1);
    }
    const next = plain.indexOf('\n', pos);
    if (next < 0) break;
    pos = next + 1;
  }
  pos = 0;
  while (pos < plain.length) {
    const start = plain.indexOf('[', pos);
    if (start < 0) break;
    const mid = plain.indexOf('](', start);
    const end = mid < 0 ? -1 : plain.indexOf(')', mid + 2);
    if (mid < 0 || end < 0) {
      pos = start + 1;
      continue;
    }
    const label = plain.slice(start + 1, mid);
    plain = plain.slice(0, start) + label + plain.slice(end + 1);
    pos = start + Math.max(label.length, 1);
  }
  const begin = plain.search(/\S/);
  if (begin < 0) return '';
  plain = plain.slice(begin).replace(/\n+$/, '');
  if (plain.length <= NOTE_LIMIT) return plain;
  let end = NOTE_LIMIT;
  while (end > 0 && plain.charCodeAt(end) >= 0xdc00 && plain.charCodeAt(end) <= 0xdfff) end -= 1;
  return `${plain.slice(0, end)}\n…`;
}

function releaseUrl(tag: string, value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com') return '';
    if (url.username || url.password || url.port || url.search || url.hash) return '';
    if (url.pathname !== `/DiceZone/Dice-Next/releases/tag/${tag}`) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export function recentReleaseNotes(payload: unknown, limit = 5): ReleaseNote[] {
  if (!Array.isArray(payload) || limit < 1) return [];
  const notes: ReleaseNote[] = [];
  for (const item of payload) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (record.draft === true) continue;
    const tag = record.tag_name;
    if (typeof tag !== 'string' || !TAG.test(tag)) continue;
    const url = releaseUrl(tag, record.html_url);
    if (!url) continue;
    const published = typeof record.published_at === 'string' ? record.published_at.slice(0, 10) : '';
    notes.push({
      tag,
      url,
      publishedOn: /^\d{4}-\d{2}-\d{2}$/.test(published) ? published : '',
      notes: previewReleaseNotes(typeof record.body === 'string' ? record.body : ''),
    });
    if (notes.length >= limit) break;
  }
  return notes;
}
