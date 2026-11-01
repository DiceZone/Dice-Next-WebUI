import { describe, expect, it } from 'vitest';
import { previewReleaseNotes, recentReleaseNotes } from '../../src/lib/release-changelog';

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
      { draft: true, tag_name: 'v3.0.0-beta.957', html_url: 'https://github.com/DiceZone/Dice-Next/releases/tag/v3.0.0-beta.957', body: 'draft' },
      { tag_name: 'v3.0.0-beta.961', html_url: 'https://github.com/DiceZone/Dice-Next/releases/tag/v3.0.0-beta.961', published_at: '2026-11-01T09:54:37Z', body: sample },
      { tag_name: 'v2.7.0', html_url: 'https://github.com/Dice-Developer-Team/Dice/releases/tag/v2.7.0', body: '原版' },
      { tag_name: 'not-a-release', html_url: 'javascript:alert(1)', body: 'bad' },
      { tag_name: 'v3.0.0-beta.960', html_url: 'https://evil.example/DiceZone/Dice-Next/releases/tag/v3.0.0-beta.960', body: 'mirror' },
      { tag_name: 'v3.0.0', html_url: 'https://github.com/DiceZone/Dice-Next/releases/tag/v3.0.0?extra=1', published_at: '2026-06-01T00:00:00Z', body: '' },
    ]);
    expect(parsed.map((item) => item.tag)).toEqual(['v3.0.0-beta.961']);
    expect(parsed[0].url).toBe('https://github.com/DiceZone/Dice-Next/releases/tag/v3.0.0-beta.961');
    expect(parsed[0].publishedOn).toBe('2026-11-01');
    expect(parsed[0].notes).toContain('问题修复');
  });
});
