import { panelBase } from './sso.js';
import { ApiError } from './api-client.js';

export const MCP_READ_OPTIONS = { timeoutMs: 10000 };
export const MCP_CHECK_OPTIONS = { ...MCP_READ_OPTIONS, headers: { 'X-Dice-MCP-Request': 'webui' } };
export function mcpMutationOptions(id: string) {
  return { timeoutMs: 20000, headers: { 'X-Dice-MCP-Request': 'webui', 'X-Dice-MCP-Operation-ID': id } };
}
export function mcpOperationId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export const mcpUncertain = (error: unknown): boolean => error instanceof ApiError &&
  (error.code === 0 || error.code === 408 || error.code === 409 || error.code >= 500);
export interface McpOperation {
  state: 'unknown' | 'queued' | 'running' | 'succeeded' | 'failed';
  action?: string; grant_id?: string; warnings?: string[];
}
// Resolve an uncertain mutation without replaying it. A failed read-back must
// propagate: the caller must retain its pending lock and original draft.
export async function mcpRecoverOperation(
  readOperation: () => Promise<McpOperation>, readSettings: () => Promise<McpSettings>,
  confirmUnknown: () => Promise<boolean>,
): Promise<{ state: 'pending' } | { state: 'cancelled' } | { state: 'resolved'; operation: McpOperation; settings: McpSettings }> {
  const operation = await readOperation();
  if (!operation || !['unknown', 'queued', 'running', 'succeeded', 'failed'].includes(operation.state)) throw new Error('mcp_response_invalid');
  if (operation.state === 'queued' || operation.state === 'running') return { state: 'pending' };
  const settings = await readSettings();
  const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
  if (!settings || typeof settings.enabled !== 'boolean' || typeof settings.allow_remote !== 'boolean' ||
    !strings(settings.allowed_hosts) || !strings(settings.allowed_origins) || !strings(settings.protocol_versions) ||
    typeof settings.local_endpoint !== 'string' || !Array.isArray(settings.grants) || settings.grants.some((grant) =>
      !grant || typeof grant.id !== 'string' || typeof grant.name !== 'string' || typeof grant.enabled !== 'boolean' ||
      !strings(grant.tools) || !Array.isArray(grant.card_ids) || !grant.card_ids.every(Number.isSafeInteger) ||
      !Number.isFinite(grant.created_at) || !Number.isFinite(grant.expires_at))) throw new Error('mcp_response_invalid');
  if (operation.state === 'unknown' && !await confirmUnknown()) return { state: 'cancelled' };
  return { state: 'resolved', operation, settings };
}

