// In-memory examples only. Never reads a config file or connects to a bot.
export function createMcpPreview() {
  const epoch = Date.parse('2030-01-01T00:00:00Z') / 1000;
  const token = `dnmcp_${'f'.repeat(64)}`; // Deliberately fake, fixture-only credential.
  let sequence = 12;
  let config = { enabled: true, allow_remote: false, allowed_hosts: [], allowed_origins: [] };
  let grants = Array.from({ length: 12 }, (_, i) => ({
    id: (i + 1).toString(16).padStart(24, '0'), name: `浏览器演示 ${i + 1}`, enabled: i !== 3,
    tools: i ? ['get_status'] : ['get_status', 'get_character_card'], card_ids: i ? [] : [7, 8, 99],
    created_at: epoch - 86400, expires_at: epoch + (i === 1 ? -60 : 2 * 86400), requires_rotation: i === 3,
    last_used_at: i ? null : epoch - 60,
  }));
  const operations = new Map();
  const rows = Array.from({ length: 37 }, (_, i) => ({
    id: 37 - i, created_at: epoch - i * 60, client_id: grants[i % 2].id, client_name: grants[i % 2].name,
    operation: 'get_status', outcome: i % 3 ? 'success' : 'denied', message: i % 3 ? '处理成功（演示数据）' : '该工具未获授权（演示数据）',
  }));
  const cards = [
    { card_id: 7, user_id: '演示用户 A', name: '调查员·随春生', state: 'available' },
    { card_id: 8, user_id: '演示用户 B', name: '所有者已变化的卡', state: 'owner_changed' },
    { card_id: 99, state: 'unavailable' },
  ];
  return (method, path, url, body = {}, operationId = '') => {
    const record = (action, grant) => {
      if (operationId) operations.set(operationId, { state: 'succeeded', action, grant_id: grant?.id });
    };
    if (path === '/system/mcp' && method === 'GET') return { ...config, grants: structuredClone(grants),
      server_time: epoch, usage_available: true, protocol_versions: ['2026-07-28', '2025-11-25', '2025-06-18'],
      local_endpoint: 'http://127.0.0.1:18088/mcp', audit_retention: 5000 };
    if (path === '/system/mcp' && method === 'PUT') { config = { ...config, ...body }; record('configure'); return config; }
    if (path === '/system/mcp/card-options') return cards.filter((card) => card.state === 'available' &&
      `${card.name} ${card.user_id}`.includes(url.searchParams.get('q') || '')).map(({ state: _state, ...card }) => card);
    if (path === '/system/mcp/card-details') return cards.filter((card) => body.card_ids.includes(card.card_id));
    if (path === '/system/mcp/audit') {
      const items = rows.filter((row) => (!url.searchParams.get('client_id') || row.client_id === url.searchParams.get('client_id')) &&
        (!url.searchParams.get('outcome') || row.outcome === url.searchParams.get('outcome')));
      const pageSize = 20, page = Math.max(1, Math.min(Number(url.searchParams.get('page') || 1), Math.ceil(items.length / pageSize)));
      return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
    }
    if (path.startsWith('/system/mcp/operations/')) return operations.get(path.split('/').at(-1)) || { state: 'unknown' };
    if (path === '/system/mcp/self-check') {
      const checks = [{ name: 'service', state: config.enabled ? 'pass' : 'fail', detail: config.enabled ? 'enabled' : 'not_enabled' },
        { name: 'audit', state: 'pass', detail: 'audit_ready' }, { name: 'grants', state: 'pass', detail: 'grants_ready' }];
      const valid = body.token === token;
      checks.push({ name: 'credential', state: !body.token ? 'skip' : valid ? 'pass' : 'fail', detail: !body.token ? 'token_not_supplied' : valid ? 'protocol_ready' : 'credential_invalid' });
      if (body.tool) checks.push({ name: 'tool', state: valid ? (body.tool === 'get_status' ? 'pass' : 'fail') : 'skip',
        detail: valid ? (body.tool === 'get_status' ? 'tool_allowed' : 'tool_denied') : 'credential_not_checked' });
      return { scope: 'local_protocol', server_time: epoch, checks, tools: valid ? ['get_status'] : [] };
    }
    if (path === '/system/mcp/grants' && method === 'POST') {
      const grant = { ...body, id: (++sequence).toString(16).padStart(24, '0'), created_at: epoch,
        expires_at: epoch + body.expires_days * 86400, requires_rotation: false };
      grants.push(grant); record('create', grant); return { ...grant, token };
    }
    const match = path.match(/^\/system\/mcp\/grants\/([^/]+)(\/rotate)?$/);
    if (match) {
      const grant = grants.find((item) => item.id === match[1]);
      if (!grant) throw new Error('演示凭据不存在');
      if (match[2]) { record('rotate', grant); return { ...grant, token }; }
      if (method === 'DELETE') { grants = grants.filter((item) => item.id !== grant.id); record('revoke', grant); return {}; }
      Object.assign(grant, body); record('update', grant); return structuredClone(grant);
    }
    throw new Error('Unsupported MCP preview request');
  };
}
