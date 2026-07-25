/**
 * C#67/C#68/C#78：人工智能 —— 分「模型 / 润色 / 翻译」三个子页面（由路由 /ai、/ai/polish、
 * /ai/translate 决定，同一组件不重挂载，编辑状态共享，一次保存全部）。
 * 后端：/api/system/ai (GET/PUT)、/api/system/ai/test (POST)。
 */
import React from 'react';
export declare const AiPage: React.FC;
export default AiPage;