export const MCP_TOOLS = ['roll_dice', 'search_help', 'get_status', 'get_character_card'] as const;
export type McpToolName = typeof MCP_TOOLS[number];
export interface McpGrant {
  id: string; name: string; enabled: boolean; tools: McpToolName[]; card_ids: number[];
  created_at: number; expires_at: number;
  requires_rotation?: boolean;
  last_used_at?: number | null;
}
export interface McpConfig {
  enabled: boolean; allow_remote: boolean; allowed_hosts: string[]; allowed_origins: string[];
}
export interface McpSettings extends McpConfig {
  grants: McpGrant[]; protocol_versions: string[]; local_endpoint: string; audit_retention: number;
  restored_access_reset?: boolean;
  server_time?: number; usage_available?: boolean;
}
export interface McpCard { card_id: number; user_id: string; name: string; }
export interface McpCardSummary { card_id: number; user_id?: string; name?: string; state: 'available' | 'unavailable' | 'owner_changed'; }
export interface McpSelfCheck {
  scope: 'local_protocol'; server_time: number; tools: McpToolName[];
  checks: { name: 'service' | 'audit' | 'grants' | 'credential' | 'tool'; state: 'pass' | 'fail' | 'skip'; detail: string }[];
}
export interface McpClock { server: number; received: number; }
// Anchor to server time and advance with a monotonic clock. Browser wall-clock
// changes must not silently reactivate an expired credential in the UI.
export function mcpServerNow(clock: McpClock | null, steady: number): number | null {
  if (!clock || !Number.isFinite(clock.server) || clock.server <= 0 || !Number.isFinite(clock.received) || !Number.isFinite(steady)) return null;
  return clock.server * 1000 + Math.max(0, steady - clock.received);
}
export function mcpExpiresSoon(grant: McpGrant, at: number | null): boolean {
  return at !== null && mcpGrantState(grant, at) === 'active' && grant.expires_at * 1000 - at <= 7 * 86400000;
}
export interface McpAudit {
  id: number; created_at: number; client_id: string; client_name: string; operation: string; outcome: string; message: string;
}
export interface McpAuditPage { items: McpAudit[]; total: number; page: number; pageSize: number; }
export interface McpGrantDraft {
  name: string; enabled: boolean; tools: McpToolName[]; card_ids: number[]; expires_days: number;
}
export type McpGrantPayload = Omit<McpGrantDraft, 'expires_days'> & { expires_days?: number };
export interface McpEditor { id?: string; expires_at?: number; requires_rotation?: boolean; draft: McpGrantDraft; renew: boolean; baseline: string; }
export type McpOutcome = '' | 'success' | 'denied' | 'error';
export const emptyMcpGrant = (): McpGrantDraft => ({
  name: '', enabled: true, tools: ['roll_dice', 'search_help', 'get_status'], card_ids: [], expires_days: 30,
});
export function mcpEditor(grant?: McpGrant): McpEditor {
  const draft = grant ? { name: grant.name, enabled: grant.enabled, tools: [...grant.tools], card_ids: [...grant.card_ids], expires_days: 30 } : emptyMcpGrant();
  const renew = !grant;
  return { id: grant?.id, expires_at: grant?.expires_at, requires_rotation: grant?.requires_rotation, draft, renew, baseline: JSON.stringify({ draft, renew }) };
}
export const mcpEditorDirty = (editor: McpEditor | null): boolean => !!editor &&
  JSON.stringify({ draft: editor.draft, renew: editor.renew }) !== editor.baseline;
export function mcpAuditQuery(page: number, clientId = '', outcome: McpOutcome = ''): string {
  const query = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (clientId) query.set('client_id', clientId);
  if (outcome) query.set('outcome', outcome);
  return `/system/mcp/audit?${query}`;
}
export function mcpEndpoint(location?: Partial<Pick<Location, 'origin' | 'pathname'>>): string {
  return `${panelBase(location ?? (typeof window === 'undefined' ? {} : window.location))}/mcp`;
}
export function mcpConnection(endpoint: string, token?: string): string {
  const url = new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.search)
    throw new Error('Invalid MCP endpoint');
  return JSON.stringify({ transport: 'streamable-http', url: url.toString(),
    headers: { Authorization: `Bearer ${token || '<MCP_TOKEN>'}` } }, null, 2);
}
export function mcpGrantPayload(draft: McpGrantDraft, renew = true): McpGrantPayload {
  const name = draft.name.trim();
  if (!name || new TextEncoder().encode(name).length > 100 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('name');
  if (!draft.tools.length || draft.tools.some((tool) => !MCP_TOOLS.includes(tool))) throw new Error('tools');
  const card_ids = draft.tools.includes('get_character_card') ? [...new Set(draft.card_ids)] : [];
  if (card_ids.length > 100 || card_ids.some((id) => !Number.isSafeInteger(id) || id < 1 || id > 2147483647)) throw new Error('cards');
  if (draft.tools.includes('get_character_card') && !card_ids.length) throw new Error('cards');
  if (renew && (!Number.isInteger(draft.expires_days) || draft.expires_days < 1 || draft.expires_days > 365)) throw new Error('expiry');
  return { name, enabled: draft.enabled, tools: [...new Set(draft.tools)], card_ids, ...(renew ? { expires_days: draft.expires_days } : {}) };
}
export const mcpLines = (value: string): string[] => [...new Set(value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
export const mcpGrantState = (grant: McpGrant, at: number | null): 'needs_rotation' | 'disabled' | 'expired' | 'active' | 'clock_unknown' =>
  grant.requires_rotation ? 'needs_rotation' : !grant.enabled ? 'disabled' : at === null ? 'clock_unknown' : grant.expires_at * 1000 <= at ? 'expired' : 'active';
