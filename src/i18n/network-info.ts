const en = {
  help: 'Addresses come from the server running Dice!Next, not this browser. Detection runs in the background at startup and every 15 minutes. Opening this dialog reads the cache; Refresh starts a new check.\n\nLocalhost is only for a login framework on the same server. LAN addresses come from active IPv4 interfaces; choose the reachable one if multiple adapters, VPNs or container networks are present. Public shows the IPv4 egress address from an external query, not proof that an inbound connection will work.\n\nNAT/container port mapping and firewall/security-group rules may still be required. Detection does not open ports or change firewall settings. A failed refresh retains previous addresses with a stale-cache warning.',
  cached: 'Server cache · refreshes every 15 minutes', refresh: 'Refresh addresses', refreshing: 'Checking…', reading: 'Reading cache…',
  interface: 'Server IPv4 interface', lan_failed: 'No usable server IPv4 address found', wan_failed: 'Public IPv4 could not be detected',
  unavailable: 'Could not read the server address cache. Please retry.', unsupported: 'This core does not support the address cache. Update the core and retry.',
  stale_label: 'Stale', stale: 'Some addresses could not be refreshed. Previous cached addresses are marked; verify them before use.',
  reachability: 'A public IP does not prove connectivity. Check port mapping and firewall/security-group rules.',
  invalid_port: 'Invalid listening port', copy_failed: 'Copy failed. Select the address and copy it manually.',
};
type Copy = typeof en;
const zhHans: Copy = {
  help: '地址来自运行 Dice!Next 的服务器，不是当前浏览器。程序启动后在后台检测，每 15 分钟自动刷新；打开弹窗只读取缓存，点击“刷新地址”才发起新的检测。\n\n“本机”仅适用于登录框架与骰子运行在同一台服务器的情况。内网地址来自活动网卡的 IPv4；多网卡、VPN 或容器环境中，请选择框架能够访问的地址。公网显示外部查询得到的 IPv4 出口地址，不代表外部一定能连入。\n\nNAT／容器环境可能需要端口映射，防火墙或云服务器安全组也需放行。地址检测不会开放端口或修改防火墙。刷新失败时会保留旧地址，并明确标记旧缓存。',
  cached: '服务器缓存 · 每 15 分钟自动刷新', refresh: '刷新地址', refreshing: '检测中…', reading: '读取缓存中…',
  interface: '服务器网卡 IPv4', lan_failed: '未获取到可用的服务器 IPv4', wan_failed: '未能检测到公网 IPv4',
  unavailable: '无法读取服务器地址缓存，请重试。', unsupported: '主程序暂不支持地址缓存，请更新主程序后重试。',
  stale_label: '旧缓存', stale: '部分地址本次未能刷新，已标记仍在使用的旧缓存，请确认后使用。',
  reachability: '公网地址不代表端口可达；请确认端口映射及防火墙／安全组放行。',
  invalid_port: '监听端口无效', copy_failed: '复制失败，请选中地址手动复制。',
};
const zhHant: Copy = {
  help: '位址來自執行 Dice!Next 的伺服器，不是目前瀏覽器。程式啟動後在背景偵測，每 15 分鐘自動更新；開啟彈窗只讀取快取，點擊「更新位址」才發起新的偵測。\n\n「本機」僅適用於登入框架與骰子執行在同一台伺服器的情況。內網位址來自活動網卡的 IPv4；多網卡、VPN 或容器環境中，請選擇框架能夠存取的位址。公網顯示外部查詢得到的 IPv4 出口位址，不代表外部一定能連入。\n\nNAT／容器環境可能需要連接埠映射，防火牆或雲端伺服器安全群組也需放行。位址偵測不會開放連接埠或修改防火牆。更新失敗時會保留舊位址，並明確標記舊快取。',
  cached: '伺服器快取 · 每 15 分鐘自動更新', refresh: '更新位址', refreshing: '偵測中…', reading: '讀取快取中…',
  interface: '伺服器網卡 IPv4', lan_failed: '未取得可用的伺服器 IPv4', wan_failed: '未能偵測到公網 IPv4',
  unavailable: '無法讀取伺服器位址快取，請重試。', unsupported: '主程式暫不支援位址快取，請更新主程式後重試。',
  stale_label: '舊快取', stale: '部分位址本次未能更新，已標記仍在使用的舊快取，請確認後使用。',
  reachability: '公網位址不代表連接埠可達；請確認連接埠映射及防火牆／安全群組放行。',
  invalid_port: '監聽連接埠無效', copy_failed: '複製失敗，請選取位址手動複製。',
};
const ja: Copy = {
  help: 'アドレスはこのブラウザーではなく、Dice!Next を実行するサーバーのものです。起動時にバックグラウンドで検出し、15 分ごとに更新します。ダイアログはキャッシュを読み、更新ボタンだけが新しい検出を開始します。\n\nローカルホストはログインフレームワークと同じサーバーの場合に使用します。LAN は稼働中の IPv4 インターフェースです。複数の NIC、VPN、コンテナーでは到達可能なアドレスを選びます。公開 IPv4 は外部サービスで確認した出口アドレスであり、外部から接続できる証明ではありません。\n\nNAT やコンテナーのポート転送、ファイアウォール／セキュリティグループの許可が必要な場合があります。検出はポートやファイアウォールを変更しません。更新失敗時は古いキャッシュを明示します。',
  cached: 'サーバーキャッシュ · 15 分ごとに更新', refresh: 'アドレスを更新', refreshing: '確認中…', reading: 'キャッシュを読み込み中…',
  interface: 'サーバー IPv4 インターフェース', lan_failed: '有効なサーバー IPv4 がありません', wan_failed: '公開 IPv4 を検出できませんでした',
  unavailable: 'サーバーのアドレスキャッシュを読み取れません。再試行してください。', unsupported: 'このコアはアドレスキャッシュに対応していません。更新してください。',
  stale_label: '古い情報', stale: '一部のアドレスを更新できませんでした。古い情報を明示しています。使用前に確認してください。',
  reachability: '公開 IP は接続可能の証明ではありません。ポート転送とファイアウォール設定を確認してください。',
  invalid_port: '待受ポートが無効です', copy_failed: 'コピーに失敗しました。アドレスを選択して手動でコピーしてください。',
};
export const networkInfoCopy = { en, 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja };
