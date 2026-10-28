export const webuiVersionsCopy = {
  'zh-Hans': {
    title: 'WebUI 版本', v1: 'V1', v2: 'V2（预览版）',
    v1_desc: '当前界面，适合日常使用。', v2_desc: '新版界面的开发预览，可随时切回 V1。',
    help: '两个版本共用骰娘的数据、登录状态和设置。选择会保存到服务器的 config/webui.json，对本实例生效，重启后保留。\n\n保存后只重新加载网页，不会重启骰娘。其他已打开的页面不会被强制切换。V2 仍在开发中，遇到问题可通过 /v1/ 返回 V1。',
    apply: '保存并切换', loading: '正在读取版本配置…', load_error: '无法读取 WebUI 版本配置，请重试。',
    unavailable: '当前安装包未包含此版本', fallback: '所选版本资源缺失，已回退到可用界面。请安装完整程序包。',
    current: '当前页面：{{version}}', read_only: '仅骰主可修改本实例的 WebUI 版本。', preview: 'V2 预览版',
  },
  'zh-Hant': {
    title: 'WebUI 版本', v1: 'V1', v2: 'V2（預覽版）',
    v1_desc: '目前介面，適合日常使用。', v2_desc: '新版介面的開發預覽，可隨時切回 V1。',
    help: '兩個版本共用骰娘的資料、登入狀態和設定。選擇會儲存到伺服器的 config/webui.json，對本實例生效，重新啟動後保留。\n\n儲存後只重新載入網頁，不會重啟骰娘。其他已開啟的頁面不會被強制切換。V2 仍在開發中，遇到問題可透過 /v1/ 返回 V1。',
    apply: '儲存並切換', loading: '正在讀取版本設定…', load_error: '無法讀取 WebUI 版本設定，請重試。',
    unavailable: '目前安裝包未包含此版本', fallback: '所選版本資源缺失，已退回可用介面。請安裝完整程式包。',
    current: '目前頁面：{{version}}', read_only: '僅骰主可修改本實例的 WebUI 版本。', preview: 'V2 預覽版',
  },
  en: {
    title: 'WebUI version', v1: 'V1', v2: 'V2 (Preview)',
    v1_desc: 'The current interface for everyday use.', v2_desc: 'A development preview. You can switch back to V1 at any time.',
    help: 'Both versions share bot data, sign-in and settings. The choice is stored in config/webui.json on the server for this instance and survives restarts.\n\nSaving reloads this page without restarting the bot. Other open tabs are not forced to switch. V2 is under development; open /v1/ to recover V1 if needed.',
    apply: 'Save and switch', loading: 'Loading version settings…', load_error: 'Unable to load WebUI version settings. Please retry.',
    unavailable: 'Not included in this package', fallback: 'The selected version is missing. Using an available interface; please install a complete package.',
    current: 'Current page: {{version}}', read_only: 'Only the owner can change the WebUI version for this instance.', preview: 'V2 Preview',
  },
  ja: {
    title: 'WebUI バージョン', v1: 'V1', v2: 'V2（プレビュー版）',
    v1_desc: '日常利用向けの現行画面です。', v2_desc: '新画面の開発プレビューです。いつでも V1 に戻せます。',
    help: '両バージョンはボットのデータ、ログイン状態、設定を共有します。選択はサーバーの config/webui.json に保存され、再起動後も保持されます。\n\n保存するとこのページのみ再読み込みされ、ボットは再起動しません。他のタブは切り替わりません。V2 は開発中です。問題がある場合は /v1/ から V1 に戻れます。',
    apply: '保存して切り替え', loading: '設定を読み込み中…', load_error: 'WebUI の設定を読み込めません。再試行してください。',
    unavailable: 'このパッケージには含まれていません', fallback: '選択したバージョンがありません。利用可能な画面に戻りました。完全なパッケージをインストールしてください。',
    current: '現在の画面：{{version}}', read_only: 'WebUI バージョンを変更できるのは所有者のみです。', preview: 'V2 プレビュー版',
  },
};
