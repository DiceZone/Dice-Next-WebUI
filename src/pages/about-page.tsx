import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export const AboutPage: React.FC = () => {
  const { t } = useTranslation();
  const [version, setVersion] = useState('...');
  const [buildNumber, setBuildNumber] = useState('');
  const [buildTime, setBuildTime] = useState('');

  useEffect(() => {
    fetch('/api/system/status')
      .then((r) => r.json())
      .then((d) => {
        if (d.code === 0) {
          setVersion(d.data.version);
          setBuildNumber(d.data.buildNumber || 0);
          setBuildTime(d.data.buildTime || '');
        }
      })
      .catch(() => setVersion(t('about.unknown') || 'Unknown'));
  }, [t]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Info className="h-5 w-5" />{t('about.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('about.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('about.intro_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p dangerouslySetInnerHTML={{ __html: t('about.intro_text') }} />
          <p>{t('about.license')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('about.version_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{t('about.current_version')}</span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">{t('about.preview_label')}</span>
              <span className="font-mono font-medium">v{version}({buildNumber || '?'})</span>
            </div>
          </div>
          {buildTime && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('about.build_time')}</span>
              <span className="font-mono text-xs">{buildTime}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('about.backend_framework')}</span>
            <span>Drogon (C++20)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('about.frontend_framework')}</span>
            <span>React + TypeScript</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('about.stack_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><strong className="text-foreground">{t('about.stack_backend')}</strong>：{t('about.stack_backend_text')}</p>
          <p><strong className="text-foreground">{t('about.stack_frontend')}</strong>：{t('about.stack_frontend_text')}</p>
          <p><strong className="text-foreground">{t('about.stack_adapter')}</strong>：{t('about.stack_adapter_text')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('about.changelog_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">{t('about.v3_title')}</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              {(t('about.v3_items', { returnObjects: true }) as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
          <Separator />
          <div>
            <p className="font-medium text-foreground">{t('about.v2_title')}</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              {(t('about.v2_items', { returnObjects: true }) as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('about.thanks_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p><a href="https://github.com/Dice-Developer-Team/Dice" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Dice!</a></p>
          <p><a href="https://github.com/sealdice/sealdice-core" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">SealDice</a></p>
          <p><a href="https://github.com/OlivOS-Team/OlivOS" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OlivOS</a></p>
          <p><a href="https://github.com/NapNeko/NapCatQQ" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">NapCat</a></p>
          <p><a href="https://www.llonebot.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">LLOneBot</a></p>
          <p><a href="https://snowluma.github.io/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">SnowLuma</a></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('about.testers_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TESTERS.map((p) => (
              <div key={p.qq} className="flex items-center gap-2.5">
                <img
                  src={`https://q1.qlogo.cn/g?b=qq&nk=${p.qq}&s=100`}
                  alt={p.name}
                  loading="lazy"
                  className="h-9 w-9 rounded-full bg-muted object-cover shrink-0"
                />
                <span className="text-sm font-medium truncate">{p.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Beta testers — nickname shown, QQ used to load the avatar.
const TESTERS: { name: string; qq: string }[] = [
  { name: '剪影', qq: '25373790' },
  { name: '平衡', qq: '869154801' },
  { name: '云嗣', qq: '2984360687' },
  { name: '贰狐', qq: '1735450' },
  { name: '条辣困', qq: '2404823271' },
  { name: '叶川', qq: '3190096508' },
  { name: '韶华', qq: '2130369737' },
  { name: '细雪', qq: '2431692084' },
  { name: '察生', qq: '2294044530' },
  { name: '霜桦', qq: '404507568' },
];

export default AboutPage;
