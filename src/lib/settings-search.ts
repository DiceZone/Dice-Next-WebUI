export interface SettingsSearchEntry {
  id: string;
  path: string;
  pageKey: string;
  titleKey: string;
  descriptionKey?: string;
  keywords?: string;
  tab?: 'windows' | 'push' | 'audit';
  featured?: boolean;
}

export type SettingsSearchEntryKind = 'page' | 'feature' | 'setting';
export type SettingsSearchMatchKind = 'direct' | 'alias' | 'fuzzy';

export interface SettingsSearchDocument {
  title: string;
  description: string;
  page: string;
  keywords: string;
}

export interface SettingsSearchMatch {
  score: number;
  kind: SettingsSearchMatchKind;
  matchedKeyword: string;
}

export const getSettingsSearchEntryKind = (entry: SettingsSearchEntry): SettingsSearchEntryKind => {
  if (entry.id.startsWith('page-')) return 'page';
  if (/^(settings|webui|notice)-/.test(entry.id)) return 'setting';
  return 'feature';
};

export const normalizeSearchText = (value: string) => value
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/[\s\p{P}\p{S}]+/gu, '');

interface SearchToken {
  raw: string;
  normalized: string;
}

interface SearchField {
  name: 'title' | 'description' | 'page' | 'keywords';
  normalized: string;
  tokens: SearchToken[];
  weight: number;
  fuzzy: boolean;
}

const tokenize = (value: string): SearchToken[] => value
  .normalize('NFKC')
  .toLocaleLowerCase()
  .split(/[\s\p{P}\p{S}]+/gu)
  .map((raw) => ({ raw, normalized: normalizeSearchText(raw) }))
  .filter((token) => token.normalized.length > 0);

// A local concept map is deterministic, fast, private, and sufficient for the
// bounded administration vocabulary. Keep aliases multilingual so users can
// search in a different language from the currently selected interface.
const SEARCH_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['update', 'upgrade', 'updater', 'release', '更新', '升级', '升級', '版本检测', '版本檢測', '自动检测', '自動檢測', 'アップデート', 'shengji'],
  ['translate', 'translation', 'translator', '翻译', '翻譯', '翻訳', '多语言', '多語言', 'fanyi'],
  ['polish', 'rewrite', '润色', '潤色', '改写', '改寫', 'runse'],
  ['login', 'auth', 'password', 'credential', '登录', '登入', '口令', '密码', '密碼', 'ログイン', 'パスワード', 'denglu', 'mima'],
  ['plugin', 'module', 'mod', 'extension', '插件', '模组', '模組', '扩展', '擴充', 'プラグイン', 'chajian'],
  ['schedule', 'timer', 'cron', 'clock', '定时', '定時', '定时器', '定時器', '闹钟', '鬧鐘', 'スケジュール', 'dingshi'],
  ['markdown', 'md', 'richtext', 'card', '富文本', '富消息', '卡片', '传统文本', '傳統文本'],
  ['backup', 'restore', 'snapshot', '备份', '備份', '恢复', '恢復', '还原', '還原', 'バックアップ', 'beifen'],
  ['adapter', 'platform', 'connection', 'account', '适配器', '適配器', '平台', '连接', '連線', '账号', '帳號', 'shipeiqi'],
  ['permission', 'ban', 'blacklist', 'whitelist', 'trust', '权限', '權限', '黑名单', '黑名單', '白名单', '白名單', '権限', 'quanxian'],
  ['log', 'record', 'history', '日志', '日誌', '跑团记录', '跑團記錄', 'ログ', 'rizhi'],
  ['statistics', 'analytics', 'metrics', '统计', '統計', '报表', '報表', 'tongji'],
  ['image', 'media', 'picture', '图片', '圖片', '图床', '圖床', '画像', 'tupian'],
  ['reply', 'response', 'template', '回复', '回覆', '文案', '返信', 'huifu'],
  ['command', 'instruction', 'alias', '指令', '命令', '别名', '別名', 'コマンド', 'zhiling'],
  ['ai', 'llm', 'model', 'artificialintelligence', '人工智能', '大模型', '模型', 'moxing'],
  ['group', 'channel', '群组', '群組', '群聊', '频道', '頻道', 'qun'],
  ['player', 'user', 'character', '玩家', '用户', '用戶', '人物卡', '角色卡', 'wanjia'],
  ['container', 'docker', 'podman', 'kubernetes', 'k8s', '容器', 'コンテナ', 'rongqi'],
];

