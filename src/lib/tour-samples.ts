import type { Adapter } from '../types/adapter';
import type { DashboardStats, SystemInfo } from '../types/dashboard';
import type { ReplyRule } from '../types/reply';

// Fictional, deterministic and display-only. Keep related IDs consistent so
// the real page components can resolve names without requesting fake records.
const date = '2026-09-01T12:00:00Z';
const platform = 'onebot_v11';
const adapterId = 'demo-adapter';
const groupId = 'demo-group';
const userId = 'demo-player';
const botName = '星灯骰子 · 示例';
const groupName = '周末调查团 · 示例';
const nickname = '小夏 · 示例';
const adapters: Adapter[] = [{
  id: adapterId, name: botName, type: platform, connectionMode: 'reverse_ws',
  endpoint: 'ws://127.0.0.1:18088/onebot/v11/ws', enabled: true,
  status: 'connected', createdAt: date, loginId: 'demo-bot', loginName: botName,
}];
const accounts = [{ id: adapterId, platform, label: botName, short: botName }];
const groups = [
  { platform, groupId, name: groupName, enabled: true, ai_enabled: true, locked: false,
    card: '星灯 | CoC 7版', remark: 'CoC,周末团', activeLog: true, observers: 2,
    botRole: 'admin', memberCount: 8, inviter: userId, locale: 'zh-Hans',
    accounts: [{ adapterId, adapterName: botName, loginId: 'demo-bot', platform,
      endpointId: groupId, connected: true, enabled: true, locked: false,
      card: '星灯 | CoC 7版', activeLog: true, activeLogName: '雾港来信 · 第一幕',
      observers: 2, botRole: 'admin', memberCount: 8 }] },
  { platform, groupId: 'demo-group-2', name: '冒险者酒馆 · 示例', enabled: true,
    locked: false, card: '星灯 | D&D', remark: 'D&D,新手团', activeLog: false,
    observers: 0, botRole: 'member', memberCount: 6 },
];
const players = [
  { platform, userId, nickname, trustLevel: 4, cmdCount: 86, favor: 12, lastCmdAt: date, createdAt: date },
  { platform, userId: 'demo-player-2', nickname: '阿洛 · 示例', trustLevel: 1, cmdCount: 42, favor: 5, lastCmdAt: date, createdAt: date },
];
const masters = [{ platform, id: userId, nickname }];
const replies: ReplyRule[] = [
  { id: '-1', matchType: 'keyword', matchContent: '开团啦', replyContent: '调查员们，请带好人物卡，故事即将开始！',
    conditions: [{ type: 'keyword', content: '开团啦' }], logic: 'and', results: ['调查员们，请带好人物卡，故事即将开始！'],
    enabled: true, priority: 100, cooldownSec: 30, prob: 100, createdAt: date, updatedAt: date },
  { id: '-2', matchType: 'prefix', matchContent: '晚安', replyContent: '愿骰运与你同在，明天见。',
    enabled: true, priority: 90, prob: 100, createdAt: date, updatedAt: date },
];
const system: SystemInfo = {
  os: 'Linux · 示例服务器', os_id: 'server', cpu_model: 'Virtual CPU', cpu_cores: 4,
  cpu_physical: 2, cpu_mhz: 2400, cpu_load: 18, mem_total_mb: 4096, mem_used_mb: 1024,
  mem_load: 25, mem_speed_mhz: 0, proc_mem_mb: 128,
  disks: [{ mount: '/', label: '示例磁盘', fs: 'ext4', model: '', total_gb: 80, used_gb: 16, load: 20 }],
};
const dashboard: DashboardStats = {
  uptime_seconds: 93600, active_connections: 1, total_adapters: 1, total_commands: 128,
  total_rules: 2, active_sessions: 1,
  recent_logs: [
    { id: 'demo-log-1', timestamp: date, level: 'info', module: 'dice', message: `${nickname}：.ra 侦查 60 → 1D100=32 / 60，成功` },
    { id: 'demo-log-2', timestamp: date, level: 'info', module: 'log', message: `${groupName}：开始记录「雾港来信 · 第一幕」` },
    { id: 'demo-log-3', timestamp: date, level: 'info', module: 'adapter', message: `${botName} 已连接` },
  ],
};
const daily = [8, 14, 10, 22, 16, 26, 32].map((commands, i) => ({
  date: new Date(Date.UTC(2026, 7, 26 + i)).toISOString().slice(0, 10),
  commands, rolls: [6, 10, 8, 16, 12, 19, 24][i],
}));
const statistics = {
  summary: { total_commands: 128, total_rolls: 95, total_players: 2, active_groups: 2,
    adapter_online: 1, adapter_total: 1, availability_rate: 100, uptime_seconds: 93600 },
  filters: { days: 30, platform: '', adapter: '', platforms: [platform],
    adapters: [{ id: adapterId, name: botName, platform, connected: true }], granularity: '1h' as const },
  daily_usage: daily,
  usage_by_hour: Array.from({ length: 24 }, (_, hour) => ({ hour,
    commands: hour >= 18 ? [10, 18, 26, 24, 18, 14][hour - 18] : 1,
    rolls: hour >= 18 ? [8, 14, 23, 22, 17, 11][hour - 18] : 0 })),
  dice_faces: [{ sides: 6, total: 30, faces: [4, 6, 5, 4, 5, 6].map((count, i) => ({ face: i + 1, count })) }],
  check_results: { crit: 2, extreme: 4, hard: 9, regular: 21, fail: 20, fumble: 1 },
  command_distribution: [{ command: 'roll', count: 38 }, { command: 'check', count: 57 }, { command: 'log', count: 8 }, { command: 'other', count: 25 }],
  scope_comparison: [{ id: platform, name: 'OneBot V11', platform, commands: 128, rolls: 95 }],
  top_groups: groups.map((g, i) => ({ name: g.name, group_id: g.groupId, platform, command_count: i ? 42 : 86, roll_count: i ? 32 : 63, active_users: 2, last_command_at: date })),
  top_users: players.map(p => ({ nickname: p.nickname, user_id: p.userId, platform, command_count: p.cmdCount, last_command_at: date })),
  online_history: Array.from({ length: 12 }, (_, i) => ({ sampled_at: `2026-09-01T${String(i + 1).padStart(2, '0')}:00:00Z`, online_count: 1, total_count: 1 })),
  adapter_availability: [{ id: adapterId, name: botName, platform, connected: true, uptime_percent: 100, samples: 12 }],
  scoped_data_available: true,
};
const helpEntries = [
  { key: 'r', content: '掷骰示例：.r 1d100\n掷多个骰子：.r 3d6+2', source: 'builtin', editable: false },
  { key: 'ra', content: '技能检定示例：.ra 侦查 60', source: 'builtin', editable: false },
  { key: 'log', content: '记录跑团：.log new 雾港来信\n结束记录：.log end', source: 'builtin', editable: false },
];
const scheduleForm = { name: '周末开团提醒 · 示例', adapterId, platform, targetType: 'group', targetId: groupId,
  cronTime: '19:30', days: '6', content: '今晚八点开团，请准备好人物卡。', action: 'send', condition: '', triggerType: 'daily', intervalMin: 30, onceDate: '' };
