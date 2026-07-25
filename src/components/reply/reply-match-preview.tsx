import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReplyRule } from '@/types/reply';

interface ReplyMatchPreviewProps {
  replies: ReplyRule[];
}

function testMatch(rule: ReplyRule, text: string): boolean {
  try {
    switch (rule.matchType) {
      case 'keyword':
        return text.includes(rule.matchContent);
      case 'prefix':
        return text.startsWith(rule.matchContent);
      case 'regex':
        return new RegExp(rule.matchContent).test(text);
      case 'search':
        return text.toLowerCase().includes(rule.matchContent.toLowerCase());
      default:
        return false;
    }
  } catch {
    return false;
  }
}

export const ReplyMatchPreview: React.FC<ReplyMatchPreviewProps> = ({ replies }) => {
  const { t } = useTranslation();
  const [testText, setTestText] = useState('');

  const matches = useMemo(() => {
    if (!testText.trim()) return [];
    return replies
      .filter((r) => r.enabled && testMatch(r, testText))
      .sort((a, b) => a.priority - b.priority);
  }, [replies, testText]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{t('replies.preview_title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder={t('replies.preview_ph')}
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
        />

        {testText.trim() === '' ? (
          <p className="text-xs text-muted-foreground">{t('replies.preview_hint')}</p>
        ) : matches.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('replies.no_match')}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {t('replies.preview_count', { count: matches.length })}
            </p>
            {matches.map((rule) => (
              <div
                key={rule.id}
                className={cn(
                  'rounded-md border p-3 transition-colors',
                  'bg-primary/5 border-primary/20'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {t('replies.mt_' + rule.matchType, rule.matchType)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t('replies.priority')}: {rule.priority}
                  </span>
                </div>
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {rule.matchContent}
                </p>
                <p className="text-sm mt-1 break-all">{rule.replyContent}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReplyMatchPreview;
