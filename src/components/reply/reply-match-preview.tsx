import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import type { ReplyRule } from '@/types/reply';

interface ReplyMatchPreviewProps {
  replies: ReplyRule[];
}

// 真引擎测试结果（POST /api/replies/test）。
// 以前这里是前端自己模拟匹配：keyword 被当成「包含」、前缀区分大小写、正则
// 不锚定开头、优先级还排成升序——四种模式全部和后端行为对不上，预览会骗人。
// 现在把文本发给后端，用真实 ReplyManager 匹配 + 渲染，所见即所得。
interface TestResult {
  matched: boolean;
  ruleId: number | null;
  reply: string;
  notice: boolean;          // true=回复来自冷却/日限提示语（规则被拦但设置了提示）
  noticeRuleId: number;
  candidates: { id: number; priority: number; matchType: string; matchContent: string; prob: number; cooldownSec: number }[];
  skipped: { id: number; reason: string }[];
}

export const ReplyMatchPreview: React.FC<ReplyMatchPreviewProps> = ({ replies }) => {
  const { t } = useTranslation();
  const [testText, setTestText] = useState('');
  const [groupId, setGroupId] = useState('');
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const text = testText.trim();
    if (!text) { setResult(null); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch('/api/replies/test', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, groupId: groupId.trim() || undefined }),
        });
        const j = await r.json();
        setResult(j.code === 0 ? (j.data as TestResult) : null);
      } catch { setResult(null); }
      finally { setLoading(false); }
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [testText, groupId, replies]);

  const skipReason = (reason: string) =>
    reason === 'scope' ? t('replies.skip_scope')
    : reason === 'cooldown' ? t('replies.skip_cooldown')
    : reason === 'prob' ? t('replies.skip_prob')
    : reason === 'daylimit' ? t('replies.skip_daylimit') : reason;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{t('replies.preview_title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder={t('replies.preview_ph')}
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder={t('replies.preview_group_ph')}
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-32 font-mono"
            title={t('replies.preview_group_hint')}
          />
        </div>

        {testText.trim() === '' ? (
          <p className="text-xs text-muted-foreground">{t('replies.preview_hint')}</p>
        ) : loading && !result ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : !result || (result.candidates.length === 0 && !result.matched) ? (
          <p className="text-xs text-muted-foreground">{t('replies.no_match')}</p>
        ) : (
          <div className="space-y-2">
            {result.matched && (
              <div className="rounded-md border p-3 bg-primary/5 border-primary/20">
                <p className="text-xs text-muted-foreground mb-1">{t('replies.preview_winner', { id: result.ruleId })}</p>
                <p className="text-sm whitespace-pre-wrap break-all">{result.reply}</p>
              </div>
            )}
            {!result.matched && result.notice && (
              <div className="rounded-md border p-3 bg-muted/40">
                <p className="text-xs text-muted-foreground mb-1">{t('replies.preview_notice', { id: result.noticeRuleId })}</p>
                <p className="text-sm whitespace-pre-wrap break-all">{result.reply}</p>
              </div>
            )}
            {result.candidates.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  {t('replies.preview_count', { count: result.candidates.length })}
                </p>
                {result.candidates.map((c) => {
                  const skip = result.skipped.find((s) => s.id === c.id);
                  const isWinner = result.matched && result.ruleId === c.id;
                  return (
                    <div key={c.id} className={`rounded-md border px-3 py-2 text-xs flex items-center gap-2 flex-wrap ${isWinner ? 'border-primary/40' : 'opacity-70'}`}>
                      <Badge variant="secondary" className="text-[10px]">
                        {t('replies.mt_' + c.matchType, c.matchType)}
                      </Badge>
                      <code className="font-mono break-all">{c.matchContent}</code>
                      <span className="text-muted-foreground">{t('replies.priority')}: {c.priority}</span>
                      {c.prob < 100 && <span className="text-muted-foreground">{c.prob}%</span>}
                      {c.cooldownSec > 0 && <span className="text-muted-foreground">CD {c.cooldownSec}s</span>}
                      {isWinner && <Badge className="text-[10px]">{t('replies.preview_win_badge')}</Badge>}
                      {skip && <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">{skipReason(skip.reason)}</Badge>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReplyMatchPreview;
