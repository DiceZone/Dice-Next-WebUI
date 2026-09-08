// Local-only empty-install fixture. Never connects to a real Dice backend.
// Run npm run test:tour-preview, then open http://127.0.0.1:5173.
import { createServer } from 'vite';

const requests = [];
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
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
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
