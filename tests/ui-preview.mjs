// Opt-in local preview of the real React pages. Data lives only in this process;
// no backend proxy, bot connection, filesystem writes or external requests.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const sampleModule = await transform(await readFile(new URL('../src/lib/tour-samples.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'esm' });
const { tourSamples } = await import('data:text/javascript;base64,' + Buffer.from(sampleModule.code).toString('base64'));
const previewGroups = structuredClone(tourSamples.groups);
previewGroups[1].accounts = [{ ...previewGroups[0].accounts[0], adapterId: 'preview-onebot', adapterName: '月海 · 预览', endpointId: previewGroups[1].groupId }];
previewGroups.push({ ...structuredClone(previewGroups[1]), platform: 'qq_official', groupId: 'demo-official', name: '官方测试群 · 示例', accounts: [{ ...previewGroups[1].accounts[0], adapterId: 'preview-qq', adapterName: '星灯 · 预览', platform: 'qq_official', endpointId: 'demo-official' }] });
const previewPlayers = structuredClone(tourSamples.players);
if (process.env.DICENEXT_UI_PREVIEW_PAGINATION === '1') {
  for (let i = previewPlayers.length; i < 111; i++) previewPlayers.push({ ...previewPlayers[0], userId: `demo-player-${i + 1}`, nickname: `分页玩家 ${i + 1}`, trustLevel: 0 });
  for (let i = previewGroups.length; i < 91; i++) previewGroups.push({ ...previewGroups[1], groupId: `demo-group-${i + 1}`, name: `分页群组 ${i + 1}`, accounts: [] });
}
const previewTasks = [
  ...structuredClone(tourSamples.tasks),
  { ...tourSamples.tasks[0], id: 2, name: '每小时提醒 · 示例', triggerType: 'interval', intervalMin: 60 },
  { ...tourSamples.tasks[0], id: 3, name: '单次提醒 · 示例', triggerType: 'once', onceDate: '2026-10-01', enabled: false },
];
let nextTaskId = 4;

