// Dice!Next panel service worker.
// Purpose: browsers only offer their install prompt when a page has a service
// worker with a real fetch handler. This worker caches nothing: every request
// still goes to the live backend, so settings, logs and the admin API are never
// served stale. Only top-level page loads are handled, and only to show a short
// notice when the backend cannot be reached.
const OFFLINE_HTML = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Dice!Next</title>
<style>body{margin:0;display:grid;min-height:100vh;place-items:center;font:15px/1.6 system-ui,sans-serif;background:#fafbff;color:#1f2330}
@media (prefers-color-scheme:dark){body{background:#14151a;color:#e6e7ee}}main{max-width:28rem;padding:1.5rem;text-align:center}
button{margin-top:1rem;padding:.5rem 1.25rem;border-radius:.5rem;border:1px solid currentColor;background:none;color:inherit;font:inherit;cursor:pointer}</style>
</head><body><main><h1>无法连接到 Dice!Next</h1><p>请确认 Dice!Next 正在运行且网络可达。<br>Cannot reach the Dice!Next backend. Make sure it is running.</p>
<button onclick="location.reload()">重试 / Retry</button></main></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(OFFLINE_HTML, {
    status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })));
});
