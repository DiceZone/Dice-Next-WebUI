export type MigrationDetail = { stage: string; name: string; status: string; reason: string };
export type SessionConfirmation = { key: string; file: string; name: string; candidates: { id: string; code: string; name: string }[] };
export type MigrationView = {
  status: 'complete' | 'partial' | 'failed';
  details: MigrationDetail[]; sessions: number; logs: number; messages: number;
  backupPath: string; reportPath: string; reloadRequired: boolean;
  sessionConfirmations: SessionConfirmation[];
};
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

/** The transport's code=0 does not mean a migration was complete. */
export function readMigrationView(value: unknown): MigrationView {
  const report = object(value), details: MigrationDetail[] = [];
  const add = (value: unknown, stage = '') => {
    if (!Array.isArray(value)) return;
    for (const raw of value) {
      const item = object(raw);
      details.push({ stage: text(item.stage) || text(item.source) || stage, name: text(item.name),
        status: text(item.status), reason: text(item.reason) || (Array.isArray(item.reasons) ? item.reasons.filter(x => typeof x === 'string').join('; ') : '') });
    }
  };
  add(report.diagnostics);
  // Old backends return file details separately. Avoid displaying duplicates.
  if (!Array.isArray(report.diagnostics)) for (const key of ['decks', 'mods', 'plugins']) add(object(report[key]).details, key);
  const assets = object(report.assets);
  add(assets.preservedOnly, 'resources'); add(assets.unsupported, 'resources');
  for (const item of details) if (!item.status) item.status = 'preserved';
  const errors = Array.isArray(report.errors) ? report.errors : [];
  for (const raw of errors) {
    const item = object(raw), reason = text(item.reason);
    if (!details.some(x => x.status === 'failed' && x.reason === reason))
      details.push({ stage: text(item.stage), name: '', status: 'failed', reason });
  }
  if (text(report.error)) details.push({ stage: '', name: '', status: 'failed', reason: text(report.error) });
  const failed = report.ok === false || errors.length > 0 || details.some(x => x.status === 'failed');
  const sessionConfirmations: SessionConfirmation[] = [];
  if (Array.isArray(report.sessionConfirmations)) for (const raw of report.sessionConfirmations) {
    const item = object(raw), key = text(item.key);
    if (!/^[0-9a-f]{16}$/i.test(key) || !Array.isArray(item.candidates)) continue;
    const candidates = item.candidates.map(value => object(value)).map(candidate => ({
      id: text(candidate.id), code: text(candidate.code), name: text(candidate.name),
    })).filter(candidate => candidate.id.startsWith('legacy-') && candidate.id.length <= 256);
    if (candidates.length) sessionConfirmations.push({ key, file: text(item.file), name: text(item.name), candidates });
  }
  const review = sessionConfirmations.length > 0 || details.some(x => ['preserved', 'skipped', 'disabled', 'conflict'].includes(x.status));
  const priority = (status: string) => ['failed', 'conflict', 'disabled', 'preserved', 'skipped', 'warning', 'success', 'ignored'].indexOf(status);
  details.sort((a, b) => priority(a.status) - priority(b.status));
  return {
    status: failed ? 'failed' : report.complete === true && !review ? 'complete' : 'partial', details, sessionConfirmations,
    sessions: count(report.sessions), logs: count(report.logs), messages: count(report.logMessages),
    backupPath: text(report.backupPath), reportPath: text(report.reportPath), reloadRequired: report.reloadRequired === true,
  };
}
