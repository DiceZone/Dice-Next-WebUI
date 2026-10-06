const en = {
  overview: 'Daily overview', overview_hint: 'One block per day · select a day for details',
  day_detail: 'Day detail', day_picker: 'Select a day', previous_day: 'Previous day', next_day: 'Next day',
  uncollected: 'Not sampled', known_intervals: '{{count}} / {{total}} intervals sampled',
  timezone_fallback: 'UTC (server timezone unavailable)',
  help: 'The single-row overview summarizes each day\'s sampled intervals: green when all are online, red when all are offline, and yellow when online and offline intervals are mixed or any interval is partially online. Days without samples stay gray. Click a block, use the date selector or the arrow buttons to inspect that day. Detailed intervals keep their worst observed state at the selected granularity; longer ranges do not invent five-minute data.\n\nThe detail row scrolls horizontally on narrow screens. Hover, click or use the Left/Right arrow keys to inspect intervals. Missing buckets and future times stay gray and do not affect the daily color or count as offline. Calendar dates use the server timezone; if it cannot be read, UTC is explicitly shown. Five-minute granularity is available only for the seven-day range.',
};
type Copy = typeof en;
const zhHans: Copy = {
  overview: '每日概览', overview_hint: '一格一天 · 点击日期查看明细',
  day_detail: '单日明细', day_picker: '选择日期', previous_day: '前一天', next_day: '后一天',
  uncollected: '未采集', known_intervals: '已采集 {{count}} / {{total}} 个区间',
  timezone_fallback: 'UTC（未获取服务器时区）',
  help: '单行总览中，一格代表一天：已采集区间全部在线显示绿色，全部离线显示红色，在线与离线混合或存在部分在线区间显示黄色，整天无采集数据显示灰色。点击色块、选择日期或使用前后箭头，可以查看当天明细。明细仍保留所选粒度内的最差在线状态，不会把较长范围的小时数据伪装成五分钟数据。\n\n窄屏时明细横向滚动，不会堆成多行。悬浮、点击或使用键盘左右箭头，可查看对应时间与在线数量。未采集区间及未来时段显示灰色，不参与每日颜色判断，也不会当作离线。日期按服务器时区划分，获取失败时明确显示 UTC。五分钟粒度仅支持七天范围。',
};
const zhHant: Copy = {
  overview: '每日概覽', overview_hint: '一格一天 · 點擊日期查看明細',
  day_detail: '單日明細', day_picker: '選擇日期', previous_day: '前一天', next_day: '後一天',
  uncollected: '未採集', known_intervals: '已採集 {{count}} / {{total}} 個區間',
  timezone_fallback: 'UTC（未取得伺服器時區）',
  help: '單行總覽中，一格代表一天：已採集區間全部在線顯示綠色，全部離線顯示紅色，在線與離線混合或存在部分在線區間顯示黃色，整天無採集資料顯示灰色。點擊色塊、選擇日期或使用前後箭頭，可以查看當天明細。明細仍保留所選粒度內的最差在線狀態，不會把較長範圍的小時資料偽裝成五分鐘資料。\n\n窄螢幕時明細橫向捲動，不會堆成多行。懸浮、點擊或使用鍵盤左右箭頭，可查看對應時間與在線數量。未採集區間及未來時段顯示灰色，不參與每日顏色判斷，也不會當作離線。日期按伺服器時區劃分，取得失敗時明確顯示 UTC。五分鐘粒度僅支援七天範圍。',
};
const ja: Copy = {
  overview: '日別の概要', overview_hint: '1 ブロック＝1 日 · 日付を選択して詳細を表示',
  day_detail: '1 日の詳細', day_picker: '日付を選択', previous_day: '前日', next_day: '翌日',
  uncollected: '未収集', known_intervals: '{{total}} 区間中 {{count}} 区間を記録',
  timezone_fallback: 'UTC（サーバーのタイムゾーンを取得できません）',
  help: '1 行の概要は各日の記録済み区間をまとめ、すべてオンラインなら緑、すべてオフラインなら赤、両方が混在する日や一部オンラインの区間がある日は黄色で表示します。記録のない日は灰色です。ブロック、日付の選択、前後のボタンでその日の詳細を表示します。詳細は選択した粒度内で観測した最も悪い状態を残し、長期間の時間単位のデータから 5 分単位の値を作りません。\n\n狭い画面では詳細を横方向にスクロールします。ホバー、クリック、左右の矢印キーで時間とオンライン数を確認できます。未収集や未来の区間は灰色で表示し、日の色の判定に含めず、オフラインとは数えません。日付はサーバーのタイムゾーンで区切り、取得できない場合は UTC と明示します。5 分単位は 7 日間の範囲のみ利用できます。',
};
export const availabilityCopy = { en, 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja };
