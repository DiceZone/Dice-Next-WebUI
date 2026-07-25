import React from 'react';
interface SidebarProps {
    currentPath: string;
    onNavigate: (path: string) => void;
}
export declare const Sidebar: React.FC<SidebarProps>;
export default Sidebar;
