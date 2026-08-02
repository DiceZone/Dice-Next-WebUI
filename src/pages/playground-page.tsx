import React from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlatformIcon } from '@/components/platform-icon';
import { cn } from '@/lib/utils';

/**
 * Playground — a chat-style test page for trying bot commands without QQ.
 * Sends to POST /api/test/message and shows the bot's reply as chat bubbles.
 */

interface ChatItem {
  role: 'user' | 'bot';
  text: string;
  empty?: boolean;
}

const QUICK_COMMANDS = ['.r', '.r3d6+2', '.ra 侦查 60', '.coc', '.dnd', '.help'];

export const PlaygroundPage: React.FC = () => {
  const { t } = useTranslation();
  const [items, setItems] = React.useState<ChatItem[]>([
    { role: 'bot', text: t('playground.welcome') },
  ]);
  const [input, setInput] = React.useState('');
  const [scene, setScene] = React.useState<'group' | 'private'>('group');
  const [platform, setPlatform] = React.useState('onebot_v11');
  const [locale, setLocale] = React.useState('');
  const [nickname, setNickname] = React.useState(t('playground.default_nick'));
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Prevent main container from scrolling — playground handles its own scroll
    const main = document.querySelector('main');
    if (main) {
      main.style.overflow = 'hidden';
      return () => { main.style.overflow = ''; };
    }
  }, []);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setItems((prev) => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setSending(true);
    try {
      const resp = await fetch('/api/test/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmed,
          platform,
          messageType: scene,
          nickname: nickname || t('playground.default_nick'),
          locale,
          userId: '10001',
          groupId: '100001',
        }),
      });
      const data = await resp.json();
      if (data.error) {
        setItems((prev) => [...prev, { role: 'bot', text: '⚠ ' + data.error }]);
      } else if (data.reply) {
        setItems((prev) => [...prev, { role: 'bot', text: data.reply }]);
      } else {
        setItems((prev) => [...prev, { role: 'bot', text: t('playground.no_reply'), empty: true }]);
      }
    } catch (e) {
      setItems((prev) => [...prev, { role: 'bot', text: '⚠ ' + String(e) }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Controls */}
      <div className="shrink-0 flex flex-wrap items-end gap-3 border-b p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t('playground.scene')}</label>
          <Select value={scene} onValueChange={(v) => setScene(v as 'group' | 'private')}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="group">{t('playground.group')}</SelectItem>
              <SelectItem value="private">{t('playground.private')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t('playground.platform')}</label>
          <Select value={platform} onValueChange={(v) => setPlatform(v)}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="onebot_v11"><span className="flex items-center gap-2"><PlatformIcon platform="onebot_v11" />QQ (OneBot v11)</span></SelectItem>
              <SelectItem value="qq_official"><span className="flex items-center gap-2"><PlatformIcon platform="qq_official" />QQ 官方机器人</span></SelectItem>
              <SelectItem value="discord"><span className="flex items-center gap-2"><PlatformIcon platform="discord" />Discord</span></SelectItem>
              <SelectItem value="kook"><span className="flex items-center gap-2"><PlatformIcon platform="kook" />KOOK</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t('playground.reply_lang')}</label>
          <Select value={locale || '__default__'} onValueChange={(v) => setLocale(v === '__default__' ? '' : v)}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">{t('playground.lang_default')}</SelectItem>
              <SelectItem value="zh-Hans">简体中文</SelectItem>
              <SelectItem value="zh-Hant">繁體中文</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ja">日本語</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{t('playground.nickname')}</label>
          <Input value={nickname} onChange={(e) => setNickname(e.target.value)} className="h-9 w-32" />
        </div>
      </div>

      {/* Chat area */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {items.map((item, i) => (
          <div key={i} className={cn('flex', item.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[72%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                item.role === 'user'
                  ? 'rounded-br-sm bg-primary text-primary-foreground'
                  : 'rounded-bl-sm border bg-muted',
                item.empty && 'italic text-muted-foreground'
              )}
            >
              {item.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick commands */}
      <div className="shrink-0 flex flex-wrap gap-2 border-t px-4 pt-3">
        {QUICK_COMMANDS.map((q) => (
          <button key={q} onClick={() => send(q)}
            className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 p-4 pt-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
          placeholder={t('playground.input_placeholder')}
        />
        <Button onClick={() => send(input)} disabled={sending}>
          <Send className="mr-1 h-4 w-4" />
          {t('playground.send')}
        </Button>
      </div>
    </div>
  );
};

export default PlaygroundPage;
