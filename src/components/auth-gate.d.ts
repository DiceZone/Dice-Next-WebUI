import React from 'react';
/**
 * WebUI 登录门（C#34）。挂在 AppRouter 外层：
 * - 先查 /api/auth/status；未设口令或已登录 → 直接渲染应用。
 * - 设了口令且未登录 → 显示登录框，登录成功后写入会话 Cookie（浏览器自动随后续请求带上）。
 * 探测失败（后端不可达）时放行，避免把用户锁在外面。
 */
export declare const AuthGate: React.FC<{
    children: React.ReactNode;
}>;
export default AuthGate;
