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

```powershell
npm run lint
npm run build
```

`npm run build` 会生成 `dist/`。该目录由主程序的打包流程带入 Windows、Linux 和 macOS 发行包，不应提交到仓库。

## 与其他项目的关系

本项目与 `Dice-Next`、`Dice-Next-Doc`、`onedice-cpp-lib` 放在同一工作区中开发。后端打包时通过 `DICENEXT_WEB_ROOT` 找到本项目的 `dist/`；若未设置该变量，则默认读取同级 `Dice-Next-WebUI`。

## 反馈

项目仍在内部开发和测试阶段。问题、建议和测试反馈请通过 QQ 群 `933145116` 提交。

