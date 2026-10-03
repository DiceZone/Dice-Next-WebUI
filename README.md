# Dice!Next WebUI

Dice!Next 的本地管理后台前端。它与后端 API 通信，用于配置机器人连接、管理群组和用户、维护规则包与插件，以及查看跑团日志和团务数据。

## 功能范围

- 仪表盘、系统设置与适配器连接管理。
- 群组、用户、权限和模拟聊天管理。
- 人物卡、规则包、JavaScript / Lua 插件与数据管理。
- 跑团日志表格、团务卡片、日志导出与上传操作。
- 简体中文、繁体中文、英文与日文界面。

## 技术栈

- React 18
- TypeScript
- Vite 6
- Tailwind CSS 与 Radix UI
- TanStack Router / Table

## 开发

环境要求：Node.js 20+ 与 npm。

```powershell
npm ci
npm run dev
```

开发服务器启动后会显示本地访问地址。实际 API 由 Dice!Next 后端提供；请先启动后端或在开发环境配置可访问的后端地址。

## 检查与构建

独立 GitHub Actions 在 push / PR 中运行测试、类型检查、生产构建和 PWA 产物检查，仅检查前端，不编译后端、不发布或部署。

隔离预览 `npm run dev:preview` 不连接真实机器人。若要查看实际文案序列化结果，可编译主仓的 `tools/reply-preview.cpp`（链接 `markdown.cpp`、`markdown_md4c.cpp`、MD4C 与 nlohmann JSON），并将可执行文件绝对路径放入 `DICENEXT_UI_PREVIEW_RENDERER`。未配置时明确显示预览不可用，不用简易正则伪造平台输出。

```powershell
npm run lint
npm run build
```

`npm run build` 会生成 `dist/`。该目录由主程序的打包流程带入 Windows、Linux 和 macOS 发行包，不应提交到仓库。

## 安装为应用

WebUI 提供应用清单，可通过支持该功能的浏览器安装为独立窗口应用：

- Chrome / Edge：使用地址栏安装图标，或浏览器菜单中的安装应用入口；入口名称和出现时机由浏览器决定。
- macOS Safari 17 及以上：在“文件”菜单中选择“添加到程序坞”。
- iPhone / iPad：在浏览器分享菜单中选择“添加到主屏幕”。

请使用 HTTPS，或本机 `http://localhost:端口` / `http://127.0.0.1:端口`。普通 HTTP 的局域网或公网 IP 不满足浏览器推荐安装的安全要求；不要为此关闭浏览器安全限制。

安装的是当前地址的管理面板，不是机器人后端。后端仍需运行，登录校验保持不变；本功能不注册 Service Worker、不增加离线/API 缓存，也不提供离线管理或后台运行机器人。服务器地址改变后需从新地址重新安装。

应用图标复用 `public/favicon.svg`。替换该图标后执行 `npm run icons:generate`，并提交生成的 `public/icons/` 文件。构建后可执行 `PWA_TEST_DIST=1 node --test tests/pwa.test.mjs` 检查发行资源。

## 与其他项目的关系

本项目与 `Dice-Next`、`Dice-Next-Doc`、`onedice-cpp-lib` 放在同一工作区中开发。后端打包时通过 `DICENEXT_WEB_ROOT` 找到本项目的 `dist/`；若未设置该变量，则默认读取同级 `Dice-Next-WebUI`。

## 反馈

项目仍在内部开发和测试阶段。问题、建议和测试反馈请通过 QQ 群 `933145116` 提交。

## 开源许可证

本项目以 **GNU Affero General Public License v3.0 or later（AGPL-3.0-or-later）** 发布，与 [Dice-Next](https://github.com/DiceZone/Dice-Next) 主仓库保持一致。完整条款见 [LICENSE](LICENSE)。
