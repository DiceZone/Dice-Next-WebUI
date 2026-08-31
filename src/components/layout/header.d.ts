import React from 'react';
interface HeaderProps {
    wsConnected?: boolean;
    onNavigate: (path: string) => void;
}
export declare const Header: React.FC<HeaderProps>;
export default Header;
