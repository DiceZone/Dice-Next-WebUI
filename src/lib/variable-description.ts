import type { TFunction } from 'i18next';
import type { VariableHelpKey } from '@/i18n/variable-help';

export type Variable = { token: string; description?: string; descriptionKey?: VariableHelpKey };
const direct: Record<string, VariableHelpKey> = {
  uid: 'uid', gid: 'gid', selfId: 'selfId', 'user.trust': 'trust', 'user.favor': 'favor',
  list_all_deck: 'allDeck', list_extern_deck: 'externDeck', list_extern_order: 'orders',
  list_reply_deck: 'replies', list_dice_sister: 'sisters',
  strSelfName: 'selfName', strSelfNick: 'selfName', strSelfCall: 'selfCall',
  hp: 'hp', hpmax: 'hpmax', mp: 'mp', mpmax: 'mpmax', san: 'san', sanmax: 'sanmax', dex: 'dex',
  'len:game.pls': 'players', 'len:game.gms': 'gms', at: 'mention', '$0': 'capture0',
};
const functions: Record<string, VariableHelpKey> = {
  sample: 'sample', ran: 'random', print: 'identity', len: 'length', at: 'mention', var: 'assign',
  case: 'exact', grade: 'threshold', expired: 'expired', wait: 'wait', text: 'text',
  roll: 'roll', draw: 'deck', deck: 'deck', help: 'help', api: 'api', counter: 'counter',
};

export function variableDescription(variable: Variable, t: TFunction): string {
  if (variable.description?.trim()) return variable.description;
  const name = variable.token.startsWith('{{') && variable.token.endsWith('}}')
    ? variable.token.slice(2, -2) : variable.token.slice(1, -1);
  const key = variable.descriptionKey ?? direct[name]
    ?? (name.startsWith('char.') ? 'char' : /^\$\d+$/.test(name) ? 'capture'
      : name.includes(':') ? functions[name.split(':', 1)[0]] : undefined)
    ?? (name.includes('|') ? 'sample' : undefined);
  if (key) return t('visual_editor.variables.' + key);
  const global = t('commands.gvar_' + name, { defaultValue: '' });
  return global || t('visual_editor.variables.unknown');
}

export function describedVariables(options: Variable[], t: TFunction): [string, string][] {
  const unique = new Map<string, Variable>();
  for (const option of options) {
    const previous = unique.get(option.token);
    // A later bare token must never erase the command-specific description.
    if (!previous || option.description?.trim()
      || (option.descriptionKey && !previous.description?.trim())) unique.set(option.token, option);
  }
  return [...unique].map(([token, option]) => [token, variableDescription(option, t)]);
}