const SEARCH_SYNONYM_INDEX = (() => {
  const index = new Map<string, string[]>();
  SEARCH_SYNONYM_GROUPS.forEach((group) => {
    const normalizedGroup = [...new Set(group.map(normalizeSearchText).filter(Boolean))];
    normalizedGroup.forEach((alias) => index.set(alias, normalizedGroup));
  });
  return index;
})();

const synonymVariants = (term: string) => {
  const exact = SEARCH_SYNONYM_INDEX.get(term);
  return exact ? exact.filter((alias) => alias !== term) : [];
};

interface CompoundPart {
  start: number;
  end: number;
}

// Chinese queries commonly omit spaces. Split compounds only at known concept
// aliases, and retain all remaining text as required qualifiers. This makes
// `定时插件` an AND query for `定时` + `插件` instead of silently degrading to
// whichever embedded alias happens to match first.
const splitCompoundSearchTerm = (term: string): string[] => {
  if (SEARCH_SYNONYM_INDEX.has(term)) return [term];

  const candidates: CompoundPart[] = [];
  SEARCH_SYNONYM_INDEX.forEach((_aliases, alias) => {
    const minimumLength = /^[a-z0-9]+$/i.test(alias) ? 4 : 2;
    if (Array.from(alias).length < minimumLength) return;
    let start = term.indexOf(alias);
    while (start >= 0) {
      candidates.push({ start, end: start + alias.length });
      start = term.indexOf(alias, start + 1);
    }
  });
  if (candidates.length === 0) return [term];

  candidates.sort((left, right) => (
    left.start - right.start || (right.end - right.start) - (left.end - left.start)
  ));
  const selected: CompoundPart[] = [];
  candidates.forEach((candidate) => {
    if (selected.every((part) => candidate.end <= part.start || candidate.start >= part.end)) {
      selected.push(candidate);
    }
  });
  selected.sort((left, right) => left.start - right.start);

  const residualLength = selected.reduce((covered, part) => covered - (part.end - part.start), term.length);
  if (selected.length < 2 && residualLength < 2) return [term];

  const parts: string[] = [];
  let offset = 0;
  selected.forEach((part) => {
    if (part.start > offset) parts.push(term.slice(offset, part.start));
    parts.push(term.slice(part.start, part.end));
    offset = part.end;
  });
  if (offset < term.length) parts.push(term.slice(offset));
  return [...new Set(parts.filter(Boolean))];
};

const editDistance = (left: string, right: string, maximum: number) => {
  const a = Array.from(left);
  const b = Array.from(right);
  if (Math.abs(a.length - b.length) > maximum) return maximum + 1;

  const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    let rowMinimum = maximum + 1;
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + substitution,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
      rowMinimum = Math.min(rowMinimum, matrix[i][j]);
    }
    if (rowMinimum > maximum) return maximum + 1;
  }
  return matrix[a.length][b.length];
};

interface TermMatch {
  score: number;
  kind: SettingsSearchMatchKind;
  matchedKeyword: string;
}

const bestMatch = (matches: TermMatch[]) => matches
  .sort((left, right) => right.score - left.score)[0];

