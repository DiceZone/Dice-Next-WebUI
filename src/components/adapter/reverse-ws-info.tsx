import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { X, Copy, Check } from 'lucide-react';

interface ReverseWsInfoProps {
  open: boolean;
  onClose: () => void;
  port: string;
}

export const ReverseWsInfo: React.FC<ReverseWsInfoProps> = ({ open, onClose, port }) => {
  const { t } = useTranslation();
  const [lanIp, setLanIp] = useState('...');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (!open) return;
    setLanIp('...');
    let done = false;
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.createOffer().then((offer) => pc.setLocalDescription(offer)).catch(() => {});
    pc.onicecandidate = (e) => {
      if (!e.candidate || done) return;
      const ip = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1];
      if (ip && !ip.startsWith('127.') && !ip.startsWith('169.254.')) {
        done = true;
        setLanIp(ip);
        pc.close();
      }
    };
    // Give up after 6 seconds, show "检测失败"
    setTimeout(() => {
      if (!done) setLanIp('...');
    }, 6000);
    return () => { try { pc.close(); } catch {} }
  }, [open]);

  const local = `ws://127.0.0.1:${port}`;
  const lan = lanIp !== '...' ? `ws://${lanIp}:${port}` : t('adapters.detecting');
  const wan = lanIp !== '...' ? `ws://${lanIp}:${port}` : t('adapters.detecting');

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-xl w-[90vw] max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">{t('adapters.reverse_title')}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{t('adapters.reverse_desc')}</p>
        <div className="space-y-3">
          {[
            { label: t('adapters.reverse_local'), addr: local },
            { label: t('adapters.reverse_lan'), addr: lan },
            { label: t('adapters.reverse_wan'), addr: wan },
          ].map(({ label, addr }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-12 shrink-0">{label}</span>
              <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono truncate">{addr}</code>
              <Button variant="ghost" size="icon" onClick={() => copy(addr, label)}>
                {copied === label ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">{t('adapters.reverse_firewall_note')}</p>
      </div>
    </div>
  );
};
export default ReverseWsInfo;
