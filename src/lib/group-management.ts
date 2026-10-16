export const MAX_GROUP_LEAVE_BATCH = 100;

export interface LeaveAccount {
  adapterId: string; adapterName?: string; loginName?: string;
  platform: string; endpointId: string; connected: boolean;
  left?: boolean; canLeaveGroup?: boolean;
}
export interface LeaveGroup {
  platform: string; groupId: string; name: string; left?: boolean;
  accounts?: LeaveAccount[];
}
export interface GroupLeaveTarget {
  platform: string; groupId: string; name: string;
  adapterId: string; adapterName: string; endpointId: string;
  selectionKey: string;
}

export const groupSelectionKey = (group: Pick<LeaveGroup, 'platform' | 'groupId'>) =>
  JSON.stringify([group.platform, group.groupId]);

/** Never guess which bot should leave a multi-account group. */
export function groupLeaveTarget(group: LeaveGroup, adapterFilter: string): GroupLeaveTarget | null {
  if (group.left) return null;
  const joined = group.accounts?.filter((account) => !account.left) || [];
  const account = adapterFilter === 'all'
    ? (joined.length === 1 ? joined[0] : undefined)
    : joined.find((item) => item.adapterId === adapterFilter);
  if (!account?.adapterId || !account.endpointId || !account.platform || !account.connected || account.canLeaveGroup !== true) return null;
  return { platform: account.platform, groupId: group.groupId, name: group.name,
    adapterId: account.adapterId, adapterName: account.adapterName || account.loginName || account.adapterId,
    endpointId: account.endpointId, selectionKey: groupSelectionKey(group) };
}

export function groupCommandTimestamp(value?: string): number | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value)) return null;
  const time = Date.parse(value.length === 10 ? value + 'T00:00:00Z' : value);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  return time;
}

export function groupCommandTimeText(value: string | undefined, locale: string): string | null {
  const time = groupCommandTimestamp(value);
  if (time === null) return null;
  if (value!.length === 10) return value!;
  return new Date(time).toLocaleString(locale, { year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function sortGroupActivity<T extends { name: string; lastCommandAt?: string }>(items: readonly T[], order: string): T[] {
  return [...items].sort((a, b) => {
    if (order === 'recent' || order === 'inactive') {
      const left = groupCommandTimestamp(a.lastCommandAt);
      const right = groupCommandTimestamp(b.lastCommandAt);
      // Unknown is not proof of inactivity; keep it last in either direction.
      if (left === null && right !== null) return 1;
      if (right === null && left !== null) return -1;
      if (left !== null && right !== null && left !== right) return (left - right) * (order === 'recent' ? -1 : 1);
    }
    return a.name.localeCompare(b.name);
  });
}

export interface GroupLeaveReport {
  submitted: GroupLeaveTarget[];
  failed: { target: GroupLeaveTarget; error: string }[];
  cancelled: GroupLeaveTarget[];
}

/** Sequential, bounded, exact-account requests. Failures stay available for retry. */
export async function submitGroupLeaves(targets: readonly GroupLeaveTarget[],
  post: (path: string, body: Record<string, string>) => Promise<unknown>,
  cancelled = () => false, progress = (_completed: number) => {}) : Promise<GroupLeaveReport> {
  if (!targets.length || targets.length > MAX_GROUP_LEAVE_BATCH) throw new Error('Invalid group batch size');
  const keys = new Set<string>();
  for (const target of targets) {
    if (!target.platform || !target.groupId || !target.adapterId || !target.endpointId) throw new Error('Missing group binding');
    const key = JSON.stringify([target.platform, target.groupId, target.adapterId]);
    if (keys.has(key)) throw new Error('Duplicate group binding');
    keys.add(key);
  }
  const report: GroupLeaveReport = { submitted: [], failed: [], cancelled: [] };
  for (const [index, target] of targets.entries()) {
    if (cancelled()) { report.cancelled.push(...targets.slice(index)); break; }
    try {
      await post(`/groups/${encodeURIComponent(target.platform)}/${encodeURIComponent(target.groupId)}/action`,
        { action: 'leave', adapterId: target.adapterId, endpointId: target.endpointId });
      report.submitted.push(target);
    } catch (error) {
      report.failed.push({ target, error: error instanceof Error ? error.message : String(error) });
    }
    progress(index + 1);
  }
  return report;
}
