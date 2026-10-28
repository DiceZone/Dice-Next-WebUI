// Test actual separately built bundles against isolated in-memory bot APIs.
// Never start or connect to the user's bot instance.
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startUiPreview } from '../ui-preview.mjs';

export default async function setup() {
  const fixture = await startUiPreview(43194);
  const current = JSON.parse(await readFile(new URL('../../src/webui-version.json', import.meta.url), 'utf8')).version;
  const roots = {
    v1: path.resolve(process.env.WEBUI_V1_DIST || fileURLToPath(new URL(current === 'v1' ? '../../dist' : '../../../Dice-Next-WebUI/dist', import.meta.url))),
    v2: path.resolve(process.env.WEBUI_V2_DIST || fileURLToPath(new URL(current === 'v2' ? '../../dist' : '../../../Dice-Next-WebUI-v2/dist', import.meta.url))),
  };
  let selected = 'v1', available = true, readOnly = false, failSave = false;
  const state = () => ({ selected, effective: selected === 'v2' && !available ? 'v1' : selected,
    legacy: false, available: { v1: true, v2: available } });
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1:43193');
      const reply = (data, code = 0, message = '') => {
        res.statusCode = code || 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ code, message, data }));
      };
      const body = async () => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
      if (url.pathname === '/__version-test') {
        if (req.method === 'POST') { const data = await body(); selected = data.selected || 'v1'; available = data.available !== false; readOnly = !!data.readOnly; failSave = !!data.failSave; }
        return reply(state());
      }
      if (url.pathname === '/api/system/webui-version') {
        if (req.method === 'PUT') {
          if (readOnly) return reply(null, 403, 'restricted');
          if (failSave) return reply(null, 500, '无法保存 WebUI 版本');
          const data = await body();
          if (!['v1', 'v2'].includes(data.version) || (data.version === 'v2' && !available)) return reply(null, 400, 'Unavailable');
          selected = data.version;
        }
        return reply(state());
      }
      if (url.pathname === '/api/auth/status') return reply({ required: false, need_setup: false, role: readOnly ? 'admin' : 'full' });
      if (url.pathname.startsWith('/api/')) {
        const upstream = await fetch(`http://127.0.0.1:43194${req.url}`);
        res.setHeader('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
        res.statusCode = upstream.status; res.end(await upstream.text()); return;
      }
      if (url.pathname === '/' || url.pathname === '/index.html') {
        res.writeHead(302, { Location: `./${state().effective}/${url.search}`, 'Cache-Control': 'no-store' }); res.end(); return;
      }
      const match = url.pathname.match(/^\/(v[12])\/(.*)$/);
      if (!match) { res.writeHead(404); res.end(); return; }
      const file = path.resolve(roots[match[1]], decodeURIComponent(match[2]) || 'index.html');
      if (!file.startsWith(roots[match[1]] + path.sep)) { res.writeHead(400); res.end(); return; }
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      res.end(await readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve) => server.listen(43193, '127.0.0.1', resolve));
  return async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await fixture.close(); };
}
