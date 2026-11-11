# Dice!Next WebUI

<p>
  <a href="README.md">English</a> · <a href="README.zh-Hans.md">简体中文</a> · <b>繁體中文</b> · <a href="README.ja.md">日本語</a>
</p>

Dice!Next 的本地管理後臺前端。它與後端 API 通訊，用於配置機器人連線、管理群組和使用者、維護規則包與插件，以及檢視跑團日誌和團務資料。

## 功能範圍

- 儀表盤、系統設定與適配器連線管理。
- 群組、使用者、許可權和模擬聊天管理。
- 人物卡、規則包、JavaScript / Lua 插件與資料管理。
- 跑團日誌表格、團務卡片、日誌匯出與上傳操作。
- 簡體中文、繁體中文、英文與日文介面。

首頁伺服器資訊下方的“常用操作”支援自訂：點選右上角調整按鈕，選擇最多 6 個頁面入口，使用上下箭頭排序，儲存或恢復預設。偏好儲存在當前瀏覽器；不會修改機器人配置，清理瀏覽器站點資料後恢復預設。全域性搜尋“常用操作”也可定位到此處。

## 技術棧

- React 18
- TypeScript
- Vite 6
- Tailwind CSS 與 Radix UI
- TanStack Router / Table

## 開發

環境要求：Node.js 26.12.1 或更新的 26.x 安全版本，以及隨附的 npm。
CI 使用 `26.x` 並強制檢查最新版本；構建前校驗最低安全版本並記錄實際版本。

```powershell
npm ci
npm run dev
```

開發伺服器啟動後會顯示本地訪問地址。實際 API 由 Dice!Next 後端提供；請先啟動後端或在開發環境配置可訪問的後端地址。

## 檢查與構建

獨立 GitHub Actions 在 push / PR 中執行測試、型別檢查、生產構建和 PWA 產物檢查，僅檢查前端，不編譯後端、不釋出或部署。

隔離預覽 `npm run dev:preview` 不連線真實機器人。若要檢視實際文案序列化結果，可編譯主倉的 `tools/reply-preview.cpp`（連結 `markdown.cpp`、`markdown_md4c.cpp`、MD4C 與 nlohmann JSON），並將執行檔絕對路徑放入 `DICENEXT_UI_PREVIEW_RENDERER`。未配置時明確顯示預覽不可用，不用簡易正則偽造平臺輸出。

```powershell
npm run lint
npm run build
```

`npm run build` 會生成 `dist/`。該目錄由主程式的打包流程帶入 Windows、Linux 和 macOS 發行包，不應提交到倉庫。

## 安裝為應用

WebUI 提供應用清單，可通過支援該功能的瀏覽器安裝為獨立視窗應用：

- Chrome / Edge：使用位址列安裝圖示，或瀏覽器選單中的安裝應用入口；入口名稱和出現時機由瀏覽器決定。
- macOS Safari 17 及以上：在“檔案”選單中選擇“新增到程式塢”。
- iPhone / iPad：在瀏覽器分享選單中選擇“新增到主螢幕”。

請使用 HTTPS，或本機 `http://localhost:端口` / `http://127.0.0.1:端口`。普通 HTTP 的區域網或公網 IP 不滿足瀏覽器推薦安裝的安全要求；不要為此關閉瀏覽器安全限制。

安裝的是當前地址的管理面板，不是機器人後端。後端仍需執行，登入校驗保持不變；本功能不註冊 Service Worker、不增加離線/API 快取，也不提供離線管理或後臺執行機器人。伺服器地址改變後需從新地址重新安裝。

應用圖示複用 `public/favicon.svg`。替換該圖示後執行 `npm run icons:generate`，並提交生成的 `public/icons/` 檔案。構建後可執行 `PWA_TEST_DIST=1 node --test tests/pwa.test.mjs` 檢查發行資源。

## 與其他專案的關係

瀏覽器迴歸測試固定使用倉庫內的獨立樣例，不自動讀取同級倉庫，保證本地與 CI 的資料一致。
`node tests/ui-preview.mjs` 可手動檢視同一套樣例；`npm run dev:preview` 則顯式啟用
`--workspace`，在同級主程式與文件倉庫可用時讀取完整指令和文案。兩種模式都不連線真實機器人，
修改僅保留在預覽程序內。

本專案與 `Dice-Next`、`Dice-Next-Doc`、`onedice-cpp-lib` 放在同一工作區中開發。後端打包時通過 `DICENEXT_WEB_ROOT` 找到本專案的 `dist/`；若未設定該變數，則預設讀取同級 `Dice-Next-WebUI`。

## 反饋

專案仍在內部開發和測試階段。問題、建議和測試反饋請通過 QQ 群 `933145116` 提交。

## 開源許可證

本專案以 **GNU Affero General Public License v3.0 or later（AGPL-3.0-or-later）** 釋出，與 [Dice-Next](https://github.com/DiceZone/Dice-Next) 主倉庫保持一致。完整條款見 [LICENSE](LICENSE)。
