const en = {
  display_level: 'Minimum display level', recording_level: 'Minimum recording level',
  help: 'The order is TRACE → DEBUG → INFO → SUCCESS → WARN → ERROR. INFO is the default and includes confirmed successes, warnings and errors. Normal heartbeats are TRACE; polling and execution details are DEBUG. SUCCESS means an important operation has actually completed, not that a dice check succeeded.\n\nThe display filter only affects this browser. The recording level controls new console and file records; lowering the display filter cannot recover previously unrecorded DEBUG/TRACE. Source locations and thread IDs are in diagnostic details. Internal msgID links processing results to actual outgoing content, splits, retries and failures. It is not a platform message ID; platform acceptance does not prove delivery or reading.',
  protocol: 'Protocol event diagnostics (DEBUG / TRACE)', empty: 'No records match this filter.',
  details: 'Diagnostic details', related: 'Related records', show_related: 'View related records',
  clear: 'Clear message filter', search: 'Search content, module, plugin or msgID',
  recording_note: 'Changes immediately affect new console and file logs. DEBUG / TRACE increase recording volume.',
};
type Copy = typeof en;
const zhHans: Copy = {
  display_level: '最低展示级别', recording_level: '最低记录级别',
  help: '级别顺序为 TRACE → DEBUG → INFO → SUCCESS → WARN → ERROR。默认 INFO，展示正常信息、重要操作完成、警告和错误。正常心跳属于 TRACE，轮询与执行细节属于 DEBUG；SUCCESS 表示重要操作已经确认完成，不是玩家检定成功。\n\n展示筛选只影响当前浏览器；记录级别控制之后写入控制台与文件的日志。降低展示级别，无法补出过去没有记录的 DEBUG／TRACE。代码位置与线程号可在诊断详情中查看。内部 msgID 用来对应处理结果、实际发送内容、分段、重试与失败，不是平台消息 ID。平台接受请求不代表用户已经收到或阅读。',
  protocol: '协议事件诊断（DEBUG／TRACE）', empty: '没有符合筛选条件的日志。',
  details: '诊断详情', related: '关联记录', show_related: '查看关联记录',
  clear: '清除消息筛选', search: '搜索内容、模块、插件或 msgID',
  recording_note: '修改后立即影响新产生的控制台与文件日志。DEBUG／TRACE 会增加记录量。',
};
const zhHant: Copy = {
  display_level: '最低展示級別', recording_level: '最低記錄級別',
  help: '級別順序為 TRACE → DEBUG → INFO → SUCCESS → WARN → ERROR。預設 INFO，展示正常資訊、重要操作完成、警告和錯誤。正常心跳屬於 TRACE，輪詢與執行細節屬於 DEBUG；SUCCESS 表示重要操作已經確認完成，不是玩家檢定成功。\n\n展示篩選只影響目前瀏覽器；記錄級別控制之後寫入控制台與檔案的日誌。降低展示級別，無法補出過去沒有記錄的 DEBUG／TRACE。程式碼位置與執行緒編號可在診斷詳情中查看。內部 msgID 用來對應處理結果、實際傳送內容、分段、重試與失敗，不是平台訊息 ID。平台接受請求不代表使用者已經收到或閱讀。',
  protocol: '協定事件診斷（DEBUG／TRACE）', empty: '沒有符合篩選條件的日誌。',
  details: '診斷詳情', related: '關聯記錄', show_related: '查看關聯記錄',
  clear: '清除訊息篩選', search: '搜尋內容、模組、插件或 msgID',
  recording_note: '修改後立即影響新產生的控制台與檔案日誌。DEBUG／TRACE 會增加記錄量。',
};
const ja: Copy = {
  display_level: '最低表示レベル', recording_level: '最低記録レベル',
  help: '順序は TRACE → DEBUG → INFO → SUCCESS → WARN → ERROR です。既定の INFO は正常な情報、重要な処理の完了、警告、エラーを表示します。正常なハートビートは TRACE、ポーリングや実行の詳細は DEBUG です。SUCCESS は重要な処理の確認済み完了で、ダイス判定の成功ではありません。\n\n表示フィルターはこのブラウザーだけに適用します。記録レベルは新しいコンソール・ファイル記録を制御し、過去に記録しなかった DEBUG／TRACE は復元できません。ソース位置やスレッド ID は診断詳細にあります。内部 msgID は処理結果、実際の送信内容、分割、再試行、失敗を関連付けます。プラットフォームのメッセージ ID ではなく、受理は配信・既読の証明ではありません。',
  protocol: 'プロトコルイベント診断（DEBUG / TRACE）', empty: 'フィルターに一致するログはありません。',
  details: '診断詳細', related: '関連レコード', show_related: '関連レコードを表示',
  clear: 'メッセージフィルターを解除', search: '内容、モジュール、プラグイン、msgID を検索',
  recording_note: '新しいコンソール・ファイルログにすぐ適用します。DEBUG / TRACE は記録量を増やします。',
};
export const runtimeLogsCopy = { en, 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja };
