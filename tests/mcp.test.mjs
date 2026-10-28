import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MCP_TOOLS, emptyMcpGrant, mcpConnection, mcpEndpoint, mcpGrantPayload, mcpGrantState, mcpLines, mcpEditor, mcpEditorDirty, mcpAuditQuery, mcpServerNow, mcpExpiresSoon } from '../.test-dist/lib/mcp.js';
import { mcpCopy } from '../.test-dist/i18n/mcp.js';
import { MCP_READ_OPTIONS, mcpMutationOptions, mcpOperationId, mcpUncertain, mcpRecoverOperation } from '../.test-dist/lib/mcp.js';
import { ApiError, ApiTimeoutError } from '../.test-dist/lib/api-client.js';

test('MCP exposes only the four planned non-destructive tools', () => {
  assert.deepEqual(MCP_TOOLS, ['roll_dice', 'search_help', 'get_status', 'get_character_card']);
  const draft = emptyMcpGrant();
  assert.ok(!draft.tools.includes('get_character_card'));
  assert.ok(!draft.card_ids.length);
  assert.throws(() => mcpGrantPayload({ ...draft, tools: ['run_command'], name: 'client' }));
});
test('MCP card access is explicit and scoped to validated integer IDs', () => {
  const draft = { ...emptyMcpGrant(), name: ' client ', tools: ['get_character_card'], card_ids: [1, 1, 2] };
  assert.deepEqual(mcpGrantPayload(draft).card_ids, [1, 2]);
  assert.equal(mcpGrantPayload(draft).name, 'client');
  for (const ids of [[], [-1], [1.5], [2147483648]]) assert.throws(() => mcpGrantPayload({ ...draft, card_ids: ids }));
});
test('MCP validity and credential status are explicit', () => {
  for (const days of [0, 366, 1.5, NaN]) assert.throws(() => mcpGrantPayload({ ...emptyMcpGrant(), name: 'client', expires_days: days }));
  assert.equal(mcpGrantState({ enabled: true, expires_at: 20 }, 10000), 'active');
  assert.equal(mcpGrantState({ enabled: true, expires_at: 20 }, 20000), 'expired');
  assert.equal(mcpGrantState({ enabled: false, expires_at: 20 }, 10000), 'disabled');
  assert.equal(mcpGrantState({ enabled: true, expires_at: 20 }, null), 'clock_unknown');
  assert.equal(mcpGrantState({ enabled: false, requires_rotation: true, expires_at: 20 }, 10000), 'needs_rotation');
});
test('MCP expiry advances from server time, not the browser wall clock', () => {
  assert.equal(mcpServerNow(null, 100), null);
  assert.equal(mcpServerNow({ server: 0, received: 0 }, 100), null);
  assert.equal(mcpServerNow({ server: 1000000, received: NaN }, 100), null);
  const anchor = { server: 1000000, received: 500 };
  assert.equal(mcpServerNow(anchor, 1500), 1000001000);
  assert.equal(mcpServerNow(anchor, 200), 1000000000);
  const grant = { enabled: true, expires_at: 1000060 };
  assert.equal(mcpExpiresSoon(grant, 1000000000), true);
  assert.equal(mcpExpiresSoon(grant, null), false);
  assert.equal(mcpExpiresSoon({ ...grant, enabled: false }, 1000000000), false);
  assert.equal(mcpGrantState(grant, mcpServerNow(anchor, 61500)), 'expired');
});
test('MCP connection guide preserves reverse-proxy prefixes, never uses cookies or management keys', () => {
  const endpoint = mcpEndpoint({ origin: 'https://example.com', pathname: '/dice/index.html' });
  assert.equal(endpoint, 'https://example.com/dice/mcp');
  const connection = JSON.parse(mcpConnection(endpoint, 'dedicated-token'));
  assert.equal(connection.transport, 'streamable-http');
  assert.deepEqual(connection.headers, { Authorization: 'Bearer dedicated-token' });
  assert.match(mcpConnection(endpoint), /<MCP_TOKEN>/);
  for (const invalid of ['javascript:alert(1)', 'https://user:pass@example.com/mcp', 'https://example.com/mcp?token=x']) assert.throws(() => mcpConnection(invalid));
  assert.deepEqual(mcpLines(' dice.example.com\n\nd ice\r\ndice.example.com '), ['dice.example.com', 'd ice']);
});
test('MCP copy covers all supported languages with matching keys', () => {
  const keys = Object.keys(mcpCopy.en).sort();
  for (const [locale, copy] of Object.entries(mcpCopy)) {
    assert.deepEqual(Object.keys(copy).sort(), keys, locale);
    assert.ok(Object.values(copy).every((value) => typeof value === 'string' && value.length));
  }
});
test('MCP page uses styled dialogs, server-paginated audit and one-time in-memory secrets', () => {
  const page = fs.readFileSync(new URL('../src/pages/mcp-page.tsx', import.meta.url), 'utf8');
  assert.match(page, /mcpAuditQuery\(page, auditClient.id, auditOutcome\)/);
  assert.match(page, /setSecret\(null\)/);
  assert.doesNotMatch(page, /localStorage\.|sessionStorage\.|window\.alert\(|window\.confirm\(|<select\b/);
  assert.match(page, /FeatureHelp/);
  assert.match(page, /DropdownMenuItem/);
  assert.match(page, /DialogContent layout="editor"/);
  assert.match(page, /closeEditor\(\)/);
});
test('MCP edits preserve expiry unless renewed explicitly and do not mutate the original scope', () => {
  const grant = { ...emptyMcpGrant(), id: 'a'.repeat(24), name: 'client', created_at: 1, expires_at: 17 };
  const editor = mcpEditor(grant);
  assert.equal(editor.renew, false); assert.equal(mcpEditorDirty(editor), false);
  assert.equal('expires_days' in mcpGrantPayload(editor.draft, editor.renew), false);
  editor.draft.tools.push('get_character_card'); editor.draft.card_ids.push(7);
  assert.equal(mcpEditorDirty(editor), true); assert.ok(!grant.tools.includes('get_character_card')); assert.deepEqual(grant.card_ids, []);
  assert.equal(mcpGrantPayload(editor.draft, true).expires_days, 30);
  const fresh = mcpEditor(); assert.equal(fresh.renew, true); assert.equal(mcpEditorDirty(fresh), false);
});
test('MCP removing card tools drops hidden stale selections from the payload', () => {
  const payload = mcpGrantPayload({ ...emptyMcpGrant(), name: 'client', card_ids: [7, 99] });
  assert.deepEqual(payload.card_ids, []);
});
test('MCP audit requests include server-side filters on every page', () => {
  const id = 'a'.repeat(24);
  const url = new URL(mcpAuditQuery(3, id, 'denied'), 'https://dice.example');
  assert.equal(url.searchParams.get('page'), '3'); assert.equal(url.searchParams.get('pageSize'), '20');
  assert.equal(url.searchParams.get('client_id'), id); assert.equal(url.searchParams.get('outcome'), 'denied');
  assert.equal(mcpAuditQuery(1), '/system/mcp/audit?page=1&pageSize=20');
});
test('MCP requests have bounded waits and never blindly retry uncertain writes', () => {
  assert.equal(MCP_READ_OPTIONS.timeoutMs, 10000);
  const id = mcpOperationId(); assert.match(id, /^[0-9a-f]{32}$/); assert.notEqual(mcpOperationId(), id);
  assert.deepEqual(mcpMutationOptions(id), { timeoutMs: 20000, headers: { 'X-Dice-MCP-Request': 'webui', 'X-Dice-MCP-Operation-ID': id } });
  for (const error of [new ApiTimeoutError(), new ApiError(0, 'network'), new ApiError(503, 'busy'), new ApiError(409, 'received')]) assert.equal(mcpUncertain(error), true);
  for (const error of [new ApiError(400, 'bad input'), new ApiError(401, 'unauthorized'), new ApiError(403, 'forbidden')]) assert.equal(mcpUncertain(error), false);
  const page = fs.readFileSync(new URL('../src/pages/mcp-page.tsx', import.meta.url), 'utf8');
  assert.match(page, /operations\/\$\{pending.id\}/);
  assert.match(page, /const saving = requesting \|\| pending !== null/);
  assert.doesNotMatch(page, /setInterval|retry\(/);
});
test('MCP recovery never unlocks after failed state/config read-back or cancelled review', async () => {
  const offline = async () => { throw new Error('offline'); };
  let reads = 0, confirmations = 0;
  const read = async () => { ++reads; return { enabled: false, allow_remote: false, allowed_hosts: [], allowed_origins: [], grants: [], protocol_versions: ['2025-11-25'], local_endpoint: 'http://127.0.0.1:18088/mcp', audit_retention: 5000 }; };
  const confirm = async () => { ++confirmations; return false; };
  await assert.rejects(mcpRecoverOperation(offline, read, confirm), /offline/);
  assert.equal(reads, 0);
  for (const state of ['succeeded', 'unknown', 'failed']) {
    await assert.rejects(mcpRecoverOperation(async () => ({ state }), offline, confirm), /offline/);
  }
  assert.equal(confirmations, 0);
  assert.deepEqual(await mcpRecoverOperation(async () => ({ state: 'running' }), read, confirm), { state: 'pending' });
  assert.equal(reads, 0);
  assert.deepEqual(await mcpRecoverOperation(async () => ({ state: 'unknown' }), read, confirm), { state: 'cancelled' });
  assert.equal(reads, 1); assert.equal(confirmations, 1);
  const resolved = await mcpRecoverOperation(async () => ({ state: 'unknown' }), read, async () => true);
  assert.equal(resolved.state, 'resolved'); assert.equal(resolved.settings.enabled, false);
  await assert.rejects(mcpRecoverOperation(async () => ({ state: 'invalid' }), read, confirm), /mcp_response_invalid/);
  await assert.rejects(mcpRecoverOperation(async () => ({ state: 'succeeded' }), async () => '<html>bad proxy</html>', confirm), /mcp_response_invalid/);
  const page = fs.readFileSync(new URL('../src/pages/mcp-page.tsx', import.meta.url), 'utf8');
  const recovery = page.slice(page.indexOf('const checkPending'), page.indexOf('const save ='));
  assert.doesNotMatch(recovery, /refreshGrants/);
  assert.ok(recovery.indexOf('setSettings(fresh)') < recovery.indexOf('setPending(null)'));
});
test('MCP restored credentials cannot be enabled before explicit regeneration and backups explain this', () => {
  const editor = mcpEditor({ ...emptyMcpGrant(), id: 'a'.repeat(24), name: 'restored', enabled: false, created_at: 1, expires_at: 500, requires_rotation: true });
  assert.equal(editor.requires_rotation, true); assert.equal(editor.draft.enabled, false);
  const page = fs.readFileSync(new URL('../src/pages/mcp-page.tsx', import.meta.url), 'utf8');
  assert.match(page, /disabled=\{saving \|\| editor.requires_rotation\}/);
  assert.match(page, /settings\?\.restored_access_reset/);
  const backup = fs.readFileSync(new URL('../src/pages/backup-page.tsx', import.meta.url), 'utf8');
  assert.equal((backup.match(/t\('mcp.restore_backup_hint'\)/g) || []).length, 2);
});
