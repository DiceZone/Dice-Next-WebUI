import React from 'react';
import type { ServerNetworkView } from '@/hooks/use-server-network-info';
interface ReverseWsInfoProps {
    open: boolean;
    onClose: () => void;
    port: string;
    network: ServerNetworkView;
    onRefresh: () => Promise<void>;
}
export declare const ReverseWsInfo: React.FC<ReverseWsInfoProps>;
export default ReverseWsInfo;