const deckFiles = new Map(Object.entries({
  'journey.json': { _title: ['旅途奇遇集'], _author: ['Dice!Next · 预览样例'], _version: ['2.1'], _date: ['2026-09-21'], _brief: ['让每一次启程都有故事。\n森林、城镇与旅途中的随机灵感，适合在跑团间隙即兴使用。'], 森林奇遇: ['::3::一只白鹿停在林间，似乎在等你跟上。', '古老的树洞里藏着一封未寄出的信。', '溪流在这里分成两股，分别流向不同的季节。', '一位采药人向你打听{_旅人姓名}的下落。', '苔藓覆盖的石碑上，刻着队伍中某个人的名字。'], 酒馆传闻: ['北方的钟楼昨夜响了十三次。', '船长愿意用一张地图换你的故事。'], 旅途天气: ['晴朗，微风。', '::2::绵绵细雨，远处的山脊隐入云雾。'], _旅人姓名: ['艾琳', '灰雀', '莫里斯'] },
  'investigation.json': { _title: ['调查员的口袋笔记'], _author: ['Dice!Next · 预览样例'], _version: ['1.3'], _brief: ['线索、怪异征兆与旧报纸上的故事。为调查员准备的即时素材。'], 神秘线索: ['一张日期属于明天的车票。', '笔迹完全相同的两份遗书，落款却相隔百年。', '收音机里传来你刚刚说过的话。'], 怪异征兆: ['门后的脚步声始终与你保持同步。'], 旧报纸: ['本市新建天文台将于下月开放。'] },
  'tavern.json': { _title: ['黄昏酒馆'], _author: ['Dice!Next · 预览样例'], _version: ['1.0'], _brief: ['来一杯吗？从酒单到委托，为你的酒馆填满生活气息。'], 今日特饮: ['蜂蜜苹果酒', '松针与月光', '薄荷气泡水'], 酒馆委托: ['找回失踪的猫。\n报酬：三晚免费住宿。', '护送商队前往北方集市。'], 酒馆客人: ['穿着雨衣的说书人', '不肯摘下手套的旅客'] },
  'names.json': { _title: ['名字与地名'], _author: ['Dice!Next · 预览样例'], _brief: ['短名字，大世界。'], 城镇名: ['晨雾镇', '白石港', '风铃谷', '落星城'], 人物名: Array.from({ length: 67 }, (_, i) => `旅人 ${i + 1}`) },
} ).map(([name, content]) => [name, JSON.stringify(content, null, 2)]));
const state = {
  '/groups': previewGroups, '/players': previewPlayers, '/schedules': previewTasks,
  '/statistics/overview': tourSamples.statistics,
  '/friends': { lists: {}, deletePlatforms: [], officialRealFriends: [] },
  '/platform-caps': {},
  '/system/audit': { items: [2, 4, 8, 1].map((level) => ({
    ts: '2026-09-29 12:34:56', level, op: 'update_available', origin: '',
    msg: '本地预览：检测到新版本，当前版本可继续使用。'.repeat(5) + ' https://example.invalid/releases/' + 'long-version-name-'.repeat(8),
  })) },
  '/auth/status': { required: false, need_setup: false },
  '/system/status': { version: 'local-ui-preview', buildNumber: 0 },
  '/dashboard/stats': { uptime_seconds: 3600, active_connections: 0, total_adapters: 2, total_commands: 0, total_rules: 0, active_sessions: 0, recent_logs: [] },
  '/adapters': [{ id: 'preview-qq', name: '星灯 · 预览', type: 'qq_official', appId: 'preview', enabled: false }, { id: 'preview-onebot', name: '月海 · 预览', type: 'onebot_v11', loginId: '10000', enabled: false }],
  '/masters': { items: [{ platform: 'onebot_v11', id: '10001', nickname: '示例骰主' }], master_inherit: true },
  '/system/prefixes': { prefixes: ['.', '。'] }, '/system/timezone': { offset_minutes: 480, effective_offset_minutes: 480 },
  '/system/global': { values: { message_format: 'standard', respond_group: true, respond_private: true, save_log_images: false, chat_retention_days: 7 }, overrides: {}, sources: {} },
  '/system/expression-engine': { mode: 'enhanced', order: ['dicemaid', 'sealdice', 'dicepp'], overrides: {}, sources: {} },
  '/system/events': { friend_policy: 'manual', group_invite_policy: 'whitelist', group_invite_reject_blacklist: true, welcome_min_delay: 2, welcome_min_cooldown: 30, overrides: {}, sources: {} },
  '/system/censor': { enabled: false, rules: [] }, '/system/friend-clean': { days: 0, groupLimit: 0, maxGroupSize: 0 },
  '/system/identity-email': { enabled: false, host: '', port: 465, ssl: true, user: '', from: '', password_configured: false },
  '/system/nick-wrap': { prefix: '<', suffix: '>' }, '/system/reply-segment': { enabled: true, len: 600 },
};
const writable = new Set(['/system/prefixes', '/system/timezone', '/system/plugin-verify', '/system/js-fetch', '/system/autostart', '/system/quote-reply', '/system/auto-card', '/system/respond-self', '/system/forward-long', '/system/reply-segment', '/system/nick-wrap', '/system/censor', '/system/friend-clean', '/system/identity-email']);
const overrides = new Map();
const requests = [];
const helpDefaults = [
  { key: '掷骰', source: 'builtin', editable: true, i18nKey: 'help.topic.roll', content: '掷骰入门\n\n.r 1d100  // 投掷百分骰\n.r 2d6+3  // 带加值的掷骰\n\n使用 .help 掷骰 查看完整用法。' },
  { key: '跑团入门', source: 'file:跑团入门', editable: true, content: '欢迎来到星灯跑团小站\n\n1. 使用 .pc new 创建人物卡\n2. 使用 .st 录入属性\n3. 开始冒险，与伙伴一起讲述故事。' },
  { key: '天气', source: 'plugin:旅途助手', editable: false, content: '天气助手\n\n.weather 城市名\n\n这份说明由插件提供，请在插件配置中修改。' },
];
const helpDocs = structuredClone(helpDefaults);
if (process.env.DICENEXT_UI_PREVIEW_PAGINATION === '1') {
  for (let i = helpDocs.length; i < 181; i++) helpDocs.push({ key: `分页帮助 ${i + 1}`, source: `file:分页帮助-${i + 1}.md`, editable: true, content: `第 ${i + 1} 条本地分页样例。` });
}
const commandReply = { key: 'dice.roll.result', default: '**{nick}** 掷出了 {expr} = **{result}**', override: null, format: 'markdown', defaultFormat: 'markdown', vars: [{ name: 'expr', desc: '掷骰表达式' }, { name: 'result', desc: '掷骰结果' }] };
const commandCategories = [
  ['sc', 'COC', '理智检定'], ['br', 'BRP', 'BRP 检定'], ['dnd', 'DND', 'DND 检定'],
  ['st', '人物卡', '属性管理'], ['draw', '牌堆', '抽取牌堆'], ['log', '跑团', '跑团日志'],
  ['jrrp', '娱乐', '今日人品'], ['bot', '互动', '骰娘互动'], ['ai', 'AI', 'AI 对话'],
  ['help', '工具', '帮助'], ['master', '权限', '骰主权限'], ['group', '管理', '群管理'], ['system', '系统', '系统状态'],
].map(([cmd, category, title]) => ({ cmd, title, category, sources: ['core'], example: `.${cmd}`, desc: `${title} · 本地预览样例`, replies: [] }));
const replyRules = [
  { id: 'preview-1', conditions: [{ type: 'keyword', content: '早安' }], logic: 'or', results: ['早安，{nick}！今天也有新的冒险在等你。'], resultWeights: [1], matchType: 'keyword', matchContent: '早安', replyContent: '早安，{nick}！今天也有新的冒险在等你。', enabled: true, priority: 100, prob: 80, cooldownSec: 30 },
  { id: 'preview-2', conditions: [{ type: 'prefix', content: '讲个故事' }, { type: 'search', content: '酒馆' }], logic: 'and', results: ['酒馆老板低声说起那座旧钟楼。', '桌上的地图忽然自己翻到了北方。'], resultWeights: [2, 1], matchType: 'prefix', matchContent: '讲个故事', replyContent: '酒馆老板低声说起那座旧钟楼。', enabled: false, priority: 80, prob: 100, cooldownSec: 0 },
];
let nextReplyId = replyRules.length + 1;
const listDecks = () => [...deckFiles].map(([filename, content], index) => {
  const data = JSON.parse(content);
  const keys = Object.keys(data).filter((key) => Array.isArray(data[key]) && data[key].some((value) => typeof value === 'string'));
  return { id: index + 1, filename, title: data._title?.[0] || filename, author: data._author?.[0], version: data._version?.[0], date: data._date?.[0], description: data._brief?.[0], entries: keys.filter((key) => !key.startsWith('_')), hidden_entries: keys.filter((key) => key.startsWith('_')) };
});