const findTermMatch = (term: string, fields: SearchField[]): TermMatch | undefined => {
  const direct = fields.flatMap<TermMatch>((field) => {
    if (!field.normalized.includes(term)) return [];
    const exactBonus = field.normalized === term ? 30 : field.normalized.startsWith(term) ? 16 : 0;
    const keyword = field.name === 'keywords'
      ? field.tokens.find((token) => token.normalized.includes(term))?.raw || ''
      : '';
    return [{ score: field.weight + exactBonus, kind: 'direct', matchedKeyword: keyword }];
  });
  if (direct.length > 0) return bestMatch(direct);

  const aliases = synonymVariants(term);
  const aliasMatches = aliases.flatMap<TermMatch>((alias) => fields.flatMap<TermMatch>((field) => {
    const asciiWord = /^[a-z0-9]+$/i.test(alias);
    const token = field.tokens.find((candidate) => asciiWord
      ? candidate.normalized === alias
      : candidate.normalized.includes(alias));
    if (!token) return [];
    return [{
      score: field.weight - 8 + (token.normalized === alias ? 12 : 0),
      kind: 'alias',
      matchedKeyword: token.raw,
    }];
  }));
  if (aliasMatches.length > 0) return bestMatch(aliasMatches);

  const termLength = Array.from(term).length;
  if (termLength < 4) return undefined;
  const maximum = termLength >= 8 ? 2 : 1;
  const fuzzy = fields.flatMap<TermMatch>((field) => {
    if (!field.fuzzy) return [];
    return field.tokens.flatMap<TermMatch>((token) => {
      const distance = editDistance(term, token.normalized, maximum);
      if (distance > maximum) return [];
      return [{
        score: field.weight - 18 - distance * 4,
        kind: 'fuzzy',
        matchedKeyword: token.raw,
      }];
    });
  });
  return fuzzy.length > 0 ? bestMatch(fuzzy) : undefined;
};

export const matchSettingsSearch = (query: string, document: SettingsSearchDocument): SettingsSearchMatch | null => {
  const terms = tokenize(query).flatMap((token) => splitCompoundSearchTerm(token.normalized));
  if (terms.length === 0) return null;

  const fields: SearchField[] = [
    { name: 'title', normalized: normalizeSearchText(document.title), tokens: tokenize(document.title), weight: 48, fuzzy: true },
    { name: 'keywords', normalized: normalizeSearchText(document.keywords), tokens: tokenize(document.keywords), weight: 36, fuzzy: true },
    { name: 'page', normalized: normalizeSearchText(document.page), tokens: tokenize(document.page), weight: 24, fuzzy: true },
    { name: 'description', normalized: normalizeSearchText(document.description), tokens: tokenize(document.description), weight: 16, fuzzy: false },
  ];

  let score = 0;
  let kind: SettingsSearchMatchKind = 'direct';
  let matchedKeyword = '';
  const kindRank: Record<SettingsSearchMatchKind, number> = { direct: 0, alias: 1, fuzzy: 2 };

  for (const term of terms) {
    const match = findTermMatch(term, fields);
    if (!match) return null;
    score += match.score;
    if (kindRank[match.kind] > kindRank[kind]) {
      kind = match.kind;
      matchedKeyword = match.matchedKeyword;
    } else if (!matchedKeyword && match.matchedKeyword) {
      matchedKeyword = match.matchedKeyword;
    }
  }

  const whole = normalizeSearchText(query);
  const title = fields[0].normalized;
  if (title === whole) score += 160;
  else if (title.startsWith(whole)) score += 110;
  else if (title.includes(whole)) score += 80;
  if (fields[1].normalized.includes(whole)) score += 55;
  if (fields[3].normalized.includes(whole)) score += 35;
  if (fields[2].normalized.includes(whole)) score += 20;

  return { score, kind, matchedKeyword };
};

const e = (
  id: string,
  path: string,
  pageKey: string,
  titleKey: string,
  keywords: string,
  descriptionKey?: string,
  featured = false,
  tab?: SettingsSearchEntry['tab'],
): SettingsSearchEntry => ({ id, path, pageKey, titleKey, keywords, descriptionKey, featured, tab });

