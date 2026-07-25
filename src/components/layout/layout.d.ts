import React from 'react';
interface LayoutProps {
    children: React.ReactNode;
    currentPath: string;
    onNavigate: (path: string) => void;
    wsConnected?: boolean;
}
export declare const Layout: React.FC<LayoutProps>;
export default Layout;
