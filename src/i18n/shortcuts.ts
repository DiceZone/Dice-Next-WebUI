export const shortcuts = {
  'zh-Hans': {
    title: '快捷指令', group: '群', example_name: '侦查', example_command: '.ra 侦查 60',
    help: '使用 .alias 名称 指令 保存快捷指令，再用 .&名称 或 .a 名称 调用，可在后面追加参数。\n\n群聊默认保存群快捷指令；--my 保存个人快捷指令，私聊默认也是个人。群快捷指令仅在当前机器人账号所在群使用，个人快捷指令可跨群与私聊使用，同名时群优先。\n\n始终按调用者权限执行内置或插件指令，不能绕过开关或递归调用。.bind 为保护验证信息不能设为目标。旧主副号权限关联改用 .admin account-alias 管理，原数据保留。',
    labels: { usage: '定义与管理用法', execute_usage: '调用用法', personal: '个人作用域名称', group: '群作用域名称', added: '新增成功', replaced: '覆盖成功', removed: '删除成功', not_found: '快捷指令不存在', list: '列表外框', list_item: '列表单项', list_empty: '无可用条目', invalid_name: '名称不合法', invalid_target: '目标指令不合法', recursion: '递归拦截', target_unknown: '目标指令不可用', limit: '数量上限', storage_error: '存储失败', trigger_prefix: '调用结果前缀' },
  },
  'zh-Hant': {
    title: '快捷指令', group: '群', example_name: '偵查', example_command: '.ra 偵查 60',
    help: '使用 .alias 名稱 指令 儲存快捷指令，再用 .&名稱 或 .a 名稱 呼叫，可在後面附加參數。\n\n群聊預設儲存群快捷指令；--my 儲存個人快捷指令，私聊預設也是個人。群快捷指令僅在目前機器人帳號所在群使用，個人快捷指令可跨群與私聊使用，同名時群優先。\n\n始終按呼叫者權限執行內建或外掛指令，不能繞過開關或遞迴呼叫。.bind 為保護驗證資訊不能設為目標。舊主副號權限關聯改用 .admin account-alias 管理，原資料保留。',
    labels: { usage: '定義與管理用法', execute_usage: '呼叫用法', personal: '個人作用域名稱', group: '群作用域名稱', added: '新增成功', replaced: '覆寫成功', removed: '刪除成功', not_found: '快捷指令不存在', list: '列表外框', list_item: '列表單項', list_empty: '無可用項目', invalid_name: '名稱不合法', invalid_target: '目標指令不合法', recursion: '遞迴攔截', target_unknown: '目標指令不可用', limit: '數量上限', storage_error: '儲存失敗', trigger_prefix: '呼叫結果前綴' },
  },
  en: {
    title: 'Command shortcuts', group: 'Group', example_name: 'spot', example_command: '.ra Spot 60',
    help: 'Save a command with .alias name command, then invoke it with .&name or .a name. Extra arguments are appended.\n\nGroup chat creates a group shortcut by default; --my creates a personal shortcut, as does private chat. Group shortcuts belong to the current bot account and group. Personal shortcuts work across groups and private chat. Group wins when names overlap.\n\nBuilt-in and plugin targets execute with the caller’s permissions, respecting feature gates and recursion protection. .bind targets are prohibited to protect verification data. Legacy account permission links remain under .admin account-alias without deleting existing data.',
    labels: { usage: 'Definition and management help', execute_usage: 'Invocation help', personal: 'Personal scope label', group: 'Group scope label', added: 'Created', replaced: 'Replaced', removed: 'Deleted', not_found: 'Shortcut not found', list: 'List wrapper', list_item: 'List entry', list_empty: 'Empty list', invalid_name: 'Invalid name', invalid_target: 'Invalid target', recursion: 'Recursion blocked', target_unknown: 'Unavailable target', limit: 'Entry limit', storage_error: 'Storage failure', trigger_prefix: 'Invocation result prefix' },
  },
  ja: {
    title: 'コマンドのショートカット', group: 'グループ', example_name: '目星', example_command: '.ra 目星 60',
    help: '.alias 名前 コマンド で保存し、.&名前 または .a 名前 で呼び出します。追加の引数は末尾に付加します。\n\nグループではグループ用が既定です。--my または個別チャットで個人用を作成できます。グループ用は現在のボットアカウントとグループの範囲、個人用はグループと個別チャットをまたいで使用できます。同名ではグループ用を優先します。\n\n組み込み・プラグインの呼び出しは実行者の権限とスイッチに従い、再帰呼び出しは禁止します。認証情報を守るため .bind は指定できません。旧アカウント権限リンクは .admin account-alias で管理し、既存のデータは保持します。',
    labels: { usage: '定義と管理の説明', execute_usage: '呼び出し方', personal: '個人範囲の名称', group: 'グループ範囲の名称', added: '追加完了', replaced: '置換完了', removed: '削除完了', not_found: '未登録', list: '一覧の枠', list_item: '一覧の項目', list_empty: '空の一覧', invalid_name: '無効な名前', invalid_target: '無効なコマンド', recursion: '再帰の停止', target_unknown: '利用できないコマンド', limit: '件数上限', storage_error: '保存エラー', trigger_prefix: '実行結果の前置き' },
  },
} as const;
