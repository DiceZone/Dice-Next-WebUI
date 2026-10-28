# V2（预览版）

本分支为新版 WebUI 的独立实现，首个可用预览版已完成技术栈、公共主题和页面框架迁移。
保留 V1 的业务入口及权限；双版本切换、独立资源和预览标记已接入。V2 仍不是正式版，V1 保留为默认选项。

2026-10-26 用户认可第二轮整体风格，并要求继续调整宽度、首页布局、主题色与移动导航。第三轮调整仍待审阅，V2 仍为预览版。

## 视觉维护约定

- 侧栏选中项只用底色和文字色，不加左侧色条、描边或 inset 阴影。
- 保持 V1 的紫色主色：浅色 239 84% 58%，暗色 239 84% 64%。不要自行换为蓝色。
- 页面根容器的旧 max-width 由工作区的 `[&>*]:max-w-none` 工具类覆盖；components 层规则不能覆盖 utilities 层的经典版宽度。
- 首页桌面布局为独立三指标，左侧服务器与自定义常用操作，右侧内部滚动日志；普通 1366×768 视口应能容纳 6 个入口，较矮视口允许滚动而不是裁掉控件。
- 手机导航为全宽双列、全部分组展开；保留焦点约束、Esc 关闭、焦点返回及减少动效支持。完整版本号不可截断。
- 手机顶栏必须单行，显示 Logo、其右侧的下箭头导航按钮、完整版本号、搜索和更多操作；语言、主题及页面引导收进更多菜单，不通过隐藏功能来腾位置。顶栏不显示 V2 徽章，预览版身份仍在版本设置中说明。
- 首页标题不另放“平台连接”按钮，统一从导航进入；可自定义常用操作的设置与原有平台连接功能保留。
- Dice!Next 字标沿用 V1 桌面字标的 Inter Bold 700、18px 与紧凑字距；只有感叹号为紫色，其余使用主题前景色。复用已有本地 Inter 字体，不新增品牌字体或外部字体请求。
- 平台连接使用自动分列的卡片网格，宽屏多列、手机单列；保留状态文字及原有操作，不再改成全宽列表。
- 弹窗只做从上方进出的轻微位移及淡入淡出，不允许动画覆盖居中定位后飞向左上角。
- 不为每个标题图标套彩色底座，不在工作区叠加装饰渐变。颜色优先服务选中、状态、主操作和警告。
- CardHeader / CardContent 的默认间距在 components 层处理；不要再加 `sm:p-* sm:pt-0` 覆盖页面传入的 padding。
- 有标题的内容区与独立内容区不同，新增卡片要分别看手机、720px 平板和桌面，不能只检查宽屏。
- 宽屏分类导航的 Radix orientation 须与实际排列一致；窄屏沿用现有下拉切换，不卸载用户的编辑草稿。
- 长工具栏不能挤窄标题，次要动作可归入“更多”；正文不可因容器宽度而贴边、截断关键操作或遮住下拉箭头。
- 除测试外必须看实际截图，尤其是侧栏展开、侧栏收起、暗色及编辑弹窗。测试无法代替视觉审阅。

- Tailwind 4 + Vite 插件、shadcn CLI 源码组件、浅色／暗色／窄屏公共主题。
- TanStack Router hash 路由、按页加载、旧链接和搜索定位、异步离页确认。
- TanStack Query 核心读取／分页与作用域缓存；Zustand 兼容投影和本地编辑草稿保留。写入不自动重试。
- React Hook Form + Zod、TanStack Table、DayPicker + date-fns、Sonner、Motion。
- 固定来源的 Tremor Raw 源码趋势图及随包许可证；React Bits / Skiper 非必选，未引入。
- TypeScript、Vitest / Testing Library、Playwright 和 Biome。完整验收见 `V2-IMPLEMENTATION.md`。

常用命令：`npm ci`、`npm test`、`npm run quality`、`npm run build`。
浏览器回归：`npx playwright install chromium` 后运行 `npm run test:v2-browser`、
`npm run test:notice-browser`、`npm run test:mcp-browser`。本地也可用 `PLAYWRIGHT_CHANNEL=chrome` 或 `msedge` 使用已安装浏览器；CI 使用 Playwright 管理的 Chromium。
`npm run dev:preview` 仅连接内存示例数据，不能据此认定真实适配器联调完成；`npm run dev` 才使用 Vite 的后端代理。

主工作树为 `../Dice-Next-WebUI`，V2 工作树为 `../Dice-Next-WebUI-v2`。
提交功能时必须同步两个分支，直到骰主确认 V2 正式替代并删除 V1。
详见本仓库 `AGENTS.md` 和主程序仓库 `docs/webui-versions.md`。

MCP / OpenOPQ 前端与 V1 保持功能一致；2026-10-28 用户已授权两项功能与双版本 UI 一并提交和发布。后续改动仍须同步两套 UI，不得把预览分支直接合并覆盖 V1。