const server = await createServer({
  configFile: false,
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  server: { host: '127.0.0.1', port: Number(process.env.DICENEXT_UI_PREVIEW_PORT || 5173), strictPort: true },
  plugins: [react(), {
    name: 'isolated-ui-preview',
    transformIndexHtml() {
      return [{ tag: 'script', children: `if(!localStorage.getItem('dice-lang'))localStorage.setItem('dice-lang','zh-Hans');`, injectTo: 'head-prepend' },
        { tag: 'div', attrs: { style: 'position:fixed;right:16px;bottom:12px;z-index:40;border:1px solid #c7d2fe;background:#eef2ff;color:#4338ca;padding:6px 12px;border-radius:20px;font:11px system-ui;pointer-events:none' }, children: '本地预览 · 临时数据 · 不连接机器人', injectTo: 'body' }];
    },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/__ui-preview/requests') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(requests)); return; }
        if (!url.pathname.startsWith('/api/')) return next();
        const path = url.pathname.slice(4);
        requests.push({ method: req.method, path });
        res.setHeader('Content-Type', 'application/json');
        const reply = (data, extra = {}) => res.end(JSON.stringify({ code: 0, data, ...extra }));
        try {
          let body = {};
          if (req.method !== 'GET') {
            const chunks = []; for await (const chunk of req) chunks.push(chunk);
            const text = Buffer.concat(chunks).toString(); body = text ? JSON.parse(text) : {};
          }
          if (path === '/commands') return reply([{ cmd: 'r', title: '掷骰', category: '掷骰', sources: ['core'], example: '.r 1d100', desc: '投掷骰子，支持表达式与原因。', replies: [commandReply] }, ...commandCategories]);
          if (path === '/schedules' && req.method === 'POST') { const task = { ...body, id: nextTaskId++, lastRun: '' }; previewTasks.push(task); return reply(task); }
          if (/^\/schedules\/\d+$/.test(path)) {
            const index = previewTasks.findIndex((task) => task.id === Number(path.split('/').at(-1)));
            if (index < 0) throw new Error('Task not found');
            if (req.method === 'PUT') { Object.assign(previewTasks[index], body); return reply(previewTasks[index]); }
            if (req.method === 'DELETE') { previewTasks.splice(index, 1); return reply(null); }
          }
          if (/^\/players\/[^/]+\/[^/]+\/detail$/.test(path)) return reply({
            groups: [{ id: 'demo-group', name: '周末调查团 · 示例' }],
            cards: [{ id: 1, name: '调查员', attrs: { 力量: 50, 敏捷: 60, HP: 12 }, bound: [], updatedAt: '2026-09-01' }],
            settings: [], luaVars: [], luaCards: [], lastMessageAt: 1788264000,
          });
          if (/^\/groups\/[^/]+\/[^/]+$/.test(path) && req.method === 'PUT') {
            const [, , platform, groupId] = path.split('/');
            const group = previewGroups.find((g) => g.platform === platform && g.groupId === groupId);
            if (!group) throw new Error('Group not found');
            const account = group.accounts?.find((a) => a.adapterId === body.adapterId);
            Object.assign(account || group, body); if (account === group.accounts?.[0]) Object.assign(group, body);
            return reply({});
          }
          if (path === '/templates/preview') return reply({ markdown: body.text, onebot: body.text.replace(/\*\*/g, '') });
          if (path === '/templates' && req.method === 'PUT') {
            const help = helpDocs.find((entry) => entry.i18nKey === body.key);
            if (help) help.content = body.value;
            else if (body.key === commandReply.key) { commandReply.override = body.value; commandReply.format = body.format; }
            return reply(null);
          }
          if (path.startsWith('/templates/') && req.method === 'DELETE') {
            const key = decodeURIComponent(path.split('/').at(-1));
            const help = helpDocs.find((entry) => entry.i18nKey === key);
            if (help) help.content = helpDefaults.find((entry) => entry.i18nKey === key).content;
            else if (key === commandReply.key) { commandReply.override = null; commandReply.format = commandReply.defaultFormat; }
            return reply(null);
          }
          if (path === '/help' || path === '/help/groups') {
            const query = (url.searchParams.get('q') || '').toLowerCase();
            const seen = new Set();
            const entries = helpDocs.map((entry) => {
              const shadowed = Boolean(entry.content) && seen.has(entry.key);
              if (entry.content) seen.add(entry.key);
              return { ...entry, shadowed };
            }).filter((entry) => (url.searchParams.get('management') === '1' || (entry.content && !entry.shadowed))
              && (entry.key + entry.content).toLowerCase().includes(query));
            if (path === '/help/groups') {
              const groups = new Map(); for (const entry of entries) groups.set(entry.source, (groups.get(entry.source) || 0) + 1);
              return reply({ groups: [...groups].map(([source, count]) => ({ source, count })) });
            }
            const filtered = entries.filter((entry) => !url.searchParams.get('source') || entry.source === url.searchParams.get('source'));
            const size = Number(url.searchParams.get('size') || 30), page = Number(url.searchParams.get('page') || 1);
            return reply({ entries: filtered.slice((page - 1) * size, page * size), total: filtered.length });
          }
          if (path === '/help/files') return reply({ files: helpDocs.filter((entry) => entry.source.startsWith('file:')).map((entry) => ({ name: entry.key, size: entry.content.length })) });
          if (path === '/help/file' && req.method === 'GET') {
            const entry = helpDocs.find((entry) => entry.source === 'file:' + url.searchParams.get('name'));
            if (!entry) throw new Error('File not found'); return reply({ name: entry.key, content: entry.content });
          }
          if (path === '/help/file' && req.method === 'POST') {
            const entry = helpDocs.find((entry) => entry.source === 'file:' + body.name);
            if (entry) entry.content = body.content;
            else helpDocs.push({ key: body.name, source: 'file:' + body.name, editable: true, content: body.content });
            return reply(null);
          }
          if (path.startsWith('/help/file/') && req.method === 'DELETE') {
            const index = helpDocs.findIndex((entry) => entry.source === 'file:' + decodeURIComponent(path.slice('/help/file/'.length)));
            if (index < 0) throw new Error('File not found'); helpDocs.splice(index, 1); return reply(null);
          }
          if (path === '/replies' && req.method === 'POST') {
            const entry = { ...body, matchType: body.conditions?.[0]?.type || 'keyword', matchContent: body.conditions?.[0]?.content || '', replyContent: body.results?.[0] || '', id: String(nextReplyId++), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            replyRules.push(entry); return reply(entry);
          }
          if (path === '/replies' && req.method === 'GET') {
            const scope = url.searchParams.get('scope'), target = url.searchParams.get('target') || '';
            return reply(replyRules.filter((entry) => !scope || ((entry.channelScope || 'global') === scope && (entry.channelTarget || '') === target)),
              scope ? { replyScope: { scope, target } } : {});
          }
          if (path.startsWith('/replies/') && req.method === 'PUT') {
            const entry = replyRules.find((entry) => entry.id === path.split('/').at(-1));
            if (!entry) throw new Error('Rule not found'); Object.assign(entry, body); entry.matchContent = entry.conditions?.[0]?.content || ''; entry.replyContent = entry.results?.[0] || ''; return reply(entry);
          }
          if (path.startsWith('/replies/') && req.method === 'DELETE') {
            const index = replyRules.findIndex((entry) => entry.id === path.split('/').at(-1));
            if (index < 0) throw new Error('Rule not found'); replyRules.splice(index, 1); return reply(null);
          }
          if (path === '/decks' && req.method === 'GET') return reply(listDecks());
          if (path === '/decks/file' && req.method === 'GET') {
            const content = deckFiles.get(url.searchParams.get('name'));
            if (content === undefined) throw new Error('File not found');
            return reply({ content });
          }
          if ((path === '/decks/file' && req.method === 'PUT') || (path === '/decks/upload' && req.method === 'POST')) {
            const parsed = JSON.parse(body.content);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid deck');
            deckFiles.set(body.filename, body.content); return reply({ total_decks: listDecks().length });
          }
          if (path === '/decks/reload' && req.method === 'POST') return reply({ total_decks: listDecks().length });
          if (path.startsWith('/decks/file/') && req.method === 'DELETE') { if (!deckFiles.delete(decodeURIComponent(path.slice('/decks/file/'.length)))) throw new Error('File not found'); return reply(null); }
          if (['/system/global', '/system/events', '/system/expression-engine'].includes(path)) {
            const scope = body.scope || url.searchParams.get('scope') || 'global';
            const target = body.target || url.searchParams.get('target') || '';
            const key = `${path}:${scope}:${target}`;
            const base = path === '/system/global' ? state[path].values : state[path];
            let scoped = overrides.get(key) || {};
            if (req.method === 'PUT') {
              const { scope: _scope, target: _target, platform: _platform, reset_keys, ...changes } = body;
              const update = changes.values || changes;
              if (scope === 'global') Object.assign(base, update);
              else { scoped = { ...scoped, ...update }; for (const key of reset_keys || []) delete scoped[key]; overrides.set(key, scoped); }
            } else if (req.method !== 'GET') throw new Error('Unsupported preview operation');
            const values = { ...base, ...scoped };
            return reply(path === '/system/global' ? { values, overrides: scoped, sources: {} } : { ...values, overrides: scoped, sources: {} });
          }
          if (req.method === 'PUT' && writable.has(path)) {
            state[path] = { ...state[path], ...body };
            if (path === '/system/timezone') state[path].effective_offset_minutes = body.offset_minutes ?? 480;
            return reply(state[path]);
          }
          if (req.method !== 'GET') { res.statusCode = 405; throw new Error('This action is not available in the isolated preview'); }
          return reply(state[path] ?? (path.startsWith('/system/') ? {} : []));
        } catch (error) { res.end(JSON.stringify({ code: 1, message: error.message })); }
      });
    },
  }],
});
await server.listen();
server.printUrls();
