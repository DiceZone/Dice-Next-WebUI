// Isolated manual UI fixture: npm run build, then node tests/preview-cloud-settings.mjs.
// Serves only synthetic in-memory data. Never connects to a running Dice!Next server.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const adapters = [
  { id: '1', name: '测试骰娘 · OneBot', type: 'onebot_v11', connectionMode: 'forward_ws', endpoint: 'ws://fixture.invalid', enabled: true, status: 'connected', loginId: '10001', loginName: '测试账号', heartApiKeyConfigured: true, heartApiKeyTail: '1234' },
  { id: '2', name: '测试骰娘 · QQ 官方', type: 'qq_official', connectionMode: 'forward_ws', endpoint: '', enabled: false, status: 'disconnected', appId: 'fixture-app', heartApiKeyConfigured: false },
];
const state = {
  '/api/auth/status': { required: false, authed: true },
  '/api/system/timezone': { offset_minutes: 480, effective_offset_minutes: 480 },
  '/api/system/heartbeat': { enabled: false, url: 'https://heart.dice.zone', public_show: true, interval: 300, master_nickname: '', master_qq: '', master_source: 'none', last_status: 'unknown' },
  '/api/system/cloudban': { enabled: false, url: 'https://cloudban.dice.zone', token_set: false, token_tail: '', share: false, min_danger: 2, sync_interval: 21600, cursor: '', last_sync_at: '' },
  '/api/system/logsite': { url: 'https://log.fixture.invalid', official: 'https://log.fixture.invalid', format: 'dicenext' },
  '/api/system/global': { values: { image_host: { mode: 'none', file_field: 'file', result_path: 'data.url' } }, overrides: {}, sources: {} },
  '/api/masters': { items: [] }, '/api/groups': [], '/api/players': [], '/api/banlist': { entries: [] },
};
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://127.0.0.1').pathname;
  try {
    if (path.startsWith('/api/')) {
      let body = ''; for await (const part of req) body += part;
      const patch = body ? JSON.parse(body) : {};
      const adapterId = path.match(/^\/api\/adapters\/(\d+)$/)?.[1];
      let data;
      if (path === '/api/adapters') data = adapters;
      else if (adapterId && req.method === 'PUT') {
        if (Object.keys(patch).join(',') !== 'heartApiKey') throw new Error('Fixture requires a key-only update');
        data = adapters.find((adapter) => adapter.id === adapterId);
        if (!data) throw new Error('Unknown fixture adapter');
        data.heartApiKeyConfigured = !!patch.heartApiKey;
        data.heartApiKeyTail = patch.heartApiKey.slice(-4);
        console.log('Key-only update verified for fixture adapter ' + adapterId);
      } else if (req.method === 'PUT') {
        state[path] = { ...state[path], ...patch }; data = state[path];
      } else if (path === '/api/system/cloudban/sync') data = { added: 0, removed: 0 };
      else if (path === '/api/system/heartbeat/test') data = { body: { results: [] } };
      else data = state[path] ?? {};
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 0, message: 'fixture', data }));
      return;
    }
    const target = resolve(root, '.' + decodeURIComponent(path === '/' ? '/index.html' : path));
    if (!target.startsWith(resolve(root) + sep)) throw new Error('Invalid path');
    let data = await readFile(target);
    if (extname(target) === '.html') {
      data = Buffer.from(data.toString().replace('<body>', '<body><div style="position:fixed;bottom:8px;right:8px;z-index:99999;background:#fef3c7;color:#78350f;border:1px solid #f59e0b;padding:8px 12px;border-radius:8px;font:12px sans-serif">隔离测试预览 · 模拟数据 · 请勿输入真实密钥</div>'));
    }
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }[extname(target)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime }); res.end(data);
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 1, message: error.message }));
  }
}).listen(43129, '127.0.0.1', () => console.log('Isolated cloud UI fixture: http://127.0.0.1:43129/#/cloud-services'));