// Common aliases are intentionally multilingual: protocol names and older Dice terms
// remain searchable even when the administration language changes.
export const SETTINGS_SEARCH_ENTRIES: SettingsSearchEntry[] = [
  e('settings-master', '/settings', 'nav.settings', 'settings.master_title', 'master 主人 骰主 管理员 管理員 admin owner', 'settings.master_desc', true),
  e('settings-plugin-verify', '/settings', 'nav.settings', 'settings.plugin_verify_title', '插件签名 插件簽名 signature public key verify js lua security', 'settings.plugin_verify_desc'),
  e('settings-prefix', '/settings', 'nav.settings', 'settings.prefix_title', '指令前缀 指令前綴 命令前缀 command prefix dot 点号 點號', 'settings.prefix_desc', true),
  e('settings-timezone', '/settings', 'nav.settings', 'settings.timezone_title', '时区 時區 timezone utc time clock', 'settings.timezone_desc'),
  e('settings-scope', '/settings', 'nav.settings', 'settings.scope_title', '作用域 分账号 分帳號 适配器 適配器 account adapter inherit override 覆盖 覆寫', 'settings.scope_desc'),
  e('settings-expression', '/settings', 'nav.settings', 'settings.expression_title', '表达式 表達式 expression dicescript onedice engine compatibility 兼容 原版 增强 增強', 'settings.expression_desc', true),
  e('settings-approval', '/settings', 'nav.settings', 'settings.approval_title', '好友申请 好友申請 加群邀请 加群邀請 审批 審批 approve reject keyword blacklist whitelist', 'settings.approval_desc'),
  e('settings-poke', '/settings', 'nav.settings', 'settings.poke_title', '戳一戳 nudge poke jrrp', 'settings.poke_desc'),
  e('settings-welcome', '/settings', 'nav.settings', 'settings.welcome_min_title', '欢迎词 歡迎詞 welcome 入群 delay cooldown 延迟 延遲 冷却 冷卻', 'settings.welcome_min_desc'),
  e('settings-user-group', '/settings', 'nav.settings', 'usergroup.title', '用户群 用戶群 user group 分组 分組 邀请 邀請 enforce'),
  e('settings-friend-clean', '/settings', 'nav.settings', 'friendclean.title', '好友清理 群聊清理 自动清理 自動清理 friend clean cleanup leave group'),
  e('settings-quote-reply', '/settings', 'nav.settings', 'settings.quote_reply', '引用回复 引用回覆 quote reply', 'settings.quote_reply_desc'),
  e('settings-auto-card', '/settings', 'nav.settings', 'settings.auto_card', '自动名片 自動名片 group card nickname', 'settings.auto_card_desc'),
  e('settings-respond-self', '/settings', 'nav.settings', 'settings.respond_self', '自身消息 自己消息 self message echo', 'settings.respond_self_desc'),
  e('settings-forward-long', '/settings', 'nav.settings', 'settings.forward_long', '长消息 長消息 合并转发 合併轉發 forward long message', 'settings.forward_long_desc'),
  e('settings-forward-threshold', '/settings', 'nav.settings', 'settings.forward_threshold', '转发阈值 轉發閾值 threshold length', 'settings.forward_threshold_desc'),
  e('settings-segment', '/settings', 'nav.settings', 'settings.seg_enabled', '分段回复 分段回覆 split segment message length', 'settings.seg_enabled_desc'),
  e('settings-segment-length', '/settings', 'nav.settings', 'settings.seg_len', '分段长度 分段長度 segment length', 'settings.seg_len_desc'),
  e('settings-nick-wrap', '/settings', 'nav.settings', 'settings.nick_wrap', '昵称括号 暱稱括號 nickname wrapper name format', 'settings.nick_wrap_desc'),
  e('settings-message-format', '/settings', 'nav.settings', 'settings.message_format_title', 'markdown md 富文本 富卡片 传统文本 傳統文本 plain card message format qq官方', 'settings.message_format_desc_global', true),
  e('settings-response-switches', '/settings', 'nav.settings', 'settings.sec_reply', '响应开关 響應開關 静默 靜默 silent jrrp me deck draw send help bot off'),
  e('settings-deck-display', '/settings', 'nav.settings', 'global_search.deck_display_title', '牌堆显示 牌堆顯示 deck display hide underscore metadata author title 元数据 元資料', 'global_search.deck_display_desc'),
  e('settings-event-response', '/settings', 'nav.settings', 'global_search.event_response_title', '事件响应 事件回應 加群请求 加群請求 好友请求 好友請求 入群欢迎 入群歡迎 黑名单退群 event response request welcome leave blacklist', 'global_search.event_response_desc'),
  e('settings-external-request', '/settings', 'nav.settings', 'global_search.external_request_title', '外部请求 外部請求 api url http https timeout 自定义回复 自訂回覆 网络请求 網路請求', 'global_search.external_request_desc'),
  e('settings-identity-binding', '/settings', 'nav.settings', 'global_search.identity_binding_title', '身份绑定 身份綁定 qq官方 official bind real qq account high risk 冒认 冒認', 'global_search.identity_binding_desc'),
  e('settings-save-images', '/settings', 'nav.settings', 'settings.save_images', '保存图片 保存圖片 log image archive', 'settings.save_images_desc'),
  e('settings-image-send', '/settings', 'nav.settings', 'settings.imgsend_title', '图片发送 圖片發送 base64 http url image send', 'settings.imgsend_desc'),
  e('settings-image-host', '/settings', 'nav.settings', 'settings.imghost_title', '图床 圖床 image host upload headers public url', 'settings.imghost_desc'),
  e('settings-chat-retention', '/settings', 'nav.settings', 'chatcfg.title', '聊天记录 聊天記錄 保留期 retention history privacy database'),
  e('settings-js-fetch', '/settings', 'nav.settings', 'settings.js_fetch_title', 'js plugin fetch network 网络 網路 安全 strict sealdice', 'settings.js_fetch_desc'),
  e('settings-heartbeat', '/settings', 'nav.settings', 'settings.heartbeat_title', '心跳 在线 在線 状态 狀態 heart.dice.zone heartbeat public'),
  e('settings-logsite', '/settings', 'nav.settings', 'settings.logsite_title', '日志站 日誌站 log site upload seal protocol', 'settings.logsite_desc'),
  e('settings-autostart', '/settings', 'nav.settings', 'settings.autostart', '开机启动 開機啟動 auto start startup boot windows', 'settings.autostart_desc'),
  e('settings-censor', '/settings', 'nav.settings', 'settings.censor_title', '敏感词 敏感詞 违禁词 違禁詞 censor filter keyword block 拦截 攔截', 'settings.censor_desc', true),

  e('webui-api-key', '/webui-settings', 'nav.webui', 'settings.api_key_title', 'api key token access secret 接口 密钥 密鑰', 'settings.api_key_desc'),
  e('webui-password', '/webui-settings', 'nav.webui', 'settings.webpw_title', '密码 密碼 password login 登录 登入 auth trust device 30天', 'settings.webpw_desc', true),
  e('webui-server', '/webui-settings', 'nav.webui', 'settings.server_title', 'ip host port 端口 端口号 監聽 listen address 18088 server', 'settings.server_desc'),
  e('webui-theme', '/webui-settings', 'nav.webui', 'settings.theme_title', '主题 主題 theme dark light system 深色 浅色 淺色', 'settings.theme_desc'),
  e('webui-log', '/webui-settings', 'nav.webui', 'settings.log_title', '控制台日志 控制台日誌 raw log 原始日志', 'settings.log_desc'),

  e('notice-windows', '/notice-settings', 'nav.notice', 'noticeset.tab_windows', '通知窗口 群通知 私聊通知 event window update 更新结果 更新結果', 'noticeset.win_hint', true, 'windows'),
  e('notice-smtp', '/notice-settings', 'nav.notice', 'noticeset.push_smtp', '邮件 郵件 email smtp ssl host port sender receiver push', 'noticeset.push_smtp_desc', false, 'push'),
  e('notice-webhook', '/notice-settings', 'nav.notice', 'noticeset.push_webhook', 'webhook http callback 回调 回呼 推送 url', 'noticeset.push_webhook_desc', false, 'push'),
  e('notice-audit', '/notice-settings', 'nav.notice', 'noticeset.tab_audit', '审计 審計 审核 日志 日誌 audit operation history', 'noticeset.audit_hint', false, 'audit'),

  e('page-dashboard', '/', 'nav.dashboard', 'dashboard.title', '运行概览 運行概覽 dashboard overview status uptime 在线 在線 连接状态 連線狀態', 'dashboard.subtitle', true),
  e('page-statistics', '/statistics', 'nav.statistics', 'statistics.title', '数据统计 數據統計 statistics analytics metrics report trend 活跃用户 活躍使用者 活跃群组 活躍群組 骰点分布 骰點分佈 在线粒度 在線粒度', 'statistics.subtitle', true),
  e('page-playground', '/playground', 'nav.playground', 'nav.playground', '指令测试 指令測試 测试台 測試台 playground sandbox debug message 调试 調試'),
  e('page-help', '/help', 'nav.help', 'helpdoc.title', '帮助文档 幫助文件 help docs documentation topic 规则速查 規則速查', 'helpdoc.desc'),
  e('page-logs', '/logs', 'nav.logs', 'logs.title', '跑团记录 跑團記錄 日志 日誌 log record game export 导出 匯出', 'logs.subtitle'),
  e('page-roadmap', '/roadmap', 'nav.roadmap', 'roadmap.title', '开发计划 開發計畫 roadmap progress todo changelog 更新日志 更新日誌', 'roadmap.subtitle'),
  e('page-settings', '/settings', 'nav.settings', 'settings.title', '系统设置 系統設定 settings configuration preferences 全局 全域', 'settings.subtitle'),
  e('page-webui', '/webui-settings', 'nav.webui', 'webui.title', 'webui 设置 設定 panel server login auth password port theme', 'webui.desc'),
  e('page-notice', '/notice-settings', 'nav.notice', 'noticeset.title', '通知设置 通知設定 notice notification smtp webhook audit window', 'noticeset.desc'),
  e('page-adapters', '/adapters', 'nav.adapters', 'adapters.title', '平台连接 平台連線 adapter onebot websocket qq official discord kook 账号 帳號', 'adapters.subtitle', true),
  e('page-replies', '/replies', 'nav.replies', 'replies.title', '回复 回覆 reply template text markdown variables 自定义 自訂', 'replies.subtitle'),
  e('page-commands', '/commands', 'nav.commands', 'commands.title', '指令 命令 command alias enable disable reply text', 'commands.subtitle'),
  e('page-modules', '/modules', 'nav.modules', 'modules.title', '插件 plugin js javascript lua module extension config', 'modules.subtitle'),
  e('page-rules', '/rules', 'nav.rules', 'rules.title', '规则 規則 rule coc dnd dice system bundle', 'rules.desc'),
  e('page-dice-rules', '/dice-rules', 'nav.dice_rules', 'nav.dice_rules', '骰子规则 骰子規則 dice rule expression roll default sides', 'dice.subtitle'),
  e('page-decks', '/decks', 'nav.decks', 'decks.title', '牌堆 deck draw 抽取 upload', 'decks.subtitle'),
  e('page-groups', '/groups', 'nav.groups', 'groups.title', '群组 群組 group settings bot on off welcome notice', 'groups.subtitle'),
  e('page-players', '/players', 'nav.players', 'players.title', '玩家 用户 用戶 player character card binding', 'players.subtitle'),
  e('page-permissions', '/permissions', 'nav.banlist', 'banlist.title', '权限 權限 permission black list ban trust admin master whitelist', 'banlist.desc'),
  e('page-schedules', '/schedules', 'nav.schedules', 'nav.schedules', '定时任务 定時任務 schedule cron timer plugin command lua 群 指令', 'schedules.subtitle', true),
  e('page-ai', '/ai', 'nav.ai', 'ai.title', 'ai 人工智能 artificial intelligence 大模型 llm', 'ai.desc'),
  e('ai-master', '/ai', 'nav.ai', 'ai.master', 'ai 总开关 總開關 master enable disable', 'ai.master_desc'),
  e('ai-models', '/ai', 'nav.ai', 'ai.models', '模型 接入 provider base url api key token 费用 費用 限额 限額 test openai deepseek qwen', 'ai.desc', true),
  e('ai-params', '/ai', 'nav.ai', 'ai.params', '请求参数 請求參數 temperature top_p max_tokens penalty 温度 溫度', 'ai.params_desc'),
  e('ai-polish', '/ai/polish', 'nav.ai', 'ai.polish', '回复润色 回覆潤色 polish rewrite rp 人设 人設 风格 風格 提示词 提示詞', 'ai.polish_desc', true),
  e('ai-translate', '/ai/translate', 'nav.ai', 'ai.trans', '回复翻译 回覆翻譯 翻译 翻譯 translate translation lang 语言 語言 多语言 多語言 缓存 快取', 'ai.trans_desc', true),
  e('ai-chat', '/ai/chat', 'nav.ai', 'ai.chat', 'ai 对话 對話 聊天 chat 人设 人設 上下文 context 关键词 關鍵詞 at 待机 待機', 'ai.chat_desc'),
  e('ai-memory-short', '/ai/chat', 'nav.ai', 'ai.mem', '短期记忆 短期記憶 群历史 群歷史 摘要 summary rolling memory 上下文', 'ai.mem_desc'),
  e('ai-memory-long', '/ai/chat', 'nav.ai', 'ai.mlong', '长期记忆 長期記憶 向量 vector embedding embed 相似度 similarity 事实 事實 top-k', 'ai.mlong_desc'),
  e('ai-tools', '/ai/chat', 'nav.ai', 'ai.tools', '工具调用 工具調用 function calling tools 掷骰 擲骰 人物卡 牌堆 执行指令 執行指令', 'ai.tools_desc'),
  e('ai-whitelist', '/ai/chat', 'nav.ai', 'ai.wl', 'ai 白名单 白名單 whitelist access control 授权 授權 费用 費用', 'ai.wl_desc'),
  e('ai-vision', '/ai/chat', 'nav.ai', 'ai.vision', '图像识别 圖像識別 识图 識圖 图片 圖片 多模态 多模態 vision image base64', 'ai.vision_desc'),
  e('ai-npc', '/ai/npc', 'nav.ai', 'ai.npc', 'npc 扮演 角色 人设 人設 背景知识 背景知識 触发词 觸發詞 情绪 情緒 好感度', 'ai.npc_desc'),
  e('page-backup', '/backup', 'nav.backup', 'backup.title', '备份 備份 backup restore export import database', 'backup.subtitle'),
  e('page-about', '/about', 'nav.about', 'about.title', '关于 關於 about project info 项目 專案 技术栈 技術棧', 'about.subtitle'),
  e('about-update', '/about', 'nav.about', 'about.update_title', '更新 升级 升級 update upgrade updater release 新版本 版本检测 版本檢測 自动检测 自動檢測 检查更新 檢查更新 自动更新 自動更新 自动升级 自動升級 在线升级 線上升級 github mirror 镜像 鏡像 镜像升级 鏡像升級 镜像更新 鏡像更新 container docker podman kubernetes k8s 容器 コンテナ 拉取镜像 拉取鏡像 下载 下載 安装 安裝 回滚 回滾', 'about.update_desc', true),
];

export const searchDestination = (entry: SettingsSearchEntry) => {
  const params = new URLSearchParams();
  if (!entry.id.startsWith('page-')) params.set('focus', entry.id);
  if (entry.tab) params.set('tab', entry.tab);
  const query = params.toString();
  return query ? `${entry.path}?${query}` : entry.path;
};
