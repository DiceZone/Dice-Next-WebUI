/**
 * C#29: Causal Rule Table — list / search / toggle / delete rules
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Search, Edit3, Trash2, Plus } from 'lucide-react';
import type { CausalRule } from '@/types/causal';

interface Props {
  rules: CausalRule[];
  loading: boolean;
  filterText: string;
  onFilterChange: (text: string) => void;
  onEdit: (rule: CausalRule) => void;
  onDelete: (id: number) => void;
  onToggle: (id: number) => void;
  onCreate: () => void;
}

const scopeLabel = (scope: string, t: TFunction): string => {
  if (scope === 'group') return t('causal.scope_group');
  if (scope === 'user') return t('causal.scope_user');
  return t('causal.scope_global');
};

const condTypeLabel = (type: string, t: TFunction): string => {
  const keys: Record<string, string> = {
    keyword: 'cond_keyword', prefix: 'cond_prefix', regex: 'cond_regex', search: 'cond_search',
    user_filter: 'cond_user_filter', group_filter: 'cond_group_filter',
    cooldown: 'cond_cooldown', counter_check: 'cond_counter_check',
  };
  return keys[type] ? t('causal.' + keys[type]) : type;
};

export const CausalRuleTable: React.FC<Props> = ({
  rules, loading, filterText, onFilterChange, onEdit, onDelete, onToggle, onCreate,
}) => {
  const { t } = useTranslation();
  const filtered = rules.filter((r) =>
    !filterText ||
    r.name.toLowerCase().includes(filterText.toLowerCase()) ||
    r.conditions.some((c) => c.content.toLowerCase().includes(filterText.toLowerCase()))
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('causal.search')}
            value={filterText}
            onChange={(e) => onFilterChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={onCreate}><Plus className="mr-2 h-4 w-4" />{t('causal.new')}</Button>
      </div>

      {loading ? (
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <p className="text-sm">{t('causal.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((rule) => (
            <Card key={rule.id} className={!rule.enabled ? 'opacity-60' : ''}>
              <CardContent className="flex items-start gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{rule.name || t('causal.unnamed')}</span>
                    <Badge variant="secondary" className="text-xs">{scopeLabel(rule.scope, t)}</Badge>
                    <Badge variant="outline" className="text-xs">{t('causal.priority')} {rule.priority}</Badge>
                    <Badge variant="outline" className="text-xs">{rule.logic.toUpperCase()}</Badge>
                    {rule.cooldownMs > 0 && (
                      <Badge variant="outline" className="text-xs">{t('causal.cooldown')} {rule.cooldownMs}ms</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {rule.conditions.map((c, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-mono px-1 py-0 font-normal">
                        {condTypeLabel(c.type, t)}: {c.content.substring(0, 30)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={rule.enabled} onCheckedChange={() => onToggle(rule.id)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" title={t('common.edit')} onClick={() => onEdit(rule)}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title={t('common.delete')} onClick={() => onDelete(rule.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CausalRuleTable;
