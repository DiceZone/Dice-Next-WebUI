import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CornerDownLeft, FileText, Search, Settings2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  getSettingsSearchEntryKind,
  matchSettingsSearch,
  SETTINGS_SEARCH_ENTRIES,
  searchDestination,
  type SettingsSearchEntry,
  type SettingsSearchEntryKind,
  type SettingsSearchMatchKind,
} from '@/lib/settings-search';

interface GlobalSettingsSearchProps {
  onNavigate: (path: string) => void;
}

interface SearchResult {
  entry: SettingsSearchEntry;
  title: string;
  description: string;
  page: string;
  score: number;
  matchedKeyword: string;
  entryKind: SettingsSearchEntryKind;
  matchKind: SettingsSearchMatchKind;
}

export const GlobalSettingsSearch: React.FC<GlobalSettingsSearchProps> = ({ onNavigate }) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const shortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';

  const localizedEntries = useMemo<SearchResult[]>(() => SETTINGS_SEARCH_ENTRIES.map((entry) => {
    const title = t(entry.titleKey);
    const description = entry.descriptionKey ? t(entry.descriptionKey) : '';
    const page = t(entry.pageKey);
    return {
      entry,
      title: title === entry.titleKey ? entry.titleKey : title,
      description: description === entry.descriptionKey ? '' : description,
      page: page === entry.pageKey ? entry.pageKey : page,
      score: 0,
      matchedKeyword: '',
      entryKind: getSettingsSearchEntryKind(entry),
      matchKind: 'direct',
    };
  }), [t, i18n.resolvedLanguage]);

  const results = useMemo(() => {
    if (!query.trim()) {
      return localizedEntries.filter((item) => item.entry.featured).slice(0, 10);
    }
    return localizedEntries
      .map((item) => {
        const keywords = item.entry.keywords || '';
        const match = matchSettingsSearch(query, {
          title: item.title,
          description: item.description,
          page: item.page,
          keywords,
        });
        return {
          ...item,
          score: match
            ? match.score + (item.entry.featured ? 2 : 0) + (item.entryKind === 'page' ? 3 : 0)
            : -1,
          matchedKeyword: match?.matchedKeyword || '',
          matchKind: match?.kind || 'direct',
        };
      })
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 20);
  }, [localizedEntries, query]);

  useEffect(() => {
    setSelected(0);
  }, [query, open]);

  useEffect(() => {
    if (open) resultRefs.current[selected]?.scrollIntoView({ block: 'nearest' });
  }, [open, selected]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  const choose = (result: SearchResult | undefined) => {
    if (!result) return;
    setOpen(false);
    onNavigate(searchDestination(result.entry));
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((current) => results.length ? (current + 1) % results.length : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((current) => results.length ? (current - 1 + results.length) % results.length : 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(results[selected]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="hidden h-9 w-full max-w-xl items-center gap-2 rounded-lg border bg-muted/35 px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:border-primary/35 hover:bg-muted/65 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
          aria-label={t('global_search.open')}
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">{t('global_search.placeholder')}</span>
          <kbd className="ml-auto shrink-0 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{shortcut}</kbd>
        </button>
      </DialogTrigger>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('global_search.open')}>
          <Search className="h-5 w-5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogTitle className="sr-only">{t('global_search.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('global_search.description')}</DialogDescription>

        <div className="border-b p-4 pr-12">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={t('global_search.input_placeholder')}
              className="h-11 border-0 bg-transparent pl-10 text-base shadow-none focus-visible:ring-0"
              role="combobox"
              aria-expanded={open}
              aria-controls="global-settings-search-results"
              aria-activedescendant={results[selected] ? `global-search-${results[selected].entry.id}` : undefined}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-b bg-muted/25 px-4 py-2 text-xs text-muted-foreground">
          <span>{query.trim() ? t('global_search.results', { count: results.length }) : t('global_search.suggested')}</span>
          <span>{t('global_search.scope_hint')}</span>
        </div>

        <ScrollArea id="global-settings-search-results" className="max-h-[min(55vh,28rem)] p-2" role="listbox">
          {results.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
              <Search className="h-8 w-8 opacity-35" />
              <p className="text-sm font-medium text-foreground">{t('global_search.empty')}</p>
              <p className="text-xs">{t('global_search.empty_hint')}</p>
            </div>
          ) : results.map((result, index) => (
            <button
              key={result.entry.id}
              id={`global-search-${result.entry.id}`}
              ref={(node) => { resultRefs.current[index] = node; }}
              type="button"
              role="option"
              aria-selected={selected === index}
              onMouseEnter={() => setSelected(index)}
              onClick={() => choose(result)}
              className={cn(
                'group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                selected === index ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/70',
              )}
            >
              <span className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground',
                selected === index && 'border-primary/30 text-primary',
              )}>
                {result.entryKind === 'page' ? (
                  <FileText className="h-4 w-4" />
                ) : result.entryKind === 'feature' ? (
                  <Sparkles className="h-4 w-4" />
                ) : (
                  <Settings2 className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{result.title}</span>
                  <span className={cn(
                    'shrink-0 rounded px-1.5 py-0.5 text-[10px]',
                    result.entryKind === 'page' && 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
                    result.entryKind === 'feature' && 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
                    result.entryKind === 'setting' && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                  )}>
                    {t(`global_search.kind_${result.entryKind}`)}
                  </span>
                  {result.entryKind !== 'page' && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{result.page}</span>
                  )}
                </span>
                {result.description && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{result.description}</span>}
                {result.matchedKeyword && (
                  <span className="mt-1 inline-flex max-w-full rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                    {t(
                      result.matchKind === 'fuzzy'
                        ? 'global_search.matched_fuzzy'
                        : result.matchKind === 'alias'
                          ? 'global_search.matched_alias'
                          : 'global_search.matched_keyword',
                      { keyword: result.matchedKeyword },
                    )}
                  </span>
                )}
              </span>
              <ArrowRight className={cn('h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity', selected === index && 'opacity-100')} />
            </button>
          ))}
        </ScrollArea>

        <div className="flex items-center gap-4 border-t bg-muted/25 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><kbd className="rounded border bg-background px-1">↑↓</kbd>{t('global_search.move')}</span>
          <span className="flex items-center gap-1"><kbd className="rounded border bg-background p-0.5"><CornerDownLeft className="h-3 w-3" /></kbd>{t('global_search.open_result')}</span>
          <span className="ml-auto"><kbd className="rounded border bg-background px-1">Esc</kbd></span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalSettingsSearch;
