import React from 'react';
import type { AdapterStatus } from '@/types/adapter';
interface ConnectionStatusProps {
    status: AdapterStatus;
    className?: string;
}
export declare const ConnectionStatus: React.FC<ConnectionStatusProps>;
export default ConnectionStatus;
