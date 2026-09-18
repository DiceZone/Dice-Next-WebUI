// Local-only empty-install fixture. Never connects to a real Dice backend.
// Run npm run test:tour-preview, then open http://127.0.0.1:5173.
import { createServer } from 'vite';

const requests = [];
// Optional synthetic import response for migration-report UI checks. No files,
// backend, or external accounts are read/written even when this flag is enabled.
const referencePreview = process.env.DICENEXT_PREVIEW_REPLY_REPORT === '1';
const referenceReport = {
  converted: 1, ambiguous: 1, unresolved: 1,
  details: [
    { rule: '演示规则', field: 'results[0]', reference: '{演示牌堆}', status: 'converted', reason: 'unique_reference_type', target: '{deck:演示牌堆}' },
    { rule: '演示规则', field: 'results[1]', reference: '{同名资源}', status: 'ambiguous', reason: 'multiple_reference_types', target: '' },
    { rule: '演示规则', field: 'cooldownNotice', reference: '{未安装资源}', status: 'unresolved', reason: 'reference_not_found', target: '' },
  ],
};
const emptyData = {
  '/auth/status': { required: false, need_setup: false },
  '/dashboard/stats': { uptime_seconds: 0, active_connections: 0, total_adapters: 0, total_commands: 0, total_rules: 0, active_sessions: 0, recent_logs: [] },
  '/system/sysinfo': {}, '/system/ai': {}, '/system/notice': {},
  '/statistics/overview': null,
  '/help': { entries: [], total: 0 }, '/help/groups': { groups: [] },
  '/rules': { packs: [] }, '/rulepacks': { bundles: [] },
  '/friends': { lists: {}, deletePlatforms: [], officialRealFriends: [] },
  '/banlist': { entries: [] },
  '/backup/config': { enabled: false, schedule: 'interval', intervalHours: 24, dailyTime: '04:00', keepDays: 7, lastAutoAt: 0 },
  '/system/status': { version: 'test-only', buildNumber: 0 },
};
const server = await createServer({
  server: { host: '127.0.0.1', port: Number(process.env.DICENEXT_PREVIEW_PORT || 5173), strictPort: true },
  plugins: [{
    name: 'empty-install-fixture',
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        const path = new URL(req.url, 'http://localhost').pathname;
        if (path === '/__tour-test/requests') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(requests)); return;
        }
        if (!path.startsWith('/api/')) return next();
        requests.push({ method: req.method, path });
        res.setHeader('Content-Type', 'application/json');
        if (referencePreview && path === '/api/legacy/import' && req.method === 'POST') {
          res.end(JSON.stringify({ code: 0, data: { cards: 0, profiles: 0, blacklist: 0, replies: 1, help: 0, msgs: 0,
            masters: 0, decks: 0, mods: 0, replyReferences: referenceReport } })); return;
        }
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end(JSON.stringify({ code: 405, message: 'Read-only test fixture' })); return;
        }
        const key = path.slice(4);
        res.end(JSON.stringify({ code: 0, message: 'success', data: Object.hasOwn(emptyData, key) ? emptyData[key] : key.startsWith('/system/') ? {} : [] }));
      });
    },
  }],
});
await server.listen();
server.printUrls();
