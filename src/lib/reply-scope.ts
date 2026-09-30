export interface ReplySettingsScope {
  scope: 'global' | 'adapter' | 'account';
  target: string;
  platform: string;
}

export const globalReplyScope: ReplySettingsScope = { scope: 'global', target: '', platform: '' };

export function replyScopeKey(scope: ReplySettingsScope): string {
  return JSON.stringify([scope.scope, scope.target]);
}

export function replyScopeQuery(scope: ReplySettingsScope): string {
  return new URLSearchParams({ scope: scope.scope, target: scope.target }).toString();
}

export function resolveReplyScope(selection: string, accounts: { id: string; type: string }[]): ReplySettingsScope {
  if (selection === 'global') return { scope: 'global', target: '', platform: '' };
  const separator = selection.indexOf(':');
  const scope = selection.slice(0, separator);
  const target = selection.slice(separator + 1);
  if (!target) throw new Error('Missing reply scope target');
  if (scope === 'adapter') return { scope, target, platform: target };
  const account = accounts.find((item) => item.id === target);
  if (scope === 'account') return { scope, target, platform: account?.type ?? '' };
  throw new Error('Unknown reply scope');
}