const models = [{ id: 'demo-model', name: '故事助手 · 示例模型', base_url: 'https://api.example.invalid/v1',
  api_key: '', model: 'example-chat-model', enabled: true, price_in: 0, price_out: 0,
  token_limit: 0, cost_limit: 0, used_tokens: 0, used_cost: 0 }];

export const tourSamples = {
  adapters, accounts, groups, players, masters, replies, system, dashboard, statistics, helpEntries, scheduleForm, models,
  replyPreview: { matched: true, ruleId: -1, reply: replies[0].replyContent, notice: false, noticeRuleId: 0,
    candidates: [{ id: -1, priority: 100, matchType: 'keyword', matchContent: '开团啦', prob: 100, cooldownSec: 30 }], skipped: [] },
  cpuHistory: Array.from({ length: 60 }, (_, i) => 16 + Math.sin(i / 3) * 6),
  memHistory: Array.from({ length: 60 }, (_, i) => 24 + Math.sin(i / 9)),
  decks: [{ id: 1, filename: 'demo-encounters.json', title: '旅途奇遇 · 示例', author: '教程示例', version: '1.0', description: '为冒险准备的随机灵感。', entries: ['森林奇遇', '酒馆传闻', '旅途天气'], hidden_entries: ['旅人姓名'] }],
  tasks: [{ ...scheduleForm, id: 1, enabled: true, lastRun: '2026-08-29 19:30' }],
  plugins: [{ kind: 'js' as const, name: 'demo-adventure', title: '冒险灵感 · 示例', author: '教程示例', version: '1.0', file: 'demo-adventure.js',
    description: '展示插件名称、启用状态与指令列表。', lang: 'zh-Hans', homepage: '', updateUrl: '', license: 'AGPL-3.0',
    commandList: ['灵感', '传闻'], superseded: false, supersededBy: '', commands: 2, enabled: true, configs: [] }],
  rulePacks: [{ name: 'demo-coc', fullName: 'CoC 7版 · 示例规则', version: '1.0', file: 'demo-coc.json', author: '教程示例', diceSides: 100, setKeys: ['coc'],
    aliasGroups: 8, computedCount: 3, manualCount: 1, helpCount: 2, customCmds: ['ra'], cmdAlias: [], disableCmds: [], builtin: true, enabled: true }],
  ruleBundles: [{ name: '冒险入门 · 示例规则包', folder: 'demo-adventure', version: '1.0', author: '教程示例', description: '规则、帮助与插件可以一起打包管理。', enabled: true, setKeys: ['demo'],
    ruleFiles: 1, cmdCount: 2, helpdocEntries: 1, luaMods: 0, jsPlugins: 0, ruleNames: ['冒险入门'], helpdocFiles: ['demo.md'], luaNames: [], jsNames: [] }],
  gameLogs: [{ id: 1, groupId, gmId: userId, name: '雾港来信 · 第一幕', status: 0, createdAt: date, lastAt: date, count: 128, storageBytes: 32768, imageBytes: 0, gameCode: 'demo-game', gameName: '雾港来信 · 示例' }],
  sessions: [{ code: 'demo-game', name: '雾港来信 · 示例', groups: [groupId], gms: [userId], players: players.map(p => p.userId), createdAt: date, logCount: 1, activeLogs: 1, pausedLogs: 0, endedLogs: 0, active: true }],
  banEntries: [{ id: 1, targetType: 1, listType: 1, targetId: groupId, reason: groupName, createdAt: date }],
  noticeWindows: [{ platform, adapter_id: adapterId, chat_id: groupId, is_group: true, name: groupName, level_mask: 15, events: [] }],
  archives: [{ name: 'demo-backup-20260901.zip', size: 2516582, createdAt: Date.parse(date) / 1000, automatic: true }],
  chat: [{ role: 'user' as const, text: '.ra 侦查 60' }, { role: 'bot' as const, text: '小夏的侦查检定：1D100=32 / 60，成功！' }],
  commands: [{ cmd: 'r', title: '掷骰 · 示例', category: '掷骰', sources: ['builtin'], example: '.r 3d6+2', desc: '按表达式掷骰并显示结果。',
    replies: [{ key: 'demo.roll', default: '{nick}掷骰：{expr}={result}', override: null, format: 'plain' as const, defaultFormat: 'plain' as const, example: '小夏掷骰：3D6+2=14', vars: [{ name: 'nick', desc: '玩家昵称' }, { name: 'expr', desc: '掷骰表达式' }, { name: 'result', desc: '结果' }] }] }],
  personas: [{ id: 1, name: '星灯 · 示例人格' }],
};
