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
  e('about-update', '/about', 'nav.about', 'about.update_title', '更新 升级 升級 update upgrade updater release 新版本 版本检测 版本檢測 检查更新 檢查更新 自动更新 自動更新 自动升级 自動升級 在线升级 線上升級 github mirror 镜像 鏡像 下载 下載 安装 安裝 回滚 回滾', 'about.update_desc', true),
];

export const searchDestination = (entry: SettingsSearchEntry) => {
  const params = new URLSearchParams();
  if (!entry.id.startsWith('page-')) params.set('focus', entry.id);
  if (entry.tab) params.set('tab', entry.tab);
  const query = params.toString();
  return query ? `${entry.path}?${query}` : entry.path;
};
