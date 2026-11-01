const coreCopy = {
  'zh-Hans': { toggle_menu: '展开或收起导航菜单', load_error: '这个页面暂时无法显示', load_error_hint: '可以重试加载，或返回运行概览。未保存的内容不会自动提交。', reload: '重新加载页面', home: '返回运行概览', details: '错误详情' },
  'zh-Hant': { toggle_menu: '展開或收合導覽選單', load_error: '此頁面暫時無法顯示', load_error_hint: '可以重試載入，或返回執行概覽。未儲存的內容不會自動提交。', reload: '重新載入頁面', home: '返回執行概覽', details: '錯誤詳情' },
  en: { toggle_menu: 'Expand or collapse navigation', load_error: 'This page could not be displayed', load_error_hint: 'Retry loading or return to the dashboard. Unsaved changes are never submitted automatically.', reload: 'Reload page', home: 'Return to dashboard', details: 'Error details' },
  ja: { toggle_menu: 'ナビゲーションを開閉', load_error: 'このページを表示できません', load_error_hint: '再読み込みするか、ダッシュボードに戻れます。未保存の内容は自動送信されません。', reload: 'ページを再読み込み', home: 'ダッシュボードに戻る', details: 'エラーの詳細' },
};

const workspaceCopy = {
  'zh-Hans': { navigation: { monitor: '总览', workspace: '骰子工作区', manage: '管理与设置' }, shortcuts: '常用操作', resource_status: '资源状态', help_catalog: '文档目录', filter_scope: '统计范围' },
  'zh-Hant': { navigation: { monitor: '總覽', workspace: '骰子工作區', manage: '管理與設定' }, shortcuts: '常用操作', resource_status: '資源狀態', help_catalog: '文件目錄', filter_scope: '統計範圍' },
  en: { navigation: { monitor: 'OVERVIEW', workspace: 'WORKSPACE', manage: 'MANAGE' }, shortcuts: 'Quick actions', resource_status: 'Resources', help_catalog: 'Contents', filter_scope: 'Reporting scope' },
  ja: { navigation: { monitor: '概要', workspace: 'ワークスペース', manage: '管理・設定' }, shortcuts: 'よく使う操作', resource_status: 'リソース', help_catalog: 'ドキュメント一覧', filter_scope: '集計範囲' },
};
export const v2Copy = {
  'zh-Hans': { ...coreCopy['zh-Hans'], ...workspaceCopy['zh-Hans'] },
  'zh-Hant': { ...coreCopy['zh-Hant'], ...workspaceCopy['zh-Hant'] },
  en: { ...coreCopy.en, ...workspaceCopy.en },
  ja: { ...coreCopy.ja, ...workspaceCopy.ja },
};
